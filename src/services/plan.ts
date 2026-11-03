import { db } from '@/db/db';
import { SUBJECTS, TEMPLATE_BY_ID, templateMinutes } from '@/data/catalog';
import { computeMastery, masteryMap } from '@/domain/mastery';
import { generatePlan, makeSession, freeOn, regeneratePlan, type PlanContext } from '@/scheduling/engine';
import {
  applyPlacement, carryPriority, carryQueue, isBacklogged, makeQuickCheck, proposePlacement, reconcile, remainingMinutes, type Placement
} from '@/scheduling/carryover';
import type { ISODate, PaceMode, PlanConfig, StudentProfile, StudySession, SubjectId } from '@/types';
import { addDays, fmtShort, localDate, nowISO } from '@/utils/dates';
import { addNotices, defaultConfig, getConfig, getMeta, log, setMeta, uid } from './meta';

/** First run: seed confirmed facts only. Safe to call on every start. */
export async function initialiseDatabase() {
  await db.transaction('rw', db.subjects, db.meta, async () => {
    if ((await db.subjects.count()) === 0) await db.subjects.bulkPut(SUBJECTS);
    if (!(await db.meta.get('config'))) await db.meta.put({ key: 'config', value: defaultConfig() });
    if (!(await db.meta.get('profile'))) {
      const p: StudentProfile = { displayName: 'Zaara', timezone: 'Asia/Dhaka', setupComplete: false, createdAt: nowISO() };
      await db.meta.put({ key: 'profile', value: p });
    }
  });
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => undefined);
}

export async function loadContext(existing?: StudySession[]): Promise<PlanContext> {
  const [config, subjects, topics, exams, attempts, sessions] = await Promise.all([
    getConfig(), db.subjects.toArray(), db.topics.toArray(), db.exams.toArray(), db.attempts.toArray(), existing ? Promise.resolve(existing) : db.sessions.toArray()
  ]);
  return {
    config, subjects, topics, exams,
    mastery: masteryMap(topics.map((t) => t.id), attempts),
    existing: sessions,
    idFactory: uid,
    now: nowISO()
  };
}

async function generatedThrough(): Promise<ISODate | undefined> {
  return getMeta<ISODate>('generatedThrough');
}

/** Keep the plan generated `horizonDays` ahead. Never touches existing sessions. */
export async function ensureHorizon(today: ISODate = localDate()) {
  const profile = await getMeta<StudentProfile>('profile');
  if (!profile?.setupComplete) return 0;
  return db.transaction('rw', [db.sessions, db.meta, db.subjects, db.topics, db.exams, db.attempts, db.history], async () => {
    const ctx = await loadContext();
    const target = addDays(today, ctx.config.horizonDays);
    const through = await generatedThrough();
    const from = through && through >= today ? addDays(through, 1) : today;
    if (from > target) return 0;
    const created = generatePlan(ctx, from, target);
    if (created.length) await db.sessions.bulkPut(created);
    await setMeta('generatedThrough', target);
    return created.length;
  });
}

/**
 * Regenerate future suggestions after a planning change (exam dates, hours,
 * topics). Completed, started, moved and hand-edited sessions are preserved.
 */
export async function regenerateFuture(from: ISODate, why: string) {
  return db.transaction('rw', [db.sessions, db.meta, db.subjects, db.topics, db.exams, db.attempts, db.history], async () => {
    const config = await getConfig();
    const next: PlanConfig = { ...config, planVersion: config.planVersion + 1 };
    await setMeta('config', next);
    const ctx = await loadContext();
    const to = addDays(from > localDate() ? from : localDate(), next.horizonDays);
    const { removed, created } = regeneratePlan(ctx, from, to);
    await db.sessions.bulkDelete(removed.map((s) => s.id));
    await db.sessions.bulkPut(created);
    await setMeta('generatedThrough', to);
    await log('plan.regenerate', 'plan', String(next.planVersion), `${why}: replaced ${removed.length} untouched future sessions with ${created.length}.`);
    return { removed: removed.length, created: created.length };
  });
}

export interface MaintenanceResult {
  reconciled: number;
  placed: number;
  unplaced: number;
  reviewsAdded: number;
  created: number;
}

/**
 * Run when the app opens and when the Dhaka date changes.
 * 1) close past days (missed/partial), 2) place carry-over work,
 * 3) extend the horizon, 4) add due retention checks.
 */
export async function dailyMaintenance(today: ISODate = localDate()): Promise<MaintenanceResult> {
  const profile = await getMeta<StudentProfile>('profile');
  if (!profile?.setupComplete) return { reconciled: 0, placed: 0, unplaced: 0, reviewsAdded: 0, created: 0 };
  const res = await db.transaction('rw', [db.sessions, db.meta, db.subjects, db.topics, db.exams, db.attempts, db.history], async () => {
    const now = nowISO();
    const all = await db.sessions.toArray();
    const closed = reconcile(all, today, now);
    if (closed.length) {
      await db.sessions.bulkPut(closed);
      for (const s of closed) await log(`session.${s.status}`, 'session', s.id, `Day ended: ${s.status} (${fmtShort(s.date)})`);
    }
    const config = await getConfig();
    let placed = 0;
    let unplaced = 0;
    if (config.carryOverMode === 'auto') {
      const r = await placeQueue(today, true);
      placed = r.placed;
      unplaced = r.unplaced;
    }
    return { reconciled: closed.length, placed, unplaced };
  });
  const created = await ensureHorizon(today);
  const reviewsAdded = await ensureReviews(today);
  return { ...res, created, reviewsAdded };
}

/** Try to place every carry-over item, most important first. */
export async function placeQueue(today: ISODate, auto: boolean) {
  const config = await getConfig();
  const exams = await db.exams.toArray();
  let all = await db.sessions.toArray();
  const queue = carryQueue(all, today).sort((a, b) => carryPriority(b, today, exams) - carryPriority(a, today, exams));
  let placed = 0;
  let unplaced = 0;
  const notices: Parameters<typeof addNotices>[0] = [];
  const now = nowISO();
  for (const s of queue) {
    const current = all.find((x) => x.id === s.id)!;
    const p = proposePlacement(current, all, config, exams, today);
    if (p.type === 'none') {
      unplaced++;
      continue;
    }
    const subj = SUBJECTS.find((x) => x.id === s.subjectId)?.name ?? s.subjectId;
    const r = applyPlacement(current, p, all, now, `${current.status === 'partial' ? 'Unfinished' : 'Not started'} on ${fmtShort(current.date)}.`, auto);
    await db.sessions.bulkDelete(r.deletes);
    await db.sessions.bulkPut(r.updates);
    all = all.filter((x) => !r.deletes.includes(x.id)).map((x) => r.updates.find((u) => u.id === x.id) ?? x);
    placed++;
    await log('session.carry', 'session', s.id, `${current.date} → ${p.date} (${p.type})`);
    notices.push({
      date: today,
      kind: 'moved',
      sessionId: s.id,
      text: `${fmtShort(current.date)}'s ${subj} ${current.status === 'partial' ? 'session wasn’t finished' : 'session wasn’t started'}. I've kept it and moved it to ${fmtShort(p.date)}.`
    });
  }
  await addNotices(notices);
  return { placed, unplaced };
}

/** Preview the placement for one carry item (used by the "Ask first" mode and the queue UI). */
export async function previewPlacement(id: string, today: ISODate): Promise<Placement> {
  const [config, exams, all] = await Promise.all([getConfig(), db.exams.toArray(), db.sessions.toArray()]);
  const s = all.find((x) => x.id === id);
  if (!s) return { type: 'none', explanation: 'Session not found.' };
  return proposePlacement(s, all, config, exams, today);
}

export async function placeOne(id: string, today: ISODate) {
  return db.transaction('rw', [db.sessions, db.meta, db.history, db.exams], async () => {
    const [config, exams, all] = await Promise.all([getConfig(), db.exams.toArray(), db.sessions.toArray()]);
    const s = all.find((x) => x.id === id);
    if (!s) return null;
    const p = proposePlacement(s, all, config, exams, today);
    const r = applyPlacement(s, p, all, nowISO(), 'Rescheduled by you.', false);
    await db.sessions.bulkDelete(r.deletes);
    await db.sessions.bulkPut(r.updates);
    await log('session.carry', 'session', id, `manual placement: ${p.type}`);
    return p;
  });
}

async function mutate(id: string, fn: (s: StudySession) => StudySession, action: string, detail: string) {
  return db.transaction('rw', db.sessions, db.history, async () => {
    const s = await db.sessions.get(id);
    if (!s) throw new Error('Session not found');
    const next = { ...fn(s), updatedAt: nowISO() };
    await db.sessions.put(next);
    await log(action, 'session', id, detail);
    return next;
  });
}

/** Manual move. History of the original date is kept in `moves`. */
export async function moveSession(id: string, to: ISODate, reason = 'Moved by you.') {
  return mutate(
    id,
    (s) => {
      if (s.status === 'completed') throw new Error('Completed sessions stay where they happened.');
      const order = 999;
      return {
        ...s,
        date: to,
        order,
        pinned: true,
        status: s.completedActivities.length ? 'in_progress' : 'planned',
        moves: s.date === to ? s.moves : [...s.moves, { from: s.date, to, at: nowISO(), reason, auto: false }]
      };
    },
    'session.move',
    `→ ${to}`
  );
}

export async function doToday(id: string, today: ISODate) {
  return moveSession(id, today, 'Brought into today by you.');
}

export async function setPlannedMode(id: string, mode: PaceMode) {
  return mutate(id, (s) => ({ ...s, plannedMode: mode, plannedMinutes: templateMinutes(s.templateId, mode), pinned: true }), 'session.duration', mode);
}

export async function setTopics(id: string, topicIds: string[]) {
  return mutate(id, (s) => ({ ...s, topicIds, pinned: true }), 'session.topic', topicIds.join(','));
}

export async function setTemplate(id: string, templateId: string) {
  return mutate(
    id,
    (s) => {
      if (s.completedActivities.length) throw new Error('This session has started; finish or skip it instead.');
      const t = TEMPLATE_BY_ID[templateId];
      return { ...s, templateId, purpose: t.purpose, plannedMinutes: templateMinutes(templateId, s.plannedMode), pinned: true };
    },
    'session.template',
    templateId
  );
}

export async function reorderDay(ids: string[]) {
  await db.transaction('rw', db.sessions, async () => {
    for (let i = 0; i < ids.length; i++) await db.sessions.update(ids[i], { order: i, pinned: true });
  });
}

export async function skipSession(id: string, reason: string) {
  if (!reason.trim()) throw new Error('A short reason helps you plan later.');
  return mutate(id, (s) => ({ ...s, status: 'skipped', skipReason: reason.trim() }), 'session.skip', reason);
}

/** Replace a missed session with a 15-minute retrieval check (keeps the original in history). */
export async function quickCheckInstead(id: string, today: ISODate) {
  return db.transaction('rw', [db.sessions, db.meta, db.history, db.exams], async () => {
    const [config, exams, all] = await Promise.all([getConfig(), db.exams.toArray(), db.sessions.toArray()]);
    const s = all.find((x) => x.id === id);
    if (!s) throw new Error('Session not found');
    const days = [today, addDays(today, 1), addDays(today, 2)];
    const date = days.find((d) => freeOn(config, all, exams, d) >= 15) ?? today;
    const qc = makeQuickCheck(s, uid(), date, nowISO(), config.planVersion);
    await db.sessions.put(qc);
    await db.sessions.put({ ...s, status: 'converted', replacementId: qc.id, updatedAt: nowISO() });
    await log('session.convert', 'session', id, `Replaced by quick check on ${date}`);
    return qc;
  });
}

export async function addManualSession(input: { date: ISODate; subjectId: SubjectId; templateId: string; mode: PaceMode; topicIds: string[]; note?: string }) {
  const config = await getConfig();
  const s = makeSession(
    { id: uid(), date: input.date, subjectId: input.subjectId, templateId: input.templateId, plannedMode: input.mode, topicIds: input.topicIds, source: 'manual', pinned: true, order: 999, note: input.note, reason: 'Added by you.' },
    nowISO(),
    config.planVersion
  );
  await db.sessions.put(s);
  await log('session.add', 'session', s.id, `${input.subjectId} on ${input.date}`);
  return s;
}

/**
 * Rest day: today's untouched sessions are re-placed from tomorrow.
 * Nothing is marked complete. Anything that can't be placed stays on today
 * and enters the carry-over queue tomorrow.
 */
export async function takeRestDay(today: ISODate) {
  return db.transaction('rw', [db.sessions, db.meta, db.history, db.exams], async () => {
    const [config, exams] = await Promise.all([getConfig(), db.exams.toArray()]);
    let all = await db.sessions.toArray();
    const todays = all.filter((s) => s.date === today && s.status === 'planned' && !s.completedActivities.length);
    let moved = 0;
    for (const s of todays) {
      const p = proposePlacement(s, all, config, exams, today, addDays(today, 1));
      if (p.type === 'none') continue;
      const r = applyPlacement(s, p, all, nowISO(), 'Rest day.', false);
      await db.sessions.bulkDelete(r.deletes);
      await db.sessions.bulkPut(r.updates);
      all = all.filter((x) => !r.deletes.includes(x.id)).map((x) => r.updates.find((u) => u.id === x.id) ?? x);
      moved++;
    }
    const rest = ((await getMeta<ISODate[]>('restDays')) ?? []).filter((d) => d !== today);
    await setMeta('restDays', [...rest, today]);
    await log('day.rest', 'day', today, `Rest day; ${moved}/${todays.length} sessions re-placed.`);
    return { moved, total: todays.length };
  });
}

/**
 * Retention checks: when a topic's evidence says a review is due within the
 * next 14 days, add a short unseen-retest session (once).
 */
export async function ensureReviews(today: ISODate) {
  const profile = await getMeta<StudentProfile>('profile');
  if (!profile?.setupComplete) return 0;
  return db.transaction('rw', [db.sessions, db.meta, db.topics, db.attempts, db.exams, db.history], async () => {
    const [config, exams, topics, attempts] = await Promise.all([getConfig(), db.exams.toArray(), db.topics.toArray(), db.attempts.toArray()]);
    let all = await db.sessions.toArray();
    let added = 0;
    for (const t of topics) {
      const ta = attempts.filter((a) => a.topicId === t.id);
      if (!ta.length) continue;
      const m = computeMastery(ta);
      if (!m.nextReviewDate || (m.state !== 'amber' && m.state !== 'green')) continue;
      const due = m.nextReviewDate < today ? today : m.nextReviewDate;
      if (due > addDays(today, 14)) continue;
      const latest = ta.map((a) => a.date).sort().at(-1)!;
      const exists = all.some(
        (s) => (s.source === 'review' || s.source === 'retest') && s.topicIds.includes(t.id) && s.date > latest && s.status !== 'skipped'
      );
      if (exists) continue;
      const days = [due, addDays(due, 1), addDays(due, 2)];
      const date = days.find((d) => freeOn(config, all, exams, d) >= 25) ?? due;
      const s = makeSession(
        {
          id: uid(), date, subjectId: t.subjectId, templateId: 'retest', topicIds: [t.id], source: 'review', order: 50,
          reason: m.provisional ? 'Retention check: confirms a strong result from last week.' : m.state === 'green' ? 'Spaced review to keep this topic Secure.' : 'Unseen retest to measure progress.'
        },
        nowISO(),
        config.planVersion
      );
      await db.sessions.put(s);
      all = [...all, s];
      added++;
    }
    return added;
  });
}

export async function carryOverview(today: ISODate) {
  const [config, exams, all] = await Promise.all([getConfig(), db.exams.toArray(), db.sessions.toArray()]);
  const queue = carryQueue(all, today).sort((a, b) => carryPriority(b, today, exams) - carryPriority(a, today, exams));
  const proposals = queue.map((s) => ({ session: s, placement: proposePlacement(s, all, config, exams, today), minutes: remainingMinutes(s) }));
  const unplaced = proposals.filter((p) => p.placement.type === 'none').length;
  const minutes = proposals.reduce((t, p) => t + p.minutes, 0);
  return { proposals, backlog: isBacklogged(unplaced, minutes, config), minutes };
}

export async function saveConfig(patch: Partial<PlanConfig>, regenerateFrom?: ISODate, why = 'Planning change') {
  const config = await getConfig();
  await setMeta('config', { ...config, ...patch });
  if (regenerateFrom) {
    const today = localDate();
    return regenerateFuture(regenerateFrom < today ? today : regenerateFrom, why);
  }
}
