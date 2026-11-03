/**
 * ZAARA scheduling engine — pure functions, no I/O.
 *
 * Priority model (transparent, configurable via PRIORITY):
 *   subjectPriority = weight × urgency(daysToExam) × weakFactor
 *   - weight: per-subject planning weight (Planning settings)
 *   - urgency: step function of days to that subject's next exam
 *   - weakFactor: 1 + WEAK_STEP × (#topics currently "Needs practice"), capped
 * Subjects are chosen by weighted fair queuing: the candidate with the lowest
 * (recent minutes ÷ priority) gets the next slot. This keeps every subject in
 * rotation while giving more time to urgent/weak subjects.
 *
 * These weights are design heuristics, not validated science. They are kept in
 * one object so they can be inspected and tuned.
 */
import { EXAM_CYCLE, MILESTONES, SUBJECT_CYCLE, TEMPLATE_BY_ID, templateMinutes } from '@/data/catalog';
import type { Exam, ISODate, MasteryState, PaceMode, PlanConfig, SessionTemplate, StudySession, Subject, SubjectId, Topic } from '@/types';
import { addDays, dateRange, diffDays, weekday } from '@/utils/dates';

export const PRIORITY = {
  urgencyTiers: [
    { withinDays: 3, factor: 3 },
    { withinDays: 7, factor: 2.2 },
    { withinDays: 14, factor: 1.6 },
    { withinDays: 28, factor: 1.25 }
  ],
  /** When an exam period has started but this subject's paper date is unknown. */
  unknownDateInPeriodFactor: 1.6,
  weakStep: 0.12,
  weakCap: 0.5,
  /** Penalty multiplier on virtual time for back-to-back demanding subjects. */
  demandingStackPenalty: 1.35,
  /** Days before an exam when the subject switches to exam-focused sessions. */
  examFocusDays: 10,
  /** A subject with a known paper this close gets a session every day. */
  examWeekDays: 7,
  /** Recent window used to measure each subject's share of time. */
  fairnessWindowDays: 14,
  /**
   * ASSUMPTION used only while no Mock 2 paper dates are entered: the mock
   * period is treated as lasting this many days from its confirmed start.
   * Without this, the plan would stay in exam mode indefinitely.
   */
  assumedMockWindowDays: 14,
  /** On an exam day, study capacity is reduced to this fraction. */
  examDayCapacity: 0.5,
  /** Carry-over search window when no exam is sooner. */
  carryWindowDays: 7
};

/** Statuses that occupy time on their date. */
export const OCCUPYING: StudySession['status'][] = ['planned', 'in_progress', 'completed', 'partial', 'missed'];
export const occupies = (s: StudySession) => OCCUPYING.includes(s.status);

// ───────────────────────── capacity ─────────────────────────

export function examsOn(exams: Exam[], date: ISODate) {
  return exams.filter((e) => e.date === date);
}

export function baseCapacity(config: PlanConfig, date: ISODate): number {
  if (config.unavailable.some((u) => date >= u.start && date <= u.end)) return 0;
  const wd = weekday(date);
  let cap = config.capacity[wd] ?? 0;
  for (const c of config.commitments) if (c.weekday === wd) cap -= c.minutes;
  return Math.max(0, cap);
}

export function dayCapacity(config: PlanConfig, date: ISODate, exams: Exam[]): number {
  const cap = baseCapacity(config, date);
  if (examsOn(exams, date).length) return Math.floor((cap * PRIORITY.examDayCapacity) / 15) * 15;
  return cap;
}

export function loadOn(sessions: StudySession[], date: ISODate, excludeId?: string): number {
  return sessions.filter((s) => s.date === date && occupies(s) && s.id !== excludeId).reduce((t, s) => t + s.plannedMinutes, 0);
}

export function freeOn(config: PlanConfig, sessions: StudySession[], exams: Exam[], date: ISODate, excludeId?: string) {
  return dayCapacity(config, date, exams) - loadOn(sessions, date, excludeId);
}

// ───────────────────────── exam proximity ─────────────────────────

export interface ExamTarget {
  date: ISODate | null;
  /** True when the target is the confirmed period start, not a known paper date. */
  approximate: boolean;
  label: string;
  inPeriodUnknown: boolean;
}

/**
 * The next exam that matters for a subject on a given date.
 * Uses entered paper dates first. If no Mock 2 paper date is entered yet, the
 * confirmed Mock 2 start date is used as a conservative target.
 */
export function nextExamFor(subjectId: SubjectId, date: ISODate, exams: Exam[]): ExamTarget {
  const dated = exams
    .filter((e) => e.subjectId === subjectId && e.date && e.date >= date)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const mock = MILESTONES.find((m) => m.id === 'mock2')!;
  const subjectMock = exams.filter((e) => e.subjectId === subjectId && e.group === 'mock2');
  const mockAllDone = subjectMock.length > 0 && subjectMock.every((e) => e.date && e.date < date);
  const mockUnknown = subjectMock.length === 0 || subjectMock.some((e) => !e.date);

  if (dated.length) {
    const e = dated[0];
    return { date: e.date, approximate: false, label: `${e.group === 'mock2' ? 'Mock 2' : 'Final'} ${e.paper}`.trim(), inPeriodUnknown: false };
  }
  if (!mockAllDone && mockUnknown && mock.startDate) {
    if (date < mock.startDate) return { date: mock.startDate, approximate: true, label: 'Mock 2 period', inPeriodUnknown: false };
    if (diffDays(mock.startDate, date) < PRIORITY.assumedMockWindowDays) return { date: null, approximate: true, label: 'Mock 2 (date not entered)', inPeriodUnknown: true };
  }
  return { date: null, approximate: true, label: 'Finals (dates not entered)', inPeriodUnknown: false };
}

export function urgencyFactor(target: ExamTarget, date: ISODate): number {
  if (target.inPeriodUnknown) return PRIORITY.unknownDateInPeriodFactor;
  if (!target.date) return 1;
  const d = diffDays(date, target.date);
  for (const tier of PRIORITY.urgencyTiers) if (d <= tier.withinDays) return tier.factor;
  return 1;
}

export function weakFactor(redTopicCount: number): number {
  return 1 + Math.min(PRIORITY.weakCap, PRIORITY.weakStep * redTopicCount);
}

// ───────────────────────── generation ─────────────────────────

export interface PlanContext {
  config: PlanConfig;
  subjects: Subject[];
  topics: Topic[];
  exams: Exam[];
  mastery: Record<string, MasteryState>;
  /** All sessions that already exist (kept). */
  existing: StudySession[];
  idFactory: () => string;
  now: string; // ISO instant for createdAt
}

export interface SubjectPriority {
  subjectId: SubjectId;
  weight: number;
  urgency: number;
  weak: number;
  priority: number;
  target: ExamTarget;
  redTopics: number;
}

export function subjectPriorities(ctx: Pick<PlanContext, 'subjects' | 'topics' | 'exams' | 'mastery'>, date: ISODate): SubjectPriority[] {
  return ctx.subjects
    .filter((s) => s.active)
    .map((s) => {
      const target = nextExamFor(s.id, date, ctx.exams);
      const red = ctx.topics.filter((t) => t.subjectId === s.id && t.active && ctx.mastery[t.id] === 'red').length;
      const urgency = urgencyFactor(target, date);
      const weak = weakFactor(red);
      return { subjectId: s.id, weight: s.weight, urgency, weak, priority: s.weight * urgency * weak, target, redTopics: red };
    });
}

/** Plain-language reason built only from recorded facts. */
export function explainChoice(p: SubjectPriority, date: ISODate, subjectName: string): string {
  const parts: string[] = [];
  if (p.target.date && !p.target.approximate) {
    const d = diffDays(date, p.target.date);
    if (d <= PRIORITY.urgencyTiers[PRIORITY.urgencyTiers.length - 1].withinDays) parts.push(`${p.target.label} is in ${d} day${d === 1 ? '' : 's'}`);
  } else if (p.target.date && p.target.approximate) {
    const d = diffDays(date, p.target.date);
    if (d <= 28) parts.push(`Mock 2 starts in ${d} day${d === 1 ? '' : 's'}`);
  } else if (p.target.inPeriodUnknown) {
    parts.push('Mock 2 is under way and this paper’s date isn’t entered yet');
  }
  if (p.redTopics > 0) parts.push(`${p.redTopics} topic${p.redTopics === 1 ? '' : 's'} marked Needs practice`);
  if (!parts.length) return `Keeps ${subjectName} in your regular rotation.`;
  return `${subjectName} prioritised: ${parts.join('; ')}.`;
}

function pickTemplate(subjectId: SubjectId, target: ExamTarget, date: ISODate, cycleIndex: number): SessionTemplate {
  const near = target.date && diffDays(date, target.date) <= PRIORITY.examFocusDays;
  const cycle = near || target.inPeriodUnknown ? EXAM_CYCLE[subjectId] : SUBJECT_CYCLE[subjectId];
  return TEMPLATE_BY_ID[cycle[cycleIndex % cycle.length]];
}

/** Topics that sessions are planned on: active topics with no active subtopics. */
export function schedulableTopics(topics: Topic[], subjectId: SubjectId): Topic[] {
  const active = topics.filter((t) => t.subjectId === subjectId && t.active);
  const parents = new Set(active.map((t) => t.parentTopicId).filter(Boolean));
  return active.filter((t) => !parents.has(t.id)).sort((a, b) => a.order - b.order);
}

/** Topics eligible for a subject on a date (Mock 2 coverage first, if entered). */
export function eligibleTopics(topics: Topic[], subjectId: SubjectId, date: ISODate, exams: Exam[]): Topic[] {
  const leaves = schedulableTopics(topics, subjectId);
  const target = nextExamFor(subjectId, date, exams);
  const preMock = target.label.startsWith('Mock 2');
  if (preMock) {
    const covered = leaves.filter((t) => t.inMock || (t.parentTopicId && topics.find((p) => p.id === t.parentTopicId)?.inMock));
    if (covered.length) return covered;
  }
  return leaves;
}

const topicScore = (t: Topic, usage: Map<string, number>, mastery: Record<string, MasteryState>) => {
  const m = mastery[t.id];
  return (usage.get(t.id) ?? 0) - (m === 'red' ? 1.5 : m === 'amber' ? 0.5 : 0);
};

/**
 * Choose a topic with interleaving: first the main topic (group of subtopics)
 * that has had the least practice per subtopic, then the least-practised
 * subtopic inside it. Weak topics are pulled forward:
 *   subtopic score = sessions so far − 1.5 (Needs practice) − 0.5 (Developing)
 *   group score    = average subtopic score; ties → syllabus order.
 * This spreads sessions across the whole syllabus instead of working through it
 * front to back — important when an exam covers everything.
 */
export function pickTopic(candidates: Topic[], usage: Map<string, number>, mastery: Record<string, MasteryState>): Topic | null {
  if (!candidates.length) return null;
  const groups = new Map<string, Topic[]>();
  for (const t of candidates) {
    const k = t.parentTopicId ?? t.id;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  let bestGroup: Topic[] | null = null;
  let bestScore = Infinity;
  for (const g of groups.values()) {
    const score = g.reduce((s, t) => s + topicScore(t, usage, mastery), 0) / g.length;
    if (score < bestScore - 1e-9) {
      bestScore = score;
      bestGroup = g;
    }
  }
  let best: Topic | null = null;
  let leafBest = Infinity;
  for (const t of bestGroup!) {
    const sc = topicScore(t, usage, mastery);
    if (sc < leafBest - 1e-9) {
      leafBest = sc;
      best = t;
    }
  }
  return best;
}

/** Slot sizes for a day: Full blocks, then one Steady block if ≥45 min remains. */
export function slotsFor(free: number, block: number): PaceMode[] {
  const out: PaceMode[] = [];
  let f = free;
  while (f >= block) {
    out.push('full');
    f -= block;
  }
  if (f >= 45) out.push('steady');
  return out;
}

export function makeSession(p: Partial<StudySession> & Pick<StudySession, 'id' | 'date' | 'subjectId' | 'templateId'>, now: string, planVersion: number): StudySession {
  const t = TEMPLATE_BY_ID[p.templateId];
  const plannedMode = p.plannedMode ?? 'full';
  return {
    order: 0,
    topicIds: [],
    purpose: t.purpose,
    source: 'plan',
    plannedMode,
    plannedMinutes: templateMinutes(p.templateId, plannedMode),
    mode: null,
    status: 'planned',
    completedActivities: [],
    actualMinutes: 0,
    startedAt: null,
    completedAt: null,
    essential: true,
    pinned: false,
    moves: [],
    planVersion,
    createdAt: now,
    updatedAt: now,
    ...p,
    originalDate: p.originalDate ?? p.date
  } as StudySession;
}

/**
 * Generate plan sessions for [from, to]. Existing sessions are respected:
 * they consume capacity, count towards fairness and topic usage, and are
 * never modified. Returns only NEW sessions.
 */
export function generatePlan(ctx: PlanContext, from: ISODate, to: ISODate): StudySession[] {
  const { config, subjects, exams, mastery } = ctx;
  const start = from < config.planStart ? config.planStart : from;
  if (start > to) return [];
  const created: StudySession[] = [];
  const all = () => [...ctx.existing, ...created];

  // Topic usage across all existing + created sessions.
  const usage = new Map<string, number>();
  for (const s of ctx.existing) if (occupies(s) || s.status === 'skipped') for (const t of s.topicIds) usage.set(t, (usage.get(t) ?? 0) + 1);

  // Cycle position per subject = number of plan sessions before `start`.
  const cycleIdx = new Map<SubjectId, number>();
  for (const s of ctx.existing) if (s.source === 'plan' && s.date < start) cycleIdx.set(s.subjectId, (cycleIdx.get(s.subjectId) ?? 0) + 1);

  const subjectName = (id: SubjectId) => subjects.find((s) => s.id === id)?.name ?? id;

  for (const date of dateRange(start, to)) {
    const free = freeOn(config, all(), exams, date);
    if (free < 45) continue;
    const slots = slotsFor(free, config.blockMinutes);
    if (!slots.length) continue;

    const prios = subjectPriorities(ctx, date);
    const examToday = new Set(examsOn(exams, date).map((e) => e.subjectId));
    const onDay = () => all().filter((s) => s.date === date && occupies(s));
    // Recent minutes per subject (fairness window).
    const windowStart = addDays(date, -PRIORITY.fairnessWindowDays);
    const recent = new Map<SubjectId, number>();
    for (const s of all()) if (s.date >= windowStart && s.date <= date && occupies(s)) recent.set(s.subjectId, (recent.get(s.subjectId) ?? 0) + s.plannedMinutes);

    let order = onDay().reduce((m, s) => Math.max(m, s.order + 1), 0);
    for (const mode of slots) {
      const today = onDay();
      const used = new Set(today.map((s) => s.subjectId));
      let candidates = prios.filter((p) => !used.has(p.subjectId) && !examToday.has(p.subjectId));
      if (!candidates.length) break;

      // Exam week: a subject with a known paper within `examWeekDays` gets a
      // slot every day, soonest exam first (this covers the day before an exam).
      const examWeek = candidates
        .filter((p) => p.target.date && !p.target.approximate && diffDays(date, p.target.date) <= PRIORITY.examWeekDays)
        .sort((a, b) => (a.target.date! < b.target.date! ? -1 : 1));
      const last = [...today].sort((a, b) => a.order - b.order).at(-1);
      const lastDemanding = last ? subjects.find((s) => s.id === last.subjectId)?.demanding : false;
      const vt = (p: SubjectPriority) => {
        let v = ((recent.get(p.subjectId) ?? 0) + 1) / p.priority;
        if (lastDemanding && subjects.find((s) => s.id === p.subjectId)?.demanding) v *= PRIORITY.demandingStackPenalty;
        return v;
      };
      const chosen: SubjectPriority = examWeek[0] ??
        [...candidates].sort((a, b) => {
          const va = vt(a);
          const vb = vt(b);
          return va === vb ? SUBJECT_ORDER(a.subjectId) - SUBJECT_ORDER(b.subjectId) : va - vb;
        })[0];

      const idx = cycleIdx.get(chosen.subjectId) ?? 0;
      const template = pickTemplate(chosen.subjectId, chosen.target, date, idx);
      cycleIdx.set(chosen.subjectId, idx + 1);
      let topicIds: string[] = [];
      if (template.purpose === 'learn' || template.purpose === 'practice' || template.id === 'exam-prep') {
        const topic = pickTopic(eligibleTopics(ctx.topics, chosen.subjectId, date, exams), usage, mastery);
        if (topic) {
          topicIds = [topic.id];
          usage.set(topic.id, (usage.get(topic.id) ?? 0) + 1);
        }
      }
      const s = makeSession(
        {
          id: ctx.idFactory(),
          date,
          order: order++,
          subjectId: chosen.subjectId,
          templateId: template.id,
          topicIds,
          plannedMode: mode,
          reason: explainChoice(chosen, date, subjectName(chosen.subjectId))
        },
        ctx.now,
        config.planVersion
      );
      created.push(s);
      recent.set(chosen.subjectId, (recent.get(chosen.subjectId) ?? 0) + s.plannedMinutes);
    }
  }
  return created;
}

const ORDER: SubjectId[] = ['addmath', 'physics', 'mathd', 'chemistry', 'economics', 'english', 'bangla'];
const SUBJECT_ORDER = (id: SubjectId) => ORDER.indexOf(id);

/**
 * Sessions that plan regeneration may replace: future, plan-generated,
 * untouched and not hand-edited. Everything else is preserved.
 */
export function isReplaceable(s: StudySession, from: ISODate): boolean {
  return (
    s.date >= from &&
    s.source === 'plan' &&
    s.status === 'planned' &&
    !s.pinned &&
    s.completedActivities.length === 0 &&
    s.moves.length === 0 &&
    !s.startedAt
  );
}

export function regeneratePlan(ctx: PlanContext, from: ISODate, to: ISODate) {
  const removed = ctx.existing.filter((s) => isReplaceable(s, from));
  const removedIds = new Set(removed.map((s) => s.id));
  const kept = ctx.existing.filter((s) => !removedIds.has(s.id));
  const created = generatePlan({ ...ctx, existing: kept }, from, to);
  return { removed, created };
}
