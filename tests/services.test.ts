import { beforeEach, describe, expect, it } from 'vitest';
import { db, ALL_TABLES } from '@/db/db';
import { completeSetup } from '@/services/setup';
import { dailyMaintenance, ensureHorizon, regenerateFuture, takeRestDay, skipSession, quickCheckInstead } from '@/services/plan';
import { completeSession, setActivityDone, startSession } from '@/services/sessions';
import { recordAttempt, ValidationError } from '@/services/assess';
import { checkBackup, exportBackup, restoreBackup } from '@/services/backup';
import { carryQueue } from '@/scheduling/carryover';
import { computeMastery } from '@/domain/mastery';
import { addDays } from '@/utils/dates';
import { TODAY } from './helpers';

async function reset() {
  for (const t of ALL_TABLES) await db.table(t).clear();
}

const base = { subjectId: 'physics' as const, topicId: 'phys-1', sessionId: null, assessmentType: 'topic-quiz' as const, source: 'textbook' as const, assistanceUsed: 'none' as const, confidence: null, unseen: true };

describe('services on IndexedDB', () => {
  beforeEach(async () => {
    await reset();
    await completeSetup({ config: {} }, TODAY);
    await db.topics.put({ id: 'phys-1', subjectId: 'physics', parentTopicId: null, syllabusReference: null, title: 'Electromagnetic induction', learningObjectives: '', order: 0, active: true, inMock: false });
  });

  it('setup generates a plan for the horizon and is idempotent', async () => {
    const n = await db.sessions.count();
    expect(n).toBeGreaterThan(50);
    expect(await ensureHorizon(TODAY)).toBe(0);
    expect(await db.sessions.count()).toBe(n);
  });

  it('progress survives a reload (fresh read from IndexedDB)', async () => {
    const s = (await db.sessions.where('date').equals(TODAY).first())!;
    await startSession(s.id, 'full');
    await setActivityDone(s.id, 'recall', true);
    await setActivityDone(s.id, 'recall', true); // duplicate is a no-op
    db.close();
    await db.open();
    const again = (await db.sessions.get(s.id))!;
    expect(again.status).toBe('in_progress');
    expect(again.completedActivities).toEqual(['recall'].filter((k) => again.completedActivities.includes(k)));
    expect(again.completedActivities.length).toBe(1);
  });

  it('returning after several days: missed work is kept, placed or queued — never lost or completed', async () => {
    const before = await db.sessions.where('date').equals(TODAY).toArray();
    const later = addDays(TODAY, 3);
    await dailyMaintenance(later);
    for (const s of before) {
      const now = await db.sessions.get(s.id);
      expect(now).toBeDefined();
      expect(now!.status).not.toBe('completed');
      expect(now!.originalDate).toBe(TODAY);
      if (now!.date >= later) expect(now!.moves.length).toBeGreaterThan(0);
      else expect(['missed', 'partial']).toContain(now!.status);
    }
    const all = await db.sessions.toArray();
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    // Running maintenance again changes nothing (idempotent)
    const count = all.length;
    await dailyMaintenance(later);
    expect(await db.sessions.count()).toBe(count);
  });

  it('a Light session completes as Light and schedules one Steady follow-up', async () => {
    const s = (await db.sessions.where('date').equals(TODAY).filter((x) => x.purpose !== 'exam').first())!;
    await startSession(s.id, 'light');
    await setActivityDone(s.id, 'light-recall', true);
    await setActivityDone(s.id, 'light-check', true);
    const r = await completeSession(s.id, TODAY);
    expect(r.session.status).toBe('completed');
    expect(r.session.mode).toBe('light');
    expect(r.followup?.plannedMode).toBe('steady');
    expect(r.followup!.date > TODAY).toBe(true);
    // completing again does not create a second follow-up
    await completeSession(s.id, TODAY);
    expect(await db.sessions.where('source').equals('followup').count()).toBe(1);
  });

  it('below 50% creates one repair within 48h; repair → unseen retest → closed; no premature Secure', async () => {
    const r = await recordAttempt({ ...base, marksEarned: 4, marksAvailable: 10, date: TODAY }, TODAY);
    expect(r.repair).toBeDefined();
    expect(r.masteryAfter).toBe('Needs practice');
    const repairSession = (await db.sessions.get(r.repair!.repairSessionId!))!;
    expect(repairSession.date > TODAY && repairSession.date <= addDays(TODAY, 2)).toBe(true);
    const done = await completeSession(repairSession.id, repairSession.date);
    expect(done.retest).toBeDefined();
    expect((await db.repairs.get(r.repair!.id))!.status).toBe('retest-scheduled');
    const rt = await recordAttempt({ ...base, assessmentType: 'retest', repairId: r.repair!.id, marksEarned: 9, marksAvailable: 10, date: done.retest!.date }, done.retest!.date);
    expect(rt.repair).toBeUndefined();
    const closed = (await db.repairs.get(r.repair!.id))!;
    expect(closed.status).toBe('closed');
    expect(closed.retestAttemptId).toBe(rt.attempt.id);
    const m = computeMastery(await db.attempts.where('topicId').equals('phys-1').toArray());
    expect(m.state).toBe('amber');
    expect(m.provisional).toBe(true);
    // history retained
    expect(await db.attempts.count()).toBe(2);
  });

  it('rejects invalid scores', async () => {
    await expect(recordAttempt({ ...base, marksEarned: 11, marksAvailable: 10, date: TODAY }, TODAY)).rejects.toBeInstanceOf(ValidationError);
    await expect(recordAttempt({ ...base, marksEarned: -1, marksAvailable: 10, date: TODAY }, TODAY)).rejects.toBeInstanceOf(ValidationError);
    await expect(recordAttempt({ ...base, marksEarned: 1, marksAvailable: 0, date: TODAY }, TODAY)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rest day re-places today’s work without marking anything complete', async () => {
    const todays = await db.sessions.where('date').equals(TODAY).toArray();
    const r = await takeRestDay(TODAY);
    expect(r.total).toBe(todays.length);
    for (const s of todays) {
      const now = await db.sessions.get(s.id);
      if (now) expect(now.status).not.toBe('completed');
    }
  });

  it('skip requires a reason; quick check keeps the original in history', async () => {
    const [a, b] = await db.sessions.where('date').equals(TODAY).toArray();
    await expect(skipSession(a.id, '  ')).rejects.toThrow();
    await skipSession(a.id, 'School event');
    expect((await db.sessions.get(a.id))!.skipReason).toBe('School event');
    const qc = await quickCheckInstead(b.id, TODAY);
    const orig = (await db.sessions.get(b.id))!;
    expect(orig.status).toBe('converted');
    expect(orig.replacementId).toBe(qc.id);
    expect(carryQueue(await db.sessions.toArray(), addDays(TODAY, 1)).map((s) => s.id)).not.toContain(b.id);
  });

  it('regenerating after an exam-date change keeps completed work', async () => {
    const s = (await db.sessions.where('date').equals(TODAY).first())!;
    await startSession(s.id, 'full');
    await completeSession(s.id, TODAY);
    await db.exams.put({ id: 'e1', group: 'mock2', subjectId: 'bangla', paper: 'Paper 1', date: addDays(TODAY, 5), startTime: null, durationMinutes: null, coverageTopicIds: [], status: 'scheduled' });
    await regenerateFuture(TODAY, 'Exam date entered');
    const kept = (await db.sessions.get(s.id))!;
    expect(kept.status).toBe('completed');
    const all = await db.sessions.toArray();
    expect(new Set(all.map((x) => x.id)).size).toBe(all.length);
  });

  it('backup round-trip restores everything; invalid backups are rejected', async () => {
    await recordAttempt({ ...base, marksEarned: 4, marksAvailable: 10, date: TODAY }, TODAY);
    await db.files.put({ id: 'f1', name: 'graph.png', type: 'image/png', size: 3, blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), createdAt: TODAY });
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    const counts = { s: await db.sessions.count(), a: await db.attempts.count(), r: await db.repairs.count() };
    const check = checkBackup(backup);
    expect(check.ok).toBe(true);
    await reset();
    await restoreBackup(check.backup!);
    expect(await db.sessions.count()).toBe(counts.s);
    expect(await db.attempts.count()).toBe(counts.a);
    expect(await db.repairs.count()).toBe(counts.r);
    const f = (await db.files.get('f1'))!;
    expect(f.blob.size).toBe(3);

    const bad = JSON.parse(JSON.stringify(backup));
    bad.tables.attempts[0].marksEarned = 99;
    expect(checkBackup(bad).ok).toBe(false);
    expect(checkBackup({ ...backup, schemaVersion: 999 }).errors[0]).toMatch(/newer version/);
    expect(checkBackup({ hello: 1 }).ok).toBe(false);
    const orphan = JSON.parse(JSON.stringify(backup));
    orphan.tables.attempts = [];
    expect(checkBackup(orphan).ok).toBe(false);
  });
});
