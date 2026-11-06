import { beforeEach, describe, expect, it } from 'vitest';
import { db, ALL_TABLES } from '@/db/db';
import { completeSetup } from '@/services/setup';
import { bookHomeMock, packPaper, OLD_SERIES_V1, SUGGESTED_SERIES } from '@/services/homemock';
import { runMigrations } from '@/services/migrations';
import { getMeta, setMeta, type Notice } from '@/services/meta';
import { nextExamFor } from '@/scheduling/engine';

describe('v2 migration: Mock 2 on 25 Nov, English added', () => {
  beforeEach(async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
    await completeSetup({ config: { capacity: [135, 135, 135, 240, 135, 90, 240] } }, '2026-11-03');
    // Make this look like an install from the previous version.
    await db.subjects.delete('english');
    await db.topics.where('subjectId').equals('english').delete();
    await db.sessions.where('subjectId').equals('english').delete();
    await setMeta('dataVersion', 1);
  });

  it('adds English with its syllabus and re-arranges the old home-mock series', async () => {
    for (const x of OLD_SERIES_V1) {
      if (x.subjectId === 'english') continue;
      await bookHomeMock({ date: x.date, subjectId: x.subjectId, paper: { ...packPaper(x.subjectId, x.paperId), reference: 'M/J 2026' } });
    }
    expect(await db.sessions.filter((s) => s.source === 'homemock' && s.date === '2026-11-25').count()).toBe(2);

    await runMigrations('2026-11-04');

    expect(await db.subjects.get('english')).toMatchObject({ name: 'English Language', syllabusCode: '1123' });
    expect(await db.topics.where('subjectId').equals('english').count()).toBe(9);
    const mocks = await db.sessions.where('source').equals('homemock').toArray();
    expect(mocks.some((m) => m.date >= '2026-11-25')).toBe(false); // nothing on Mock 2 days
    expect(mocks).toHaveLength(SUGGESTED_SERIES.length);
    expect(mocks.filter((m) => m.subjectId === 'english')).toHaveLength(2);
    expect(await db.sessions.where('subjectId').equals('english').count()).toBeGreaterThan(2); // in the regular plan too
    const notices = (await getMeta<Notice[]>('notices')) ?? [];
    expect(notices.some((n) => /25 November/.test(n.text))).toBe(true);
    expect(nextExamFor('physics', '2026-11-04', []).date).toBe('2026-11-25');

    // v3: the 16 official June 2027 final papers
    const finals = await db.exams.where('group').equals('final').toArray();
    expect(finals).toHaveLength(16);
    expect(finals.find((e) => e.subjectId === 'economics' && e.date === '2027-05-26')?.durationMinutes).toBe(120);
    expect(await getMeta<number>('dataVersion')).toBe(3);
        // idempotent
    const count = await db.sessions.count();
    await runMigrations('2026-11-04');
    expect(await db.sessions.count()).toBe(count);
  });

  it('without booked mocks it just re-plans and does not book anything', async () => {
    await runMigrations('2026-11-04');
    expect(await db.sessions.where('source').equals('homemock').count()).toBe(0);
    expect(await db.subjects.get('english')).toBeDefined();
  });
});
