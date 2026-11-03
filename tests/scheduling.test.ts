import { describe, expect, it } from 'vitest';
import { generatePlan, regeneratePlan, dayCapacity, loadOn, nextExamFor, subjectPriorities } from '@/scheduling/engine';
import { applyPlacement, carryQueue, proposePlacement, reconcile, isBacklogged } from '@/scheduling/carryover';
import { addDays, dateRange } from '@/utils/dates';
import { ctx, config, exam, topics, TODAY, NOW, byDate } from './helpers';

const TO = addDays(TODAY, 27);

describe('plan generation', () => {
  it('assigns sessions only to valid dates within the range and plan start', () => {
    const c = ctx({ config: config({ planStart: '2026-11-05' }) });
    const plan = generatePlan(c, TODAY, TO);
    expect(plan.length).toBeGreaterThan(20);
    for (const s of plan) {
      expect(s.date >= '2026-11-05' && s.date <= TO).toBe(true);
      expect(s.originalDate).toBe(s.date);
    }
  });

  it('never exceeds daily capacity', () => {
    const c = ctx();
    const plan = generatePlan(c, TODAY, TO);
    for (const d of dateRange(TODAY, TO)) expect(loadOn(plan, d)).toBeLessThanOrEqual(dayCapacity(c.config, d, []));
  });

  it('respects unavailable periods and fixed commitments', () => {
    const c = ctx({
      config: config({
        unavailable: [{ id: 'u', start: '2026-11-10', end: '2026-11-12', label: 'Trip' }],
        commitments: [{ id: 'c', label: 'Tutor', weekday: 6, minutes: 90 }]
      })
    });
    const plan = generatePlan(c, TODAY, TO);
    for (const d of ['2026-11-10', '2026-11-11', '2026-11-12']) expect(byDate(plan, d)).toHaveLength(0);
    // Saturday 7 Nov: 180 − 90 tutoring = 90 → exactly one full session
    expect(loadOn(plan, '2026-11-07')).toBe(90);
  });

  it('does not put the same subject twice on one day', () => {
    const plan = generatePlan(ctx(), TODAY, TO);
    for (const d of dateRange(TODAY, TO)) {
      const subs = byDate(plan, d).map((s) => s.subjectId);
      expect(new Set(subs).size).toBe(subs.length);
    }
  });

  it('covers all seven subjects within each week', () => {
    const plan = generatePlan(ctx(), TODAY, addDays(TODAY, 6));
    expect(new Set(plan.map((s) => s.subjectId)).size).toBe(7);
  });

  it('prioritises a subject whose exam is approaching', () => {
    const exams = [exam('economics', addDays(TODAY, 6))];
    const plan = generatePlan(ctx({ exams }), TODAY, addDays(TODAY, 5));
    const econ = plan.filter((s) => s.subjectId === 'economics').length;
    const bangla = plan.filter((s) => s.subjectId === 'bangla').length;
    expect(econ).toBeGreaterThan(bangla);
    // Day before the exam: economics first, exam-focused template, with a factual reason
    const eve = byDate(plan, addDays(TODAY, 5)).sort((a, b) => a.order - b.order);
    expect(eve[0].subjectId).toBe('economics');
    expect(eve[0].purpose).toBe('exam');
    expect(eve[0].reason).toMatch(/in 1 day/);
  });

  it('uses the confirmed Mock 2 start as the target when paper dates are missing', () => {
    const t = nextExamFor('physics', TODAY, []);
    expect(t.date).toBe('2026-11-25');
    expect(t.approximate).toBe(true);
    const during = nextExamFor('physics', '2026-11-30', []);
    expect(during.inPeriodUnknown).toBe(true);
    // Without entered dates the assumed mock window ends after 14 days — no endless exam mode.
    expect(nextExamFor('physics', '2026-12-12', []).inPeriodUnknown).toBe(false);
    expect(nextExamFor('physics', '2026-12-12', []).label).toMatch(/Finals/);
  });

  it('gives more weight to subjects with weak topics', () => {
    const ts = topics('chemistry', 4);
    const mastery = Object.fromEntries(ts.map((t) => [t.id, 'red' as const]));
    const p = subjectPriorities({ subjects: ctx().subjects, topics: ts, exams: [], mastery }, TODAY);
    const chem = p.find((x) => x.subjectId === 'chemistry')!;
    expect(chem.weak).toBeCloseTo(1.48);
  });

  it('assigns topics least-practised first and pulls weak topics forward', () => {
    const ts = topics('physics', 3);
    const plan = generatePlan(ctx({ topics: ts, mastery: { 'physics-t3': 'red' } }), TODAY, TO);
    const phys = plan.filter((s) => s.subjectId === 'physics' && s.topicIds.length).sort((a, b) => (a.date < b.date ? -1 : 1));
    expect(phys[0].topicIds).toEqual(['physics-t3']);
    expect(new Set(phys.slice(0, 4).flatMap((s) => s.topicIds)).size).toBe(3);
  });

  it('works with no topics entered (provisional, subject/activity level)', () => {
    const plan = generatePlan(ctx(), TODAY, TO);
    expect(plan.every((s) => s.topicIds.length === 0)).toBe(true);
  });

  it('halves capacity on an exam day and schedules no session for the examined subject', () => {
    const d = '2026-11-08'; // Sunday: 135
    const plan = generatePlan(ctx({ exams: [exam('physics', d)] }), d, d);
    expect(loadOn(plan, d)).toBeLessThanOrEqual(60);
    expect(byDate(plan, d).some((s) => s.subjectId === 'physics')).toBe(false);
  });
});

describe('regeneration', () => {
  it('preserves completed, started, moved and pinned sessions; never duplicates', () => {
    const c = ctx();
    const plan = generatePlan(c, TODAY, TO);
    plan[0].status = 'completed';
    plan[1].completedActivities = ['recall'];
    plan[1].status = 'in_progress';
    plan[2].pinned = true;
    plan[3].moves = [{ from: TODAY, to: plan[3].date, at: NOW, reason: 'x', auto: true }];
    const { removed, created } = regeneratePlan({ ...c, existing: plan }, TODAY, TO);
    const removedIds = new Set(removed.map((s) => s.id));
    for (const keep of plan.slice(0, 4)) expect(removedIds.has(keep.id)).toBe(false);
    const after = [...plan.filter((s) => !removedIds.has(s.id)), ...created];
    expect(new Set(after.map((s) => s.id)).size).toBe(after.length);
    for (const d of dateRange(TODAY, TO)) expect(loadOn(after, d)).toBeLessThanOrEqual(dayCapacity(c.config, d, []));
  });

  it('reprioritises when an exam date changes', () => {
    const c = ctx();
    const plan = generatePlan(c, TODAY, TO);
    const exams = [exam('bangla', addDays(TODAY, 4))];
    const { created, removed } = regeneratePlan({ ...c, existing: plan, exams }, TODAY, TO);
    const kept = plan.filter((s) => !removed.includes(s));
    const next4 = [...kept, ...created].filter((s) => s.date < addDays(TODAY, 4));
    const bangla = next4.filter((s) => s.subjectId === 'bangla').length;
    expect(bangla).toBe(4); // a slot every day in exam week
  });
});

describe('missed work', () => {
  const setup = () => {
    const c = ctx({ topics: topics('addmath', 6) });
    const plan = generatePlan(c, TODAY, addDays(TODAY, 60)); // long enough for several Add Maths slots
    return { c, plan };
  };

  it('end of day: unfinished work becomes missed/partial, keeps date, never completed', () => {
    const { plan } = setup();
    const day = byDate(plan, TODAY);
    day[0].completedActivities = ['recall'];
    day[0].status = 'in_progress';
    const changed = reconcile(plan, addDays(TODAY, 1), NOW);
    const statuses = Object.fromEntries(changed.map((s) => [s.id, s.status]));
    expect(statuses[day[0].id]).toBe('partial');
    expect(statuses[day[1].id]).toBe('missed');
    expect(changed.every((s) => s.date === TODAY && s.status !== 'completed')).toBe(true);
    // Future days are untouched.
    expect(changed.every((s) => s.date < addDays(TODAY, 1))).toBe(true);
  });

  it('a missed Add Maths session is preserved and slides into the next Add Maths slot', () => {
    const { c, plan } = setup();
    const missed = plan.find((s) => s.subjectId === 'addmath' && s.topicIds.length)!;
    const tomorrow = addDays(missed.date, 1);
    const all = plan.map((s) => (s.date < tomorrow && s.status === 'planned' ? { ...s, status: s.id === missed.id ? 'missed' : 'completed' } : s)) as typeof plan;
    const queue = carryQueue(all, tomorrow);
    expect(queue.map((s) => s.id)).toEqual([missed.id]);
    const m = queue[0];
    const p = proposePlacement(m, all, c.config, [], tomorrow);
    expect(p.type).toBe('shift');
    if (p.type !== 'shift') return;
    const nextAddMath = all
      .filter((s) => s.subjectId === 'addmath' && s.date >= tomorrow && s.purpose !== 'exam')
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const r = applyPlacement(m, p, all, NOW, 'Not started.', true);
    const after = all.filter((s) => !r.deletes.includes(s.id)).map((s) => r.updates.find((u) => u.id === s.id) ?? s);
    const moved = after.find((s) => s.id === missed.id)!;
    expect(moved.date).toBe(nextAddMath[0].date);
    expect(moved.originalDate).toBe(missed.date);
    expect(moved.moves).toHaveLength(1);
    expect(moved.topicIds).toEqual(missed.topicIds);
    // The displaced topic is not lost — it moves to the following slot.
    const second = after.find((s) => s.id === nextAddMath[1].id)!;
    expect(second.topicIds).toEqual(nextAddMath[0].topicIds);
    // No duplicate sessions and no extra hours anywhere.
    expect(new Set(after.map((s) => s.id)).size).toBe(after.length);
    for (const d of dateRange(tomorrow, TO)) expect(loadOn(after, d)).toBeLessThanOrEqual(dayCapacity(c.config, d, []));
    expect(carryQueue(after, tomorrow)).toHaveLength(0);
  });

  it('prefers genuinely free time over shifting', () => {
    const c = ctx({ config: config({ capacity: [180, 180, 180, 180, 180, 180, 180] }) });
    const s = generatePlan(c, TODAY, TODAY)[0];
    const missed = { ...s, status: 'missed' as const };
    // Tomorrow has nothing planned → free
    const p = proposePlacement(missed, [missed], c.config, [], addDays(TODAY, 1));
    expect(p.type).toBe('free');
  });

  it('does not place work after the subject’s exam and reports when there is nowhere to go', () => {
    const c = ctx();
    const tomorrow = addDays(TODAY, 1);
    const plan = generatePlan(c, TODAY, TO);
    const missed = { ...plan.find((s) => s.subjectId === 'physics' && s.date === TODAY) ?? plan.find((s) => s.date === TODAY)!, status: 'missed' as const };
    const exams = [exam(missed.subjectId, addDays(TODAY, 2))];
    const all = plan.map((s) => (s.id === missed.id ? missed : s));
    const p = proposePlacement(missed, all, c.config, exams, tomorrow);
    if (p.type !== 'none') expect(p.date < addDays(TODAY, 2)).toBe(true);
  });

  it('skipped and non-essential sessions do not enter the queue', () => {
    const { plan } = setup();
    const d = byDate(plan, TODAY);
    const all = plan.map((s) => (s.id === d[0].id ? { ...s, status: 'skipped' as const } : s.id === d[1].id ? { ...s, status: 'missed' as const, essential: false } : s));
    expect(carryQueue(all, addDays(TODAY, 1))).toHaveLength(0);
  });

  it('flags backlog when unplaceable work accumulates', () => {
    const c = config();
    expect(isBacklogged(4, 100, c)).toBe(true);
    expect(isBacklogged(1, 100, c)).toBe(false);
    expect(isBacklogged(0, 600, c)).toBe(true);
  });
});
