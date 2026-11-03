import { db } from '@/db/db';
import type { Exam, ISODate, PlanConfig, StudentProfile } from '@/types';
import { localDate } from '@/utils/dates';
import { getConfig, getMeta, log, setMeta } from './meta';
import { ensureHorizon, initialiseDatabase } from './plan';

export interface SetupInput {
  displayName?: string;
  config: Partial<PlanConfig>;
  exams?: Exam[];
}

/** Finish onboarding and generate the first (provisional) plan. */
export async function completeSetup(input: SetupInput, today: ISODate = localDate()) {
  await initialiseDatabase();
  const config = await getConfig();
  await setMeta<PlanConfig>('config', { ...config, ...input.config, planStart: today });
  const profile = (await getMeta<StudentProfile>('profile'))!;
  await setMeta<StudentProfile>('profile', { ...profile, displayName: input.displayName?.trim() || profile.displayName, setupComplete: true });
  if (input.exams?.length) await db.exams.bulkPut(input.exams);
  await setMeta('generatedThrough', undefined);
  const created = await ensureHorizon(today);
  await log('setup.complete', 'profile', 'me', `Plan generated: ${created} sessions`);
  return created;
}
