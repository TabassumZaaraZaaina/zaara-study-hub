/**
 * One-off data migrations for installs created by earlier versions.
 * Each step is idempotent and recorded in meta.dataVersion.
 *
 * v2 (Nov 2026): Mock 2 moved to 25 Nov; English Language added as a 7th subject.
 *   - add the missing subject (and its syllabus pack)
 *   - if the old 12-paper home-mock series was booked, cancel its unstarted
 *     papers that aren't in the new series and book the new series
 *   - re-plan untouched future sessions for the new date
 */
import { db } from '@/db/db';
import { SUBJECTS } from '@/data/catalog';
import type { StudentProfile } from '@/types';
import { addDays, localDate } from '@/utils/dates';
import { addNotices, getMeta, log, setMeta } from './meta';
import { regenerateFuture } from './plan';
import { loadSyllabus } from './topics';
import { OLD_SERIES_V1, SUGGESTED_SERIES, bookSuggestedSeries, cancelHomeMock } from './homemock';

export const DATA_VERSION = 2;

export async function runMigrations(today = localDate()) {
  const v = (await getMeta<number>('dataVersion')) ?? 1;
  if (v >= DATA_VERSION) return;

  const have = new Set((await db.subjects.toArray()).map((s) => s.id));
  const missing = SUBJECTS.filter((s) => !have.has(s.id));
  if (missing.length) await db.subjects.bulkPut(missing);

  const profile = await getMeta<StudentProfile>('profile');
  if (profile?.setupComplete) {
    const notes: string[] = [];
    for (const m of missing) {
      await loadSyllabus(m.id);
      notes.push(`${m.name} has been added as a subject, with its official syllabus sections. It’s now part of your plan.`);
    }
    const inNew = (date: string, subjectId: string, paperId: string | null | undefined) =>
      SUGGESTED_SERIES.some((x) => x.date === date && x.subjectId === subjectId && x.paperId === paperId);
    const oldMocks = (await db.sessions.where('source').equals('homemock').toArray()).filter(
      (s) =>
        s.status === 'planned' && !s.completedActivities.length && s.mockPaper?.reference.startsWith('M/J 2026') &&
        OLD_SERIES_V1.some((x) => x.date === s.date && x.subjectId === s.subjectId && x.paperId === s.mockPaper?.paperId)
    );
    const toCancel = oldMocks.filter((s) => !inNew(s.date, s.subjectId, s.mockPaper?.paperId));
    for (const s of toCancel) await cancelHomeMock(s.id);
    if (oldMocks.length) {
      await bookSuggestedSeries(today); // also re-balances the plan
      notes.push('Mock 2 now starts on 25 November, so your home-mock papers were re-arranged to finish on Sat 21 Nov and include English. Check Exam timetable → Home mocks.');
    } else {
      await regenerateFuture(addDays(today, 1), 'Mock 2 moved to 25 Nov; English added');
      notes.push('Mock 2 now starts on 25 November — your plan from tomorrow has been updated.');
    }
    await addNotices(notes.map((text) => ({ date: today, kind: 'info' as const, text })));
    await log('migration.v2', 'app', 'data', `added ${missing.map((m) => m.id).join(',') || 'none'}; cancelled ${toCancel.length} old home mocks`);
  }
  await setMeta('dataVersion', DATA_VERSION);
}
