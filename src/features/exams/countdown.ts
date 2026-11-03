import { MILESTONES } from '@/data/catalog';
import type { Exam, ISODate, Subject, SubjectId } from '@/types';
import { diffDays } from '@/utils/dates';

/** The headline countdown. Uses entered paper dates first; otherwise confirmed milestones only. */
export function nextMilestone(today: ISODate, exams: Exam[], subjects: Record<SubjectId, Subject>): { text: string; days: number | null } | null {
  const next = exams.filter((e) => e.date && e.date >= today).sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];
  const mock = MILESTONES.find((m) => m.id === 'mock2')!;
  if (mock.startDate && today < mock.startDate && (!next || next.date! >= mock.startDate)) {
    const d = diffDays(today, mock.startDate);
    return { text: `Mock 2 starts in ${d} day${d === 1 ? '' : 's'}`, days: d };
  }
  if (next) {
    const d = diffDays(today, next.date!);
    const label = `${subjects[next.subjectId]?.shortName ?? ''} ${next.group === 'mock2' ? 'mock' : 'exam'}`.trim();
    return { text: d === 0 ? `${label} today` : d === 1 ? `${label} tomorrow` : `${label} in ${d} days`, days: d };
  }
  if (mock.startDate && today >= mock.startDate && exams.every((e) => e.group !== 'mock2' || !e.date)) {
    return { text: 'Mock 2 is under way — add paper dates', days: null };
  }
  return { text: 'Finals: May/June 2027 — dates to be added', days: null };
}
