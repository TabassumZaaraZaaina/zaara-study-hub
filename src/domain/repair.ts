import type { AssessmentAttempt, ErrorCategory, ISODate, PlanConfig, Exam, RepairMethod, RepairTask, StudySession } from '@/types';
import { addDays } from '@/utils/dates';
import { freeOn } from '@/scheduling/engine';
import { MASTERY, pct } from './mastery';

export const ERROR_LABEL: Record<ErrorCategory, string> = {
  concept: 'Conceptual misunderstanding',
  memory: 'Memory gap',
  application: 'Application difficulty',
  calculation: 'Calculation error',
  'exam-technique': 'Exam technique',
  misread: 'Misread the question'
};

export const REPAIR_METHODS: Record<RepairMethod, { name: string; steps: string[] }> = {
  'blank-page': {
    name: 'Blank-page reconstruction',
    steps: ['Close all notes.', 'Explain or draw the whole idea from memory on a blank page.', 'Open your notes and mark gaps in a different colour.', 'Redo the page from memory once more.']
  },
  'contrast-predict': {
    name: 'Contrast and predict',
    steps: ['Write two similar situations side by side.', 'Predict what happens in each before checking.', 'Explain the one difference that changes the outcome.']
  },
  'scaffold-transfer': {
    name: 'Scaffold and transfer',
    steps: ['Work through one guided example step by step.', 'Close it.', 'Solve an unfamiliar question of the same type on your own.']
  },
  calculation: {
    name: 'Calculation repair',
    steps: ['Write the formula you need.', 'List each quantity with its unit; convert units.', 'Substitute clearly, then calculate.', 'Find exactly which step went wrong in your original working.']
  },
  'exam-language': {
    name: 'Exam-language repair',
    steps: ['Underline the command word (state, explain, describe, calculate…).', 'Compare your answer with the mark scheme: list the missing marking points.', 'Answer a comparable new question hitting those points.']
  },
  retrieval: {
    name: 'Retrieval repair',
    steps: ['Write down everything you can recall without looking.', 'Check and fill gaps.', 'Make 3 self-test questions; answer them again tomorrow.']
  }
};

export const METHOD_FOR: Record<ErrorCategory, RepairMethod[]> = {
  concept: ['contrast-predict', 'blank-page'],
  memory: ['retrieval', 'blank-page'],
  application: ['scaffold-transfer', 'contrast-predict'],
  calculation: ['calculation', 'scaffold-transfer'],
  'exam-technique': ['exam-language'],
  misread: ['exam-language']
};

export function needsRepair(a: AssessmentAttempt): boolean {
  return a.marksAvailable > 0 && pct(a) < MASTERY.repairBelow;
}

/** Idempotent: no second repair for the same attempt. */
export function shouldCreateRepair(a: AssessmentAttempt, existing: RepairTask[]): boolean {
  return needsRepair(a) && !existing.some((r) => r.sourceAttemptId === a.id);
}

/**
 * Repair within 48 hours: tomorrow or the day after, whichever has more
 * spare capacity and fewer repairs already.
 */
export function pickRepairDate(today: ISODate, sessions: StudySession[], config: PlanConfig, exams: Exam[], minutes = 30): { date: ISODate; overCapacity: boolean } {
  const options = [addDays(today, 1), addDays(today, 2)];
  const scored = options.map((d) => ({
    d,
    free: freeOn(config, sessions, exams, d),
    repairs: sessions.filter((s) => s.date === d && s.source === 'repair').length
  }));
  scored.sort((a, b) => a.repairs - b.repairs || b.free - a.free);
  const pick = scored.find((x) => x.free >= minutes) ?? scored[0];
  return { date: pick.d, overCapacity: pick.free < minutes };
}

/** Unseen retest 2–4 days after the repair, on the lightest day. */
export function pickRetestDate(after: ISODate, sessions: StudySession[], config: PlanConfig, exams: Exam[]): ISODate {
  const options = [2, 3, 4].map((n) => addDays(after, n));
  const scored = options.map((d) => ({ d, free: freeOn(config, sessions, exams, d) }));
  const fit = scored.find((x) => x.free >= 25);
  return (fit ?? scored.sort((a, b) => b.free - a.free)[0]).d;
}
