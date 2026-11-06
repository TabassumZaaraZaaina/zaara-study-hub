/**
 * Zaara's papers in the Cambridge O Level June 2027 series, Administrative Zone 4,
 * taken from the official Cambridge Final Exam Timetable (June 2027, zone 4).
 * Practical subjects: she sits Paper 3 (Practical Test), not Paper 4.
 */
import type { Exam, SubjectId } from '@/types';

type Row = [code: string, subjectId: SubjectId, paperId: string, label: string, date: string, session: 'AM' | 'PM', minutes: number];

export const FINALS_2027: Row[] = [
  ['3204/01', 'bangla', 'p1', 'Paper 1 — Composition', '2027-04-26', 'PM', 120],
  ['5070/22', 'chemistry', 'p2', 'Paper 2 — Theory', '2027-04-27', 'AM', 105],
  ['4024/12', 'mathd', 'p1', 'Paper 1 — Non-calculator', '2027-04-28', 'PM', 120],
  ['1123/22', 'english', 'p2', 'Paper 2 — Writing', '2027-04-29', 'AM', 120],
  ['3204/02', 'bangla', 'p2', 'Paper 2 — Language Usage and Comprehension', '2027-04-30', 'PM', 90],
  ['5054/22', 'physics', 'p2', 'Paper 2 — Theory', '2027-05-03', 'AM', 105],
  ['4024/22', 'mathd', 'p2', 'Paper 2 — Calculator', '2027-05-05', 'PM', 120],
  ['1123/12', 'english', 'p1', 'Paper 1 — Reading', '2027-05-06', 'AM', 120],
  ['5070/32', 'chemistry', 'p3', 'Paper 3 — Practical Test', '2027-05-13', 'AM', 90],
  ['4037/12', 'addmath', 'p1', 'Paper 1 — Non-calculator', '2027-05-18', 'AM', 120],
  ['5054/32', 'physics', 'p3', 'Paper 3 — Practical Test', '2027-05-25', 'AM', 90],
  ['2281/22', 'economics', 'p2', 'Paper 2 — Structured Questions', '2027-05-26', 'AM', 120],
  ['4037/22', 'addmath', 'p2', 'Paper 2 — Calculator', '2027-05-27', 'AM', 120],
  ['5054/12', 'physics', 'p1', 'Paper 1 — Multiple Choice', '2027-06-09', 'AM', 60],
  ['5070/12', 'chemistry', 'p1', 'Paper 1 — Multiple Choice', '2027-06-10', 'AM', 60],
  ['2281/12', 'economics', 'p1', 'Paper 1 — Multiple Choice', '2027-06-11', 'AM', 60]
];

export const finalsExams = (): Exam[] =>
  FINALS_2027.map(([code, subjectId, , label, date, session, minutes]) => ({
    id: `final-2027-${code.replace('/', '-')}`,
    group: 'final',
    subjectId,
    paper: `${label} (${code}) · ${session}`,
    date,
    startTime: null,
    durationMinutes: minutes,
    coverageTopicIds: [],
    notes: `${session === 'AM' ? 'Morning' : 'Afternoon'} session. Official Cambridge timetable, June 2027, zone 4.`,
    status: 'scheduled'
  }));
