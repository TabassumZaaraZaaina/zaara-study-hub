import { db } from '@/db/db';
import { activitiesFor } from '@/data/catalog';
import { makeFollowup, needsFollowup, proposePlacement, applyPlacement } from '@/scheduling/carryover';
import { pickRetestDate } from '@/domain/repair';
import { makeSession } from '@/scheduling/engine';
import type { ISODate, PaceMode, StudySession } from '@/types';
import { addDays, fmtShort, nowISO } from '@/utils/dates';
import { addNotices, getConfig, log, uid } from './meta';

const TABLES = () => [db.sessions, db.meta, db.history, db.exams, db.repairs];

/** Start (or resume) a session in a chosen mode. Progress is kept when switching mode. */
export async function startSession(id: string, mode: PaceMode) {
  return db.transaction('rw', db.sessions, db.history, async () => {
    const s = await db.sessions.get(id);
    if (!s) throw new Error('Session not found');
    if (s.status === 'completed') return s;
    const keys = new Set(activitiesFor(s.templateId, mode).map((a) => a.key));
    const next: StudySession = {
      ...s,
      mode,
      status: 'in_progress',
      completedActivities: s.completedActivities.filter((k) => keys.has(k)),
      startedAt: s.startedAt ?? nowISO(),
      updatedAt: nowISO()
    };
    await db.sessions.put(next);
    if (s.mode !== mode) await log('session.start', 'session', id, `mode ${mode}`);
    return next;
  });
}

/** Idempotent: completing an activity twice has no extra effect. */
export async function setActivityDone(id: string, key: string, done: boolean) {
  return db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id);
    if (!s || s.status === 'completed') return s;
    const set = new Set(s.completedActivities);
    if (done) set.add(key);
    else set.delete(key);
    const next = { ...s, completedActivities: [...set], updatedAt: nowISO(), status: s.status === 'planned' ? 'in_progress' : s.status } as StudySession;
    await db.sessions.put(next);
    return next;
  });
}

/** Add focused minutes (from the session timer). Negative values are ignored. */
export async function addFocusMinutes(id: string, minutes: number) {
  if (!(minutes > 0)) return;
  await db.sessions.where('id').equals(id).modify((s) => {
    s.actualMinutes = Math.min(600, (s.actualMinutes || 0) + Math.round(minutes));
  });
}

export interface CompletionResult {
  session: StudySession;
  followup?: StudySession;
  retest?: StudySession;
}

/**
 * Complete a session in its chosen mode. If an essential objective was only
 * covered at Light intensity, a Steady follow-up is planned (not duplicated).
 */
export async function completeSession(id: string, today: ISODate): Promise<CompletionResult> {
  return db.transaction('rw', TABLES(), async () => {
    const s = await db.sessions.get(id);
    if (!s) throw new Error('Session not found');
    if (s.status === 'completed') return { session: s };
    const mode = s.mode ?? s.plannedMode;
    const acts = activitiesFor(s.templateId, mode);
    const doneMinutes = acts.filter((a) => s.completedActivities.includes(a.key)).reduce((t, a) => t + a.minutes, 0);
    const done: StudySession = {
      ...s,
      mode,
      status: 'completed',
      completedAt: nowISO(),
      actualMinutes: s.actualMinutes || doneMinutes,
      updatedAt: nowISO()
    };
    const result: CompletionResult = { session: done };
    const config = await getConfig();
    const exams = await db.exams.toArray();

    if (needsFollowup(done) && !done.followupId) {
      let all = await db.sessions.toArray();
      const f = makeFollowup(done, uid(), addDays(today, 1), nowISO(), config.planVersion);
      all = [...all.filter((x) => x.id !== done.id), done, f];
      const p = proposePlacement(f, all, config, exams, today, addDays(today, 1));
      let placed = f;
      if (p.type !== 'none') {
        const r = applyPlacement(f, p, all, nowISO(), '', true);
        await db.sessions.bulkDelete(r.deletes);
        for (const u of r.updates) await db.sessions.put(u.id === f.id ? { ...u, moves: [] } : u);
        placed = { ...r.updates.find((u) => u.id === f.id)!, moves: [] };
      } else await db.sessions.put(f);
      done.followupId = placed.id;
      result.followup = placed;
      await addNotices([{ date: today, kind: 'followup', sessionId: placed.id, text: `Light session saved. The main practice is planned for ${fmtShort(placed.date)}.` }]);
    }

    if (done.source === 'repair' && done.repairId) {
      const repair = await db.repairs.get(done.repairId);
      if (repair && !repair.retestSessionId) {
        const all = await db.sessions.toArray();
        const date = pickRetestDate(today, all, config, exams);
        const retest = makeSession(
          { id: uid(), date, subjectId: done.subjectId, templateId: 'retest', topicIds: done.topicIds, source: 'retest', repairId: repair.id, order: 40, reason: 'Unseen retest after your repair session.' },
          nowISO(),
          config.planVersion
        );
        await db.sessions.put(retest);
        await db.repairs.put({ ...repair, status: 'retest-scheduled', retestSessionId: retest.id });
        result.retest = retest;
      }
    }
    await db.sessions.put(done);
    await log('session.complete', 'session', id, `mode ${mode}`);
    return result;
  });
}
