/**
 * Sample data for trying the interface. Every record has `demo: true`, a banner
 * is shown while any exists, and `clearDemo` removes exactly these records.
 */
import { db } from '@/db/db';
import { makeSession } from '@/scheduling/engine';
import type { AssessmentAttempt, Topic } from '@/types';
import { addDays, nowISO } from '@/utils/dates';
import { regenerateFuture } from './plan';
import { uid } from './meta';

export async function loadDemo(today: string) {
  const now = nowISO();
  const t = (title: string, order: number): Topic => ({ id: uid(), subjectId: 'physics', parentTopicId: null, syllabusReference: null, title: `[Sample] ${title}`, learningObjectives: '', order: 1000 + order, active: true, inMock: false, demo: true });
  const topics = [t('Electromagnetic induction', 0), t('Pressure', 1), t('Waves', 2)];
  const at = (topic: Topic, date: string, e: number, p: Partial<AssessmentAttempt> = {}): AssessmentAttempt => ({
    id: uid(), subjectId: 'physics', topicId: topic.id, sessionId: null, assessmentType: 'topic-quiz', source: 'textbook', marksEarned: e, marksAvailable: 10,
    assistanceUsed: 'none', confidence: 'unsure', unseen: true, photoIds: [], date, completedAt: `${date}T10:00:00.000Z`, demo: true, ...p
  });
  const attempts = [
    at(topics[0], addDays(today, -6), 3, { confidence: 'confident' }),
    at(topics[1], addDays(today, -12), 8),
    at(topics[1], addDays(today, -3), 9, { assessmentType: 'retention-check' }),
    at(topics[2], addDays(today, -9), 4),
    at(topics[2], addDays(today, -2), 8, { assessmentType: 'retest' })
  ];
  const repairId = uid();
  const s = (p: Parameters<typeof makeSession>[0]) => ({ ...makeSession(p, now, 0), demo: true });
  const sessions = [
    { ...s({ id: uid(), date: addDays(today, -2), subjectId: 'physics', templateId: 'physics-loop', topicIds: [topics[0].id], order: 90 }), status: 'completed' as const, mode: 'full' as const, actualMinutes: 88, completedActivities: ['recall', 'read', 'see', 'do', 'mark', 'errors'], completedAt: now },
    { ...s({ id: uid(), date: addDays(today, -1), subjectId: 'chemistry', templateId: 'chem-concept', order: 90 }), status: 'completed' as const, mode: 'light' as const, actualMinutes: 15, completedActivities: ['light-recall', 'light-check'], completedAt: now },
    { ...s({ id: uid(), date: addDays(today, -1), subjectId: 'addmath', templateId: 'addmath-build', order: 91 }), status: 'missed' as const },
    { ...s({ id: uid(), date: addDays(today, 1), subjectId: 'physics', templateId: 'retest', topicIds: [topics[0].id], source: 'retest', repairId, order: 92 }) }
  ];
  await db.transaction('rw', [db.topics, db.attempts, db.sessions, db.repairs, db.exams, db.errors], async () => {
    await db.topics.bulkPut(topics);
    await db.attempts.bulkPut(attempts);
    await db.sessions.bulkPut(sessions);
    await db.repairs.put({ id: repairId, subjectId: 'physics', topicId: topics[0].id, sourceAttemptId: attempts[0].id, diagnosis: 'concept', method: 'contrast-predict', assignedDate: addDays(today, -6), dueDate: addDays(today, -4), status: 'retest-scheduled', retestSessionId: sessions[3].id, createdAt: now, demo: true });
    await db.errors.put({ id: uid(), attemptId: attempts[0].id, subjectId: 'physics', topicId: topics[0].id, category: 'concept', description: '[Sample] Thought a stationary magnet in a coil induces a current.', correction: 'Only a CHANGING magnetic field linking the coil induces an e.m.f.', confidentButWrong: true, resolved: false, createdAt: now, demo: true });
  });
}

export async function clearDemo(today: string) {
  await db.transaction('rw', [db.topics, db.attempts, db.sessions, db.repairs, db.exams, db.errors, db.resources], async () => {
    const demoTopicIds = new Set((await db.topics.filter((x) => !!x.demo).toArray()).map((x) => x.id));
    for (const t of [db.topics, db.attempts, db.sessions, db.repairs, db.exams, db.errors, db.resources] as const) {
      await (t as typeof db.topics).filter((x) => !!(x as { demo?: boolean }).demo).delete();
    }
    // Real sessions that picked up a sample topic lose that reference.
    await db.sessions.filter((x) => x.topicIds.some((id) => demoTopicIds.has(id))).modify((x) => { x.topicIds = x.topicIds.filter((id) => !demoTopicIds.has(id)); });
  });
  await regenerateFuture(addDays(today, 1), 'Sample data cleared');
}
