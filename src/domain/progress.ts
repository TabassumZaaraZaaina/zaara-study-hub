/**
 * Progress metrics. Four DIFFERENT things are kept apart:
 *  - activity completion (sessions done vs planned)
 *  - syllabus coverage (topics practised at least once / topics listed)
 *  - assessment performance (recent marks)
 *  - demonstrated mastery (evidence-based topic states)
 */
import { activitiesFor } from '@/data/catalog';
import type { AssessmentAttempt, ISODate, MasteryState, StudySession, SubjectId, Topic } from '@/types';
import { pct } from './mastery';

/** Sessions that count toward a day's plan (folded/replaced ones do not double count). */
export const COUNTABLE: StudySession['status'][] = ['planned', 'in_progress', 'completed', 'partial', 'missed', 'skipped'];

/**
 * Progress within a session, measured against the CHOSEN mode's plan.
 * A finished Light session = 100% of Light, not 17% of Full.
 */
export function sessionProgress(s: StudySession): number {
  if (s.status === 'completed') return 1;
  const acts = activitiesFor(s.templateId, s.mode ?? s.plannedMode);
  const total = acts.reduce((t, a) => t + a.minutes, 0);
  if (!total) return 0;
  const done = acts.filter((a) => s.completedActivities.includes(a.key)).reduce((t, a) => t + a.minutes, 0);
  return done / total;
}

export interface DayStats {
  planned: number;
  completed: number;
  remaining: number;
  plannedMinutes: number;
  completedMinutes: number;
}

export function dayStats(sessions: StudySession[], date: ISODate): DayStats {
  const day = sessions.filter((s) => s.date === date && COUNTABLE.includes(s.status));
  const completed = day.filter((s) => s.status === 'completed');
  const skipped = day.filter((s) => s.status === 'skipped').length;
  return {
    planned: day.length,
    completed: completed.length,
    remaining: day.length - completed.length - skipped,
    plannedMinutes: day.reduce((t, s) => t + s.plannedMinutes, 0),
    completedMinutes: completed.reduce((t, s) => t + (s.actualMinutes || 0), 0)
  };
}

export function rangeStats(sessions: StudySession[], from: ISODate, to: ISODate) {
  const r = sessions.filter((s) => s.date >= from && s.date <= to && COUNTABLE.includes(s.status));
  const by = (st: StudySession['status']) => r.filter((s) => s.status === st).length;
  return {
    planned: r.length,
    completed: by('completed'),
    partial: by('partial'),
    missed: by('missed'),
    skipped: by('skipped'),
    upcoming: by('planned') + by('in_progress'),
    plannedMinutes: r.reduce((t, s) => t + s.plannedMinutes, 0),
    modeCounts: {
      full: r.filter((s) => s.status === 'completed' && s.mode === 'full').length,
      steady: r.filter((s) => s.status === 'completed' && s.mode === 'steady').length,
      light: r.filter((s) => s.status === 'completed' && s.mode === 'light').length
    }
  };
}

export interface SubjectSummary {
  subjectId: SubjectId;
  topicsListed: number;
  topicsPractised: number;
  coverage: number | null; // null when no topics are entered
  mastery: Record<MasteryState, number>;
  recentAverage: number | null;
  recentCount: number;
  enoughEvidence: boolean;
  practiceMinutes: number;
}

export function subjectSummary(
  subjectId: SubjectId,
  topics: Topic[],
  sessions: StudySession[],
  attempts: AssessmentAttempt[],
  mastery: Record<string, MasteryState>
): SubjectSummary {
  const active = topics.filter((t) => t.subjectId === subjectId && t.active);
  const parents = new Set(active.map((t) => t.parentTopicId).filter(Boolean));
  const ts = active.filter((t) => !parents.has(t.id)); // subtopics only, so parents don't count twice
  const done = sessions.filter((s) => s.subjectId === subjectId && s.status === 'completed');
  const practised = new Set(done.flatMap((s) => s.topicIds));
  const counts: Record<MasteryState, number> = { unassessed: 0, red: 0, amber: 0, green: 0 };
  for (const t of ts) counts[mastery[t.id] ?? 'unassessed']++;
  const recent = attempts
    .filter((a) => a.subjectId === subjectId)
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
    .slice(0, 5);
  return {
    subjectId,
    topicsListed: ts.length,
    topicsPractised: ts.filter((t) => practised.has(t.id)).length,
    coverage: ts.length ? ts.filter((t) => practised.has(t.id)).length / ts.length : null,
    mastery: counts,
    recentAverage: recent.length ? Math.round(recent.reduce((t, a) => t + pct(a), 0) / recent.length) : null,
    recentCount: recent.length,
    enoughEvidence: recent.length >= 3 && ts.length - counts.unassessed >= 2,
    practiceMinutes: done.reduce((t, s) => t + (s.actualMinutes || 0), 0)
  };
}
