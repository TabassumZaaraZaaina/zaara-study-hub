import { db } from '@/db/db';
import type { HistoryEntry, ISODate, PlanConfig, Settings, StudentProfile } from '@/types';
import { localDate, nowISO } from '@/utils/dates';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * Provisional defaults. The setup screen asks Zaara to confirm them.
 * Sun–Thu school days: 135 min (one Full + one Steady session),
 * Friday: 90 min, Saturday: 180 min.
 */
export function defaultConfig(today: ISODate = localDate()): PlanConfig {
  return {
    planStart: today,
    horizonDays: 56,
    capacity: [135, 135, 135, 135, 135, 90, 180],
    schoolDays: [0, 1, 2, 3, 4],
    unavailable: [],
    commitments: [],
    blockMinutes: 90,
    carryOverMode: 'auto',
    backlogThreshold: 4,
    planVersion: 1,
    provisional: true
  };
}

export const defaultSettings = (): Settings => ({
  theme: 'system',
  reminders: { enabled: true, dailyPlan: true, retests: true, examCountdown: true, quietStart: '22:00', quietEnd: '07:00' },
  planningMode: false
});

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta<T>(key: string, value: T) {
  await db.meta.put({ key, value });
}

export const getConfig = async () => (await getMeta<PlanConfig>('config')) ?? defaultConfig();
export const getProfile = () => getMeta<StudentProfile>('profile');
export const getSettings = async () => ({ ...defaultSettings(), ...((await getMeta<Settings>('settings')) ?? {}) });

export async function log(action: string, entityType: string, entityId: string, detail: string) {
  const e: HistoryEntry = { at: nowISO(), action, entityType, entityId, detail };
  await db.history.add(e);
}

export interface Notice {
  id: string;
  at: string;
  date: ISODate;
  text: string;
  kind: 'moved' | 'info' | 'repair' | 'followup';
  sessionId?: string;
}

export async function addNotices(items: Omit<Notice, 'id' | 'at'>[]) {
  if (!items.length) return;
  const list = (await getMeta<Notice[]>('notices')) ?? [];
  const at = nowISO();
  const next = [...items.map((n) => ({ ...n, id: uid(), at })), ...list].slice(0, 30);
  await setMeta('notices', next);
}

export async function dismissNotice(id: string) {
  const list = (await getMeta<Notice[]>('notices')) ?? [];
  await setMeta('notices', list.filter((n) => n.id !== id));
}
