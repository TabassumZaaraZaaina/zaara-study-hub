import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { masteryMap, computeMastery } from '@/domain/mastery';
import { defaultConfig, defaultSettings, type Notice } from '@/services/meta';
import type { AssessmentAttempt, PlanConfig, Settings, StudentProfile, Subject, SubjectId, Topic } from '@/types';
import { localDate } from '@/utils/dates';

/** Asia/Dhaka date that updates itself across midnight. */
export function useToday() {
  const [today, setToday] = useState(localDate());
  useEffect(() => {
    const t = setInterval(() => {
      const d = localDate();
      setToday((prev) => (prev === d ? prev : d));
    }, 30_000);
    const onVis = () => document.visibilityState === 'visible' && setToday(localDate());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return today;
}

export function useMeta<T>(key: string, fallback: T): T {
  return useLiveQuery(async () => ((await db.meta.get(key))?.value as T | undefined) ?? fallback, [key]) ?? fallback;
}

export const useConfig = () => useMeta<PlanConfig>('config', defaultConfig());
export const useSettings = (): Settings => ({ ...defaultSettings(), ...useMeta<Partial<Settings>>('settings', {}) });
export const useProfile = () => useLiveQuery(async () => (await db.meta.get('profile'))?.value as StudentProfile | undefined);
export const useNotices = () => useMeta<Notice[]>('notices', []);

export function useSubjects(): Subject[] {
  return useLiveQuery(() => db.subjects.toArray(), []) ?? [];
}

export function useSubjectMap(): Record<SubjectId, Subject> {
  const s = useSubjects();
  return Object.fromEntries(s.map((x) => [x.id, x])) as Record<SubjectId, Subject>;
}

export const useTopics = () => useLiveQuery(() => db.topics.orderBy('order').toArray(), []) ?? [];
export const useAttempts = () => useLiveQuery(() => db.attempts.toArray(), []) ?? [];
export const useSessions = () => useLiveQuery(() => db.sessions.toArray(), []);
export const useExams = () => useLiveQuery(() => db.exams.toArray(), []) ?? [];
export const useRepairs = () => useLiveQuery(() => db.repairs.toArray(), []) ?? [];
export const useResources = () => useLiveQuery(() => db.resources.toArray(), []) ?? [];
export const useErrors = () => useLiveQuery(() => db.errors.toArray(), []) ?? [];

export function useMastery(topics: Topic[], attempts: AssessmentAttempt[]) {
  return masteryMap(topics.map((t) => t.id), attempts);
}
export { computeMastery };

export const useHasDemo = () =>
  useLiveQuery(async () => {
    const [a, b, c] = await Promise.all([db.sessions.filter((s) => !!s.demo).count(), db.attempts.filter((s) => !!s.demo).count(), db.topics.filter((s) => !!s.demo).count()]);
    return a + b + c > 0;
  }, []) ?? false;

export function topicTitle(topics: Topic[], ids: string[]): string {
  if (!ids.length) return '';
  return ids.map((id) => topics.find((t) => t.id === id)?.title ?? 'Topic').join(' + ');
}
