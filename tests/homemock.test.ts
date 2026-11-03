import { beforeEach, describe, expect, it } from 'vitest';
import { db, ALL_TABLES } from '@/db/db';
import { completeSetup } from '@/services/setup';
import { bookHomeMock, bookSuggestedSeries, cancelHomeMock, paperMinutesFromName, SUGGESTED_SERIES } from '@/services/homemock';
import { startSession, setActivityDone, completeSession } from '@/services/sessions';
import { dayCapacity, loadOn } from '@/scheduling/engine';
import { sessionProgress } from '@/domain/progress';
import { getConfig } from '@/services/meta';
import { TODAY } from './helpers';

const paper = { paperId: 'p1', label: 'Paper 1 — Non-calculator (2 h, 80 marks, 50%)', reference: '4037/12 M/J 2026', minutes: 120 };

describe('home mocks', () => {
  beforeEach(async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
    await completeSetup({ config: { capacity: [135, 135, 135, 240, 135, 90, 240] } }, TODAY);
  });

  it('reads paper lengths from the syllabus paper names', () => {
    expect(paperMinutesFromName(paper.label)).toBe(120);
    expect(paperMinutesFromName('Paper 2 — Theory (1 h 45 min, 80 marks, 50%)')).toBe(105);
    expect(paperMinutesFromName('Paper 2 — Language Usage and Comprehension (1 h 30 min, 110 marks, 55%)')).toBe(90);
  });

  it('books the real paper length, makes room without losing sessions, and plans marking next day', async () => {
    const d = '2026-11-07'; // Saturday, 4 h
    const before = await db.sessions.where('date').equals(d).toArray();
    const r = await bookHomeMock({ date: d, subjectId: 'addmath', paper });
    expect(r.mock.plannedMinutes).toBe(125);
    expect(r.marking.date).toBe('2026-11-08');
    const all = await db.sessions.toArray();
    const config = await getConfig();
    expect(loadOn(all, d)).toBeLessThanOrEqual(dayCapacity(config, d, []));
    // every displaced session still exists somewhere (moved, or its topic shifted on)
    for (const s of before) {
      const now = all.find((x) => x.id === s.id);
      expect(now).toBeDefined();
      if (now!.status !== 'planned') expect(now).toMatchObject({ status: 'consolidated', mergedIntoId: r.mock.id });
    }
    expect(r.moved.length + r.replaced.length).toBeGreaterThan(0);
    // idempotent
    const again = await bookHomeMock({ date: d, subjectId: 'addmath', paper });
    expect(again.alreadyBooked).toBe(true);
    expect((await db.sessions.where('source').equals('homemock').count())).toBe(1);
  });

  it('runs as a timed paper: progress uses the paper length, marking session links back', async () => {
    const r = await bookHomeMock({ date: TODAY, subjectId: 'physics', paper: { ...paper, minutes: 105 } });
    await startSession(r.mock.id, 'full');
    const s1 = await setActivityDone(r.mock.id, 'prepare', true);
    expect(sessionProgress(s1!)).toBeCloseTo(5 / 110);
    await setActivityDone(r.mock.id, 'sit', true);
    const done = await completeSession(r.mock.id, TODAY);
    expect(done.session.status).toBe('completed');
    expect(done.followup).toBeUndefined();
    expect((await db.sessions.get(r.marking.id))!.parentSessionId).toBe(r.mock.id);
  });

  it('can be cancelled before it starts; replaced sessions come back', async () => {
    const d = '2026-11-11';
    const before = (await db.sessions.where('date').equals(d).toArray()).map((s) => s.id).sort();
    const r = await bookHomeMock({ date: d, subjectId: 'physics', paper: { ...paper, minutes: 230 } });
    expect(r.replaced.length).toBeGreaterThan(0);
    await cancelHomeMock(r.mock.id);
    expect(await db.sessions.get(r.mock.id)).toBeUndefined();
    expect(await db.sessions.get(r.marking.id)).toBeUndefined();
    const back = (await db.sessions.where('date').equals(d).toArray()).filter((s) => s.status === 'planned').map((s) => s.id).sort();
    expect(back).toEqual(before.filter((id) => !r.moved.length || back.includes(id)));
  });

  it('with her real hours the full series never overloads a day beyond the papers themselves', async () => {
    await bookSuggestedSeries(TODAY);
    const all = await db.sessions.toArray();
    const config = await getConfig();
    for (const d of [...new Set(all.map((s) => s.date))]) {
      const load = loadOn(all, d);
      const cap = dayCapacity(config, d, []);
      if (load <= cap) continue;
      // Only allowed when the fixed items alone (papers, marking, repairs) exceed the day.
      const fixed = all.filter((s) => s.date === d && ['homemock', 'homemock-mark', 'repair'].includes(s.source) && s.status !== 'consolidated').reduce((t, s) => t + s.plannedMinutes, 0);
      expect(fixed).toBeGreaterThan(cap);
    }
    // nothing is lost silently: every replaced session points at a mock and says why
    for (const s of all.filter((x) => x.status === 'consolidated')) {
      expect(all.some((m) => m.id === s.mergedIntoId && m.source === 'homemock')).toBe(true);
      expect(s.note).toMatch(/home mock/);
    }
  });

  it('books the suggested series once, skipping past dates', async () => {
    const rs = await bookSuggestedSeries('2026-11-10');
    expect(rs).toHaveLength(SUGGESTED_SERIES.filter((x) => x.date >= '2026-11-10').length);
    await bookSuggestedSeries('2026-11-10');
    expect(await db.sessions.where('source').equals('homemock').count()).toBe(SUGGESTED_SERIES.filter((x) => x.date >= '2026-11-10').length);
    // nothing on or after the Mock 2 start, and the last three days before it stay free of papers
    expect(SUGGESTED_SERIES.every((x) => x.date <= '2026-11-21')).toBe(true);
    expect(SUGGESTED_SERIES.some((x) => x.subjectId === 'english')).toBe(true);
    const econ = (await db.sessions.where('source').equals('homemock').toArray()).find((s) => s.subjectId === 'economics' && s.mockPaper?.paperId === 'p2')!;
    expect(econ.mockPaper!.minutes).toBe(135);
  });

  it('a missed home mock is carried over to a day with room, never squeezed into a 90-minute slot', async () => {
    const r = await bookHomeMock({ date: TODAY, subjectId: 'addmath', paper });
    const { dailyMaintenance } = await import('@/services/plan');
    await dailyMaintenance('2026-11-04');
    const m = (await db.sessions.get(r.mock.id))!;
    const config = await getConfig();
    if (m.date >= '2026-11-04') expect(loadOn(await db.sessions.toArray(), m.date)).toBeLessThanOrEqual(dayCapacity(config, m.date, []));
    else expect(m.status).toBe('missed');
  });
});
