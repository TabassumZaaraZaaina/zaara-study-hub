import Dexie, { type Table } from 'dexie';
import type { AssessmentAttempt, ErrorRecord, Exam, HistoryEntry, RepairTask, Resource, StoredFile, StudySession, Subject, Topic } from '@/types';

export interface MetaRow {
  key: string;
  value: unknown;
}

export const SCHEMA_VERSION = 1;

/**
 * IndexedDB via Dexie. Bump the Dexie version and add an `.upgrade()` for any
 * schema change; also bump SCHEMA_VERSION and extend `migrateBackup` in backup.ts.
 */
export class ZaaraDB extends Dexie {
  meta!: Table<MetaRow, string>;
  subjects!: Table<Subject, string>;
  topics!: Table<Topic, string>;
  exams!: Table<Exam, string>;
  sessions!: Table<StudySession, string>;
  attempts!: Table<AssessmentAttempt, string>;
  errors!: Table<ErrorRecord, string>;
  repairs!: Table<RepairTask, string>;
  resources!: Table<Resource, string>;
  files!: Table<StoredFile, string>;
  history!: Table<HistoryEntry, number>;

  constructor(name = 'zaara') {
    super(name);
    this.version(1).stores({
      meta: 'key',
      subjects: 'id',
      topics: 'id, subjectId, order',
      exams: 'id, subjectId, group, date',
      sessions: 'id, date, subjectId, status, source, repairId, [subjectId+date]',
      attempts: 'id, subjectId, topicId, date, repairId, sessionId',
      errors: 'id, subjectId, topicId, attemptId',
      repairs: 'id, topicId, status, sourceAttemptId',
      resources: 'id, subjectId',
      files: 'id',
      history: '++id, at, entityId'
    });
  }
}

export const db = new ZaaraDB();

export const ALL_TABLES = ['meta', 'subjects', 'topics', 'exams', 'sessions', 'attempts', 'errors', 'repairs', 'resources', 'files', 'history'] as const;
export type TableName = (typeof ALL_TABLES)[number];
