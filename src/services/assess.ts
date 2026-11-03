import { db } from '@/db/db';
import { computeMastery, MASTERY_LABEL, pct } from '@/domain/mastery';
import { pickRepairDate, shouldCreateRepair } from '@/domain/repair';
import { makeSession } from '@/scheduling/engine';
import type { AssessmentAttempt, ErrorCategory, ErrorRecord, ISODate, RepairMethod, RepairTask } from '@/types';
import { addDays, isValidISODate, nowISO } from '@/utils/dates';
import { addNotices, getConfig, log, uid } from './meta';

export type AttemptInput = Omit<AssessmentAttempt, 'id' | 'completedAt' | 'photoIds'> & { photoIds?: string[] };

export class ValidationError extends Error {}

export function validateAttempt(a: AttemptInput) {
  if (!Number.isFinite(a.marksAvailable) || a.marksAvailable <= 0) throw new ValidationError('Marks available must be more than 0.');
  if (!Number.isFinite(a.marksEarned) || a.marksEarned < 0) throw new ValidationError('Marks earned can’t be negative.');
  if (a.marksEarned > a.marksAvailable) throw new ValidationError('Marks earned can’t be more than marks available.');
  if (!isValidISODate(a.date)) throw new ValidationError('Please choose a valid date.');
}

export interface RecordResult {
  attempt: AssessmentAttempt;
  repair?: RepairTask;
  masteryBefore: string;
  masteryAfter: string;
}

/**
 * Record an assessment. Side effects, all in one transaction:
 *  - a repair task + repair session (within 48h) if the score is below 50%
 *  - closing the linked repair when this is its retest
 */
export async function recordAttempt(input: AttemptInput, today: ISODate): Promise<RecordResult> {
  validateAttempt(input);
  return db.transaction('rw', [db.attempts, db.repairs, db.sessions, db.meta, db.history, db.exams], async () => {
    const before = input.topicId ? computeMastery(await db.attempts.where('topicId').equals(input.topicId).toArray()) : null;
    const attempt: AssessmentAttempt = { ...input, photoIds: input.photoIds ?? [], id: uid(), completedAt: nowISO() };
    await db.attempts.put(attempt);
    await log('attempt.add', 'attempt', attempt.id, `${attempt.subjectId} ${attempt.marksEarned}/${attempt.marksAvailable}`);

    // Close the repair this retest belongs to (history is kept).
    if (attempt.repairId) {
      const r = await db.repairs.get(attempt.repairId);
      if (r && r.status !== 'closed') {
        await db.repairs.put({ ...r, status: 'closed', retestAttemptId: attempt.id, closedAt: nowISO() });
        await log('repair.close', 'repair', r.id, `retest ${pct(attempt)}%`);
      }
    }

    let repair: RepairTask | undefined;
    const existing = await db.repairs.where('sourceAttemptId').equals(attempt.id).toArray();
    if (shouldCreateRepair(attempt, existing)) {
      const [config, exams, all] = await Promise.all([getConfig(), db.exams.toArray(), db.sessions.toArray()]);
      const { date } = pickRepairDate(today, all, config, exams);
      repair = {
        id: uid(), subjectId: attempt.subjectId, topicId: attempt.topicId, sourceAttemptId: attempt.id,
        diagnosis: null, method: null, assignedDate: today, dueDate: addDays(today, 2), status: 'diagnose', createdAt: nowISO()
      };
      const session = makeSession(
        { id: uid(), date, subjectId: attempt.subjectId, templateId: 'repair', topicIds: attempt.topicId ? [attempt.topicId] : [], source: 'repair', repairId: repair.id, order: 30, reason: 'Repair within 48 hours of a score below 50%.' },
        nowISO(),
        config.planVersion
      );
      repair.repairSessionId = session.id;
      await db.repairs.put(repair);
      await db.sessions.put(session);
      await log('repair.create', 'repair', repair.id, `from attempt ${attempt.id}`);
      await addNotices([{ date: today, kind: 'repair', sessionId: session.id, text: 'This idea needs a different approach. A short repair session is planned — start by finding what was difficult.' }]);
    }

    const after = attempt.topicId ? computeMastery(await db.attempts.where('topicId').equals(attempt.topicId).toArray()) : null;
    return {
      attempt,
      repair,
      masteryBefore: before ? MASTERY_LABEL[before.state] : '',
      masteryAfter: after ? MASTERY_LABEL[after.state] : ''
    };
  });
}

export async function updateAttemptMarking(id: string, patch: Pick<AssessmentAttempt, 'originalAnswer' | 'missingPoints' | 'correctedAnswer' | 'reattemptDone'>) {
  await db.attempts.update(id, patch);
}

export async function addError(e: Omit<ErrorRecord, 'id' | 'createdAt' | 'resolved'>) {
  const rec: ErrorRecord = { ...e, id: uid(), createdAt: nowISO(), resolved: false };
  await db.errors.put(rec);
  return rec;
}

export async function setErrorResolved(id: string, resolved: boolean) {
  await db.errors.update(id, { resolved, resolvedAt: resolved ? nowISO() : undefined });
}

export async function diagnoseRepair(id: string, diagnosis: ErrorCategory, method: RepairMethod, notes?: string) {
  await db.repairs.update(id, { diagnosis, method, notes, status: 'scheduled' });
  await log('repair.diagnose', 'repair', id, `${diagnosis} → ${method}`);
}

export async function deleteAttempt(id: string) {
  // Only allowed when nothing depends on it, to protect referential integrity.
  const deps = await db.repairs.where('sourceAttemptId').equals(id).count();
  if (deps) throw new ValidationError('This result started a repair, so it is kept for your history.');
  await db.transaction('rw', db.attempts, db.errors, db.history, async () => {
    await db.attempts.delete(id);
    await db.errors.where('attemptId').equals(id).modify({ attemptId: null });
    await log('attempt.delete', 'attempt', id, '');
  });
}
