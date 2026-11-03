import { SUBJECTS } from '@/data/catalog';
import { defaultConfig } from '@/services/meta';
import type { AssessmentAttempt, Exam, PlanConfig, StudySession, Topic, SubjectId } from '@/types';
import type { PlanContext } from '@/scheduling/engine';

let n = 0;
export const idf = () => `id${++n}`;
export const NOW = '2026-11-03T04:00:00.000Z';
export const TODAY = '2026-11-03'; // Tuesday

export function config(patch: Partial<PlanConfig> = {}): PlanConfig {
  return { ...defaultConfig(TODAY), ...patch };
}

export function topics(subjectId: SubjectId, count: number, extra: Partial<Topic> = {}): Topic[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${subjectId}-t${i + 1}`, subjectId, parentTopicId: null, syllabusReference: null, title: `${subjectId} topic ${i + 1}`,
    learningObjectives: '', order: i, active: true, inMock: false, ...extra
  }));
}

export function exam(subjectId: SubjectId, date: string | null, group: Exam['group'] = 'mock2'): Exam {
  return { id: `ex-${subjectId}-${group}-${date}`, group, subjectId, paper: 'Paper 1', date, startTime: '09:00', durationMinutes: 90, coverageTopicIds: [], status: date ? 'scheduled' : 'pending' };
}

export function ctx(p: Partial<PlanContext> = {}): PlanContext {
  return { config: config(), subjects: SUBJECTS, topics: [], exams: [], mastery: {}, existing: [], idFactory: idf, now: NOW, ...p };
}

export function attempt(topicId: string, date: string, earned: number, p: Partial<AssessmentAttempt> = {}): AssessmentAttempt {
  return {
    id: idf(), subjectId: 'physics', topicId, sessionId: null, assessmentType: 'topic-quiz', source: 'textbook', marksEarned: earned, marksAvailable: 100,
    assistanceUsed: 'none', confidence: null, unseen: true, photoIds: [], date, completedAt: `${date}T10:00:00.000Z`, ...p
  };
}

export const byDate = (ss: StudySession[], d: string) => ss.filter((s) => s.date === d);
