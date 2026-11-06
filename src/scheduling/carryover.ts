/**
 * Missed-work handling — pure functions.
 *
 * End of day (reconcile): planned/in-progress sessions on past dates become
 *   `missed` (nothing done) or `partial` (some activities done). Their date,
 *   progress and originalDate are preserved. Nothing is marked complete.
 *
 * Carry-over queue: essential missed/partial sessions on past dates.
 *
 * Placement (proposePlacement), in order of preference:
 *   1. FREE  — a day in the window with enough spare capacity (no disruption).
 *   2. SHIFT — take the next untouched same-subject slot in the window; that
 *              subject's later topics each move back one slot. No extra hours
 *              are added; the subject's sequence simply slides.
 *   3. NONE  — no realistic place: stays in the queue for the student to decide
 *              (do today anyway, quick check, pick a date, or drop with reason).
 * Window: today … min(today + 7, day before the subject's next known exam).
 */
import type { Exam, ISODate, PlanConfig, StudySession } from '@/types';
import { sessionActivities, templateMinutes } from '@/data/catalog';
import { addDays, dateRange, diffDays, fmtShort } from '@/utils/dates';
import { PRIORITY, freeOn, nextExamFor, isReplaceable, makeSession, occupies } from './engine';

export const CARRY_STATUSES: StudySession['status'][] = ['missed', 'partial'];

export function reconcile(sessions: StudySession[], today: ISODate, now: string): StudySession[] {
  const changed: StudySession[] = [];
  for (const s of sessions) {
    if (s.date < today && (s.status === 'planned' || s.status === 'in_progress')) {
      changed.push({ ...s, status: s.completedActivities.length ? 'partial' : 'missed', updatedAt: now });
    }
  }
  return changed;
}

export function carryQueue(sessions: StudySession[], today: ISODate): StudySession[] {
  return sessions
    .filter((s) => s.date < today && s.essential && CARRY_STATUSES.includes(s.status))
    .sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
}

export function remainingMinutes(s: StudySession): number {
  const mode = s.mode ?? s.plannedMode;
  const acts = sessionActivities(s, mode);
  const left = acts.filter((a) => !s.completedActivities.includes(a.key)).reduce((t, a) => t + a.minutes, 0);
  return left || s.plannedMinutes;
}

/** Priority for ordering the carry queue (higher first). Transparent and documented. */
export function carryPriority(s: StudySession, today: ISODate, exams: Exam[]): number {
  const target = nextExamFor(s.subjectId, today, exams);
  let score = 0;
  if (target.date) score += Math.max(0, 30 - diffDays(today, target.date)); // proximity
  if (target.inPeriodUnknown) score += 15;
  score += { mock: 12, repair: 12, retest: 10, exam: 8, practice: 6, learn: 5, quick: 1 }[s.purpose] ?? 0;
  if (s.status === 'partial') score += 2; // already started, cheaper to finish
  return score;
}

export type Placement =
  | { type: 'free'; date: ISODate; explanation: string }
  | { type: 'shift'; date: ISODate; displacedId: string; chainIds: string[]; explanation: string }
  | { type: 'none'; explanation: string };

export function carryWindow(s: Pick<StudySession, 'subjectId'>, today: ISODate, exams: Exam[], fromDate: ISODate = today): ISODate[] {
  const target = nextExamFor(s.subjectId, today, exams);
  let end = addDays(fromDate, PRIORITY.carryWindowDays);
  if (target.date && !target.approximate) {
    const dayBefore = addDays(target.date, -1);
    if (dayBefore < end) end = dayBefore;
  }
  if (end < fromDate) end = fromDate;
  return dateRange(fromDate, end);
}

export function proposePlacement(
  s: StudySession,
  all: StudySession[],
  config: PlanConfig,
  exams: Exam[],
  today: ISODate,
  fromDate: ISODate = today
): Placement {
  const need = remainingMinutes(s);
  const days = carryWindow(s, today, exams, fromDate);
  const others = all.filter((x) => x.id !== s.id);

  // 1. FREE capacity — prefer days without this subject already.
  const freeDays = days.filter((d) => freeOn(config, others, exams, d) >= need);
  const preferred = freeDays.find((d) => !others.some((x) => x.date === d && x.subjectId === s.subjectId && occupies(x))) ?? freeDays[0];
  if (preferred) {
    return { type: 'free', date: preferred, explanation: `${fmtShort(preferred)} had ${freeOn(config, others, exams, preferred)} free minutes.` };
  }

  // 2. SHIFT into the next untouched same-subject slot (not for home mocks:
  //    a 2-hour paper can't take a 90-minute slot).
  if (s.source === 'homemock') return { type: 'none', explanation: `No day before the next deadline has ${need} free minutes for this paper.` };
  const chain = others
    .filter((x) => x.subjectId === s.subjectId && isReplaceable(x, fromDate) && x.purpose !== 'exam')
    .sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
  const first = chain[0];
  if (first && days.includes(first.date)) {
    return {
      type: 'shift',
      date: first.date,
      displacedId: first.id,
      chainIds: chain.map((c) => c.id),
      explanation: `Took ${fmtShort(first.date)}'s slot for this subject; later topics each move back one session.`
    };
  }
  return { type: 'none', explanation: 'No free time before the next deadline without adding extra hours.' };
}

export interface PlacementResult {
  updates: StudySession[];
  deletes: string[];
}

/** Apply a placement. Returns records to put and ids to delete. Never marks completion. */
export function applyPlacement(s: StudySession, p: Placement, all: StudySession[], now: string, reason: string, auto: boolean): PlacementResult {
  if (p.type === 'none') return { updates: [], deletes: [] };
  const fromDate = s.date;
  if (p.type === 'free') {
    const order = all.filter((x) => x.date === p.date && x.id !== s.id).reduce((m, x) => Math.max(m, x.order + 1), 0);
    return {
      updates: [
        {
          ...s,
          date: p.date,
          order,
          status: s.completedActivities.length ? 'in_progress' : 'planned',
          moves: [...s.moves, { from: fromDate, to: p.date, at: now, reason: `${reason} ${p.explanation}`.trim(), auto }],
          updatedAt: now
        }
      ],
      deletes: []
    };
  }
  // SHIFT: s takes chain[0]'s slot; each later chain session takes its predecessor's topics.
  const byId = new Map(all.map((x) => [x.id, x]));
  const chain = p.chainIds.map((id) => byId.get(id)!).filter(Boolean);
  const head = chain[0];
  const updates: StudySession[] = [];
  for (let i = chain.length - 1; i >= 1; i--) {
    updates.push({ ...chain[i], topicIds: chain[i - 1].topicIds, updatedAt: now, note: chain[i - 1].topicIds.length ? 'Topic moved back one session after a missed session.' : chain[i].note });
  }
  // If the slot is shorter (e.g. a Steady slot), take on its length so the day gets
  // no extra minutes; if it's longer, keep the session's own length.
  const slotMinutes = templateMinutes(s.templateId, head.plannedMode) || head.plannedMinutes;
  const shrink = slotMinutes < s.plannedMinutes;
  updates.push({
    ...s,
    plannedMode: shrink ? head.plannedMode : s.plannedMode,
    plannedMinutes: shrink ? slotMinutes : s.plannedMinutes,
    date: head.date,
    order: head.order,
    status: s.completedActivities.length ? 'in_progress' : 'planned',
    moves: [...s.moves, { from: fromDate, to: head.date, at: now, reason: `${reason} ${p.explanation}`.trim(), auto }],
    updatedAt: now
  });
  return { updates, deletes: [head.id] };
}

/** Backlog = carry items with nowhere realistic to go, or too much carried work overall. */
export function isBacklogged(unplacedCount: number, carriedMinutes: number, config: PlanConfig): boolean {
  const avgDay = config.capacity.reduce((a, b) => a + b, 0) / 7;
  return unplacedCount >= config.backlogThreshold || carriedMinutes > avgDay * 2;
}

/**
 * When an essential learning session is finished in Light mode, the core
 * objective is still outstanding. Create a Steady follow-up (45 min) to
 * be placed by the normal placement rules.
 */
export function needsFollowup(s: StudySession): boolean {
  return s.essential && s.mode === 'light' && (s.purpose === 'learn' || s.purpose === 'practice' || s.purpose === 'exam');
}

export function makeFollowup(s: StudySession, id: string, date: ISODate, now: string, planVersion: number): StudySession {
  return makeSession(
    {
      id,
      date,
      subjectId: s.subjectId,
      templateId: s.templateId,
      topicIds: s.topicIds,
      plannedMode: 'steady',
      source: 'followup',
      parentSessionId: s.id,
      reason: `Follow-up: the ${fmtShort(s.date)} session was done as a Light recall, so the main practice is still to do.`
    },
    now,
    planVersion
  );
}

export function makeQuickCheck(s: StudySession, id: string, date: ISODate, now: string, planVersion: number): StudySession {
  return makeSession(
    {
      id,
      date,
      subjectId: s.subjectId,
      templateId: 'quick-check',
      topicIds: s.topicIds,
      plannedMode: 'full',
      plannedMinutes: templateMinutes('quick-check', 'full'),
      source: 'quickcheck',
      essential: false,
      parentSessionId: s.id,
      reason: `Short retrieval check replacing the missed ${fmtShort(s.date)} session.`
    },
    now,
    planVersion
  );
}
