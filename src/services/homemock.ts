/**
 * Home mocks: a past paper sat at home under exam conditions.
 *
 * Booking a home mock:
 *  1. adds a "Home mock" session lasting the paper's real length (+5 min set-up)
 *  2. adds a 45-minute "Mark home mock" session the next day
 *  3. makes room on both days: an untouched planned session that no longer
 *     fits moves to a genuinely free slot in the next week; if there is none,
 *     it is REPLACED by the mock (status 'consolidated', linked to the mock,
 *     shown in Schedule and the booking report). The mock is that day's study
 *     time — the plan doesn't add extra hours. Started/completed work and
 *     repair sessions are never touched.
 */
import { db } from '@/db/db';
import { PACK_BY_SUBJECT } from '@/data/syllabus';
import { applyPlacement, proposePlacement } from '@/scheduling/carryover';
import { dayCapacity, loadOn, makeSession } from '@/scheduling/engine';
import type { ISODate, MockPaper, StudySession, SubjectId } from '@/types';
import { addDays, fmtMinutes, fmtShort, nowISO } from '@/utils/dates';
import { getConfig, log, uid } from './meta';
import { regenerateFuture } from './plan';

/** "Paper 1 — Non-calculator (2 h, 80 marks, 50%)" → 120; "(1 h 45 min" → 105. */
export function paperMinutesFromName(name: string): number | null {
  const m = /(\d+)\s*h(?:\s*(\d+)\s*min)?/.exec(name);
  if (m) return Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
  const mm = /(\d+)\s*min/.exec(name);
  return mm ? Number(mm[1]) : null;
}

export const paperShortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, '');

export interface BookResult {
  mock: StudySession;
  marking: StudySession;
  moved: { subjectId: SubjectId; from: ISODate; to: ISODate }[];
  replaced: { subjectId: SubjectId; date: ISODate }[];
  overBy: Record<ISODate, number>;
  alreadyBooked: boolean;
}

/** Move (or, failing that, replace) untouched planned sessions until the day fits. */
async function makeRoom(date: ISODate, keepIds: Set<string>, mockId: string, moved: BookResult['moved'], replaced: BookResult['replaced']) {
  const [config, exams] = await Promise.all([getConfig(), db.exams.toArray()]);
  let all = await db.sessions.toArray();
  const cap = dayCapacity(config, date, exams);
  while (loadOn(all, date) > cap) {
    const s = all
      .filter((x) => x.date === date && !keepIds.has(x.id) && x.status === 'planned' && !x.completedActivities.length && !x.startedAt && x.source !== 'homemock' && x.source !== 'homemock-mark' && x.source !== 'repair')
      .sort((a, b) => b.plannedMinutes - a.plannedMinutes || b.order - a.order)[0];
    if (!s) break;
    const p = proposePlacement(s, all, config, exams, date, addDays(date, 1));
    if (p.type === 'free') {
      const r = applyPlacement(s, p, all, nowISO(), 'Moved to make room for a home mock.', true);
      await db.sessions.bulkPut(r.updates);
      all = all.map((x) => r.updates.find((u) => u.id === x.id) ?? x);
      moved.push({ subjectId: s.subjectId, from: date, to: p.date });
    } else {
      const next: StudySession = { ...s, status: 'consolidated', mergedIntoId: mockId, note: 'Replaced by a home mock — the paper is this day’s study time.', updatedAt: nowISO() };
      await db.sessions.put(next);
      all = all.map((x) => (x.id === s.id ? next : x));
      replaced.push({ subjectId: s.subjectId, date });
    }
  }
  return Math.max(0, loadOn(all, date) - cap);
}

export async function bookHomeMock(input: { date: ISODate; subjectId: SubjectId; paper: MockPaper }): Promise<BookResult> {
  if (!(input.paper.minutes > 0 && input.paper.minutes <= 300)) throw new Error('Paper length should be between 1 and 300 minutes.');
  return db.transaction('rw', [db.sessions, db.meta, db.exams, db.history], async () => {
    const config = await getConfig();
    const existing = (await db.sessions.where('date').equals(input.date).toArray()).find(
      (s) => s.source === 'homemock' && s.subjectId === input.subjectId && s.mockPaper?.label === input.paper.label
    );
    if (existing) {
      const marking = (await db.sessions.filter((s) => s.source === 'homemock-mark' && s.parentSessionId === existing.id).first())!;
      return { mock: existing, marking, moved: [], replaced: [], overBy: {}, alreadyBooked: true };
    }
    const now = nowISO();
    const mock = makeSession(
      {
        id: uid(), date: input.date, subjectId: input.subjectId, templateId: 'home-mock', source: 'homemock', pinned: true, order: -10,
        mockPaper: input.paper, activityMinutes: { sit: input.paper.minutes }, plannedMinutes: input.paper.minutes + 5,
        reason: `Home mock: ${input.paper.reference || paperShortName(input.paper.label)} under exam conditions.`
      },
      now,
      config.planVersion
    );
    const marking = makeSession(
      {
        id: uid(), date: addDays(input.date, 1), subjectId: input.subjectId, templateId: 'mock-mark', source: 'homemock-mark', pinned: true, order: -5,
        parentSessionId: mock.id, reason: `Mark yesterday’s home mock (${input.paper.reference || paperShortName(input.paper.label)}) while it’s fresh.`
      },
      now,
      config.planVersion
    );
    await db.sessions.bulkPut([mock, marking]);
    const moved: BookResult['moved'] = [];
    const replaced: BookResult['replaced'] = [];
    const keep = new Set([mock.id, marking.id]);
    const overBy: Record<ISODate, number> = {};
    for (const d of [input.date, marking.date]) {
      const over = await makeRoom(d, keep, mock.id, moved, replaced);
      if (over > 0) overBy[d] = over;
    }
    await log('homemock.book', 'session', mock.id, `${input.subjectId} ${input.paper.label} on ${input.date}; moved ${moved.length}, replaced ${replaced.length}`);
    return { mock, marking, moved, replaced, overBy, alreadyBooked: false };
  });
}

/** Remove a home mock that hasn't been started, with its marking session. */
export async function cancelHomeMock(mockId: string) {
  await db.transaction('rw', db.sessions, db.history, async () => {
    const s = await db.sessions.get(mockId);
    if (!s || s.source !== 'homemock') return;
    if (s.status !== 'planned' || s.completedActivities.length) throw new Error('This mock has started, so it stays in your history.');
    const marks = await db.sessions.filter((x) => x.source === 'homemock-mark' && x.parentSessionId === mockId && x.status === 'planned').toArray();
    const ids = [mockId, ...marks.map((m) => m.id)];
    // Sessions this mock replaced come back.
    await db.sessions.filter((x) => x.status === 'consolidated' && !!x.mergedIntoId && ids.includes(x.mergedIntoId)).modify((x) => {
      x.status = 'planned';
      x.mergedIntoId = undefined;
      x.note = undefined;
    });
    await db.sessions.bulkDelete(ids);
    await log('homemock.cancel', 'session', mockId, '');
  });
}

/** Paper details from the loaded syllabus pack (falls back to a plain name). */
export function packPaper(subjectId: SubjectId, paperId: string): MockPaper {
  const p = PACK_BY_SUBJECT[subjectId]?.papers.find((x) => x.id === paperId);
  const label = p?.name ?? `Paper ${paperId.replace('p', '')}`;
  return { paperId, label, reference: '', minutes: (p && paperMinutesFromName(p.name)) ?? 120 };
}

/**
 * The suggested Mock 2 home-mock series (2026 May/June papers), hardest subjects
 * first so their weak topics get the most repair time. Economics uses the
 * old-format timings because all available Economics papers predate the 2027 syllabus.
 */
export const SUGGESTED_SERIES: { date: ISODate; subjectId: SubjectId; paperId: string; minutes?: number; note?: string }[] = [
  { date: '2026-11-07', subjectId: 'addmath', paperId: 'p1' },
  { date: '2026-11-07', subjectId: 'physics', paperId: 'p2' },
  { date: '2026-11-11', subjectId: 'addmath', paperId: 'p2' },
  { date: '2026-11-11', subjectId: 'physics', paperId: 'p1' },
  { date: '2026-11-14', subjectId: 'mathd', paperId: 'p1' },
  { date: '2026-11-14', subjectId: 'chemistry', paperId: 'p2' },
  { date: '2026-11-18', subjectId: 'mathd', paperId: 'p2' },
  { date: '2026-11-18', subjectId: 'chemistry', paperId: 'p1' },
  { date: '2026-11-21', subjectId: 'economics', paperId: 'p2', minutes: 135, note: 'old format: 2 h 15 min' },
  { date: '2026-11-21', subjectId: 'bangla', paperId: 'p1' },
  { date: '2026-11-25', subjectId: 'bangla', paperId: 'p2' },
  { date: '2026-11-25', subjectId: 'economics', paperId: 'p1', minutes: 45, note: 'old format: 45 min' }
];

/** After booking, re-balance untouched future sessions so each subject's mock time counts toward its share. */
export async function rebalanceAfterMocks(today: ISODate) {
  return regenerateFuture(addDays(today, 1), 'Home mocks booked');
}

export async function bookSuggestedSeries(today: ISODate) {
  const results: BookResult[] = [];
  for (const x of SUGGESTED_SERIES) {
    if (x.date < today) continue;
    const base = packPaper(x.subjectId, x.paperId);
    results.push(
      await bookHomeMock({
        date: x.date,
        subjectId: x.subjectId,
        paper: { ...base, minutes: x.minutes ?? base.minutes, reference: `M/J 2026${x.note ? ` (${x.note})` : ''}` }
      })
    );
  }
  if (results.some((r) => !r.alreadyBooked)) await rebalanceAfterMocks(today);
  return results;
}

export function describeBooking(r: BookResult, names: Record<string, string>) {
  const lines: string[] = [];
  if (r.alreadyBooked) return ['Already booked.'];
  for (const m of r.moved) lines.push(`${names[m.subjectId] ?? m.subjectId}: moved ${fmtShort(m.from)} → ${fmtShort(m.to)}`);
  for (const m of r.replaced) lines.push(`${names[m.subjectId] ?? m.subjectId} on ${fmtShort(m.date)}: replaced by the mock`);
  for (const [d, over] of Object.entries(r.overBy)) lines.push(`${fmtShort(d)} is ${fmtMinutes(over)} over your study time — move or skip something that day if it’s too much.`);
  return lines;
}

/** One short summary for a batch of bookings, using the FINAL state of each day. */
export async function summariseBookings(rs: BookResult[], _names?: Record<string, string>) {
  const booked = rs.filter((r) => !r.alreadyBooked);
  const lines = [`${booked.length} paper${booked.length === 1 ? '' : 's'} booked${booked.length < rs.length ? ` (${rs.length - booked.length} already booked)` : ''}.`];
  const replaced = booked.reduce((n, r) => n + r.replaced.length, 0);
  const moved = booked.reduce((n, r) => n + r.moved.length, 0);
  if (replaced || moved)
    lines.push(`To make room, ${moved ? `${moved} session${moved === 1 ? ' was' : 's were'} moved and ` : ''}${replaced} session${replaced === 1 ? ' was' : 's were'} replaced by the papers. The plan was then re-balanced so every subject keeps regular sessions. Replaced sessions are listed on each day in Schedule.`);
  const [config, exams, all] = await Promise.all([getConfig(), db.exams.toArray(), db.sessions.toArray()]);
  const days = [...new Set(booked.flatMap((r) => [r.mock.date, r.marking.date]))].sort();
  const over = days.map((d) => ({ d, over: loadOn(all, d) - dayCapacity(config, d, exams) })).filter((x) => x.over > 0);
  for (const o of over) lines.push(`${fmtShort(o.d)} is ${fmtMinutes(o.over)} over your study time — the papers alone need that long, or you can move something.`);
  return lines;
}
