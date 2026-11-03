import { z } from 'zod';
import { db, SCHEMA_VERSION, ALL_TABLES } from '@/db/db';
import { nowISO } from '@/utils/dates';

/**
 * Backup format: one JSON document containing every table.
 * Photos are embedded as data URLs so a backup is self-contained.
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const subjectId = z.enum(['bangla', 'economics', 'physics', 'chemistry', 'mathd', 'addmath']);

const sessionSchema = z
  .object({
    id: z.string(), date: isoDate, originalDate: isoDate, subjectId, templateId: z.string(),
    status: z.enum(['planned', 'in_progress', 'completed', 'partial', 'missed', 'skipped', 'consolidated', 'converted']),
    plannedMinutes: z.number().int().nonnegative(), completedActivities: z.array(z.string()), topicIds: z.array(z.string()),
    moves: z.array(z.object({ from: isoDate, to: isoDate, at: z.string(), reason: z.string(), auto: z.boolean() }))
  })
  .passthrough();

const attemptSchema = z
  .object({ id: z.string(), subjectId, marksEarned: z.number().nonnegative(), marksAvailable: z.number().positive(), date: isoDate })
  .passthrough()
  .refine((a) => a.marksEarned <= a.marksAvailable, 'marksEarned exceeds marksAvailable');

const examSchema = z.object({ id: z.string(), subjectId, group: z.enum(['mock2', 'final']), date: isoDate.nullable() }).passthrough();
const anyRecord = z.object({ id: z.union([z.string(), z.number()]) }).passthrough();

export const backupSchema = z.object({
  app: z.literal('zaara'),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  tables: z.object({
    meta: z.array(z.object({ key: z.string(), value: z.unknown() })),
    subjects: z.array(anyRecord),
    topics: z.array(anyRecord.extend({ subjectId })),
    exams: z.array(examSchema),
    sessions: z.array(sessionSchema),
    attempts: z.array(attemptSchema),
    errors: z.array(anyRecord),
    repairs: z.array(anyRecord),
    resources: z.array(anyRecord),
    files: z.array(z.object({ id: z.string(), name: z.string(), type: z.string(), size: z.number(), dataUrl: z.string(), createdAt: z.string() }).passthrough()),
    history: z.array(z.object({ at: z.string(), action: z.string() }).passthrough())
  })
});
export type Backup = z.infer<typeof backupSchema>;

async function blobToDataUrl(b: Blob): Promise<string> {
  if (typeof b.arrayBuffer === 'function') {
    const buf = new Uint8Array(await b.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:${b.type || 'application/octet-stream'};base64,${btoa(bin)}`;
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

function dataUrlToBlob(url: string): Blob {
  const [head, data] = url.split(',');
  const type = /data:(.*?);base64/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export async function exportBackup(): Promise<Backup> {
  const files = await db.files.toArray();
  return {
    app: 'zaara',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowISO(),
    tables: {
      meta: await db.meta.toArray(),
      subjects: await db.subjects.toArray(),
      topics: await db.topics.toArray(),
      exams: await db.exams.toArray(),
      sessions: await db.sessions.toArray(),
      attempts: await db.attempts.toArray(),
      errors: await db.errors.toArray(),
      repairs: await db.repairs.toArray(),
      resources: await db.resources.toArray(),
      files: await Promise.all(files.map(async ({ blob, ...f }) => ({ ...f, dataUrl: await blobToDataUrl(blob) }))),
      history: await db.history.toArray()
    }
  } as unknown as Backup;
}

/** Upgrade older backups to the current schema. Add a case per version bump. */
export function migrateBackup(raw: { schemaVersion?: number } & Record<string, unknown>): unknown {
  const v = raw.schemaVersion ?? 1;
  if (v > SCHEMA_VERSION) throw new Error(`This backup is from a newer version of ZAARA (schema ${v}). Update the app first.`);
  // v1 is current — nothing to migrate yet.
  return raw;
}

export interface ImportCheck {
  ok: boolean;
  errors: string[];
  summary?: { sessions: number; attempts: number; exams: number; topics: number; exportedAt: string };
  backup?: Backup;
}

export function checkBackup(json: unknown): ImportCheck {
  try {
    if (!json || typeof json !== 'object') return { ok: false, errors: ['File is not a ZAARA backup.'] };
    const migrated = migrateBackup(json as Record<string, unknown>);
    const parsed = backupSchema.safeParse(migrated);
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.')}: ${i.message}`) };
    }
    const b = parsed.data;
    // Referential checks
    const errs: string[] = [];
    const sessionIds = new Set(b.tables.sessions.map((s) => s.id));
    const attemptIds = new Set(b.tables.attempts.map((a) => a.id));
    for (const r of b.tables.repairs as { id: string; sourceAttemptId?: string; repairSessionId?: string }[]) {
      if (r.sourceAttemptId && !attemptIds.has(r.sourceAttemptId)) errs.push(`Repair ${r.id} points to a missing result.`);
      if (r.repairSessionId && !sessionIds.has(r.repairSessionId)) errs.push(`Repair ${r.id} points to a missing session.`);
    }
    if (errs.length) return { ok: false, errors: errs.slice(0, 8) };
    return {
      ok: true,
      errors: [],
      backup: b,
      summary: { sessions: b.tables.sessions.length, attempts: b.tables.attempts.length, exams: b.tables.exams.length, topics: b.tables.topics.length, exportedAt: b.exportedAt }
    };
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] };
  }
}

/** Replace all local data with a validated backup (atomic). */
export async function restoreBackup(b: Backup) {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
    const { files, ...rest } = b.tables;
    for (const [name, rows] of Object.entries(rest)) await db.table(name).bulkPut(rows as unknown[]);
    await db.files.bulkPut(files.map(({ dataUrl, ...f }) => ({ ...f, blob: dataUrlToBlob(dataUrl) }) as never));
  });
}

export async function eraseAllData() {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
  });
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
