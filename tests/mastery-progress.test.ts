import { describe, expect, it } from 'vitest';
import { computeMastery } from '@/domain/mastery';
import { dayStats, sessionProgress, rangeStats, subjectSummary } from '@/domain/progress';
import { needsFollowup } from '@/scheduling/carryover';
import { makeSession } from '@/scheduling/engine';
import { attempt, NOW, TODAY } from './helpers';

const S = (p: Parameters<typeof makeSession>[0]) => makeSession(p, NOW, 1);

describe('mastery transitions', () => {
  it('unassessed without evidence', () => expect(computeMastery([]).state).toBe('unassessed'));
  it('red below 50%', () => expect(computeMastery([attempt('t', '2026-11-01', 40)]).state).toBe('red'));
  it('flags confident-but-wrong as a misconception', () =>
    expect(computeMastery([attempt('t', '2026-11-01', 30, { confidence: 'confident' })]).misconception).toBe(true));
  it('one strong unseen result is only provisional, not Secure', () => {
    const m = computeMastery([attempt('t', '2026-11-01', 40), attempt('t', '2026-11-03', 85)]);
    expect(m.state).toBe('amber');
    expect(m.provisional).toBe(true);
    expect(m.nextReviewDate).toBe('2026-11-10');
  });
  it('Secure needs two independent unseen results ≥70% at least 7 days apart', () => {
    expect(computeMastery([attempt('t', '2026-11-01', 80), attempt('t', '2026-11-04', 90)]).state).toBe('amber');
    const m = computeMastery([attempt('t', '2026-11-01', 80), attempt('t', '2026-11-09', 75)]);
    expect(m.state).toBe('green');
    expect(m.retentionConfirmed).toBe(true);
  });
  it('assisted or seen work cannot reach Secure', () => {
    expect(computeMastery([attempt('t', '2026-11-01', 90, { assistanceUsed: 'some' }), attempt('t', '2026-11-12', 95, { assistanceUsed: 'heavy' })]).state).toBe('amber');
    expect(computeMastery([attempt('t', '2026-11-01', 90, { unseen: false }), attempt('t', '2026-11-12', 95, { unseen: false })]).state).toBe('amber');
  });
  it('drops from Secure when a later result falls', () => {
    const base = [attempt('t', '2026-11-01', 80), attempt('t', '2026-11-09', 75)];
    expect(computeMastery([...base, attempt('t', '2026-11-20', 60)]).state).toBe('amber');
    expect(computeMastery([...base, attempt('t', '2026-11-20', 30)]).state).toBe('red');
  });
  it('evidence before a failure does not count toward Secure', () => {
    const m = computeMastery([attempt('t', '2026-10-01', 90), attempt('t', '2026-10-20', 30), attempt('t', '2026-10-25', 85)]);
    expect(m.state).toBe('amber');
    expect(m.provisional).toBe(true);
  });
});

describe('progress and pacing', () => {
  it('a finished Light session is 100% of Light, not 17% of Full', () => {
    const s = S({ id: 'a', date: TODAY, subjectId: 'physics', templateId: 'physics-loop' });
    const light = { ...s, mode: 'light' as const, completedActivities: ['light-recall', 'light-check'] };
    expect(sessionProgress(light)).toBe(1);
    expect(sessionProgress({ ...light, status: 'completed' })).toBe(1);
  });
  it('partial progress is weighted by minutes of the chosen mode', () => {
    const s = S({ id: 'a', date: TODAY, subjectId: 'physics', templateId: 'physics-loop' });
    expect(sessionProgress({ ...s, mode: 'full', completedActivities: ['recall', 'read'] })).toBeCloseTo(30 / 90);
    expect(sessionProgress({ ...s, mode: 'steady', completedActivities: ['recall', 'do'] })).toBeCloseTo(30 / 45);
  });
  it('Light completion of essential learning work needs a follow-up; Steady does not', () => {
    const s = S({ id: 'a', date: TODAY, subjectId: 'physics', templateId: 'physics-loop' });
    expect(needsFollowup({ ...s, mode: 'light', status: 'completed' })).toBe(true);
    expect(needsFollowup({ ...s, mode: 'steady', status: 'completed' })).toBe(false);
    expect(needsFollowup({ ...s, mode: 'light', essential: false })).toBe(false);
  });
  it('counts day completion correctly and excludes folded sessions', () => {
    const base = (id: string, status: 'completed' | 'planned' | 'skipped' | 'converted') => ({ ...S({ id, date: TODAY, subjectId: 'physics', templateId: 'physics-loop' }), status });
    const d = dayStats([base('1', 'completed'), base('2', 'planned'), base('3', 'skipped'), base('4', 'converted')], TODAY);
    expect(d).toMatchObject({ planned: 3, completed: 1, remaining: 1 });
  });
  it('range stats count modes of completed sessions', () => {
    const s = S({ id: 'a', date: TODAY, subjectId: 'physics', templateId: 'physics-loop' });
    const r = rangeStats([{ ...s, status: 'completed', mode: 'light' }, { ...s, id: 'b', status: 'missed' }], TODAY, TODAY);
    expect(r.modeCounts.light).toBe(1);
    expect(r.missed).toBe(1);
  });
  it('subject summary separates coverage from performance and admits thin evidence', () => {
    const sum = subjectSummary('physics', [], [], [attempt('t', TODAY, 60)], {});
    expect(sum.coverage).toBeNull();
    expect(sum.recentAverage).toBe(60);
    expect(sum.enoughEvidence).toBe(false);
  });
});

import { parseTopicLines } from '@/services/topics';
describe('topic import', () => {
  it('parses references, subtopics and Bangla text', () => {
    const rows = parseTopicLines('1 | Motion\n  1.1 Speed and velocity\n- ব্যাকরণ: সমাস ও সন্ধি\n\n2.3) Pressure');
    expect(rows).toEqual([
      { ref: '1', title: 'Motion', child: false },
      { ref: '1.1', title: 'Speed and velocity', child: true },
      { ref: null, title: 'ব্যাকরণ: সমাস ও সন্ধি', child: false },
      { ref: '2.3', title: 'Pressure', child: false }
    ]);
  });
});
