import { beforeEach, describe, expect, it } from 'vitest';
import { db, ALL_TABLES } from '@/db/db';
import { SYLLABUS_PACKS } from '@/data/syllabus';
import { generatePlan, schedulableTopics } from '@/scheduling/engine';
import { completeSetup } from '@/services/setup';
import { loadSyllabus, syllabusStatus } from '@/services/topics';
import { addDays } from '@/utils/dates';
import { ctx, TODAY } from './helpers';
import type { Topic } from '@/types';

describe('syllabus packs', () => {
  it('match the supplied Cambridge syllabuses', () => {
    const by = Object.fromEntries(SYLLABUS_PACKS.map((p) => [p.subjectId, p]));
    expect(by.physics.code).toBe('5054');
    expect(by.physics.topics.map((t) => t.title)).toEqual(['Motion, forces and energy', 'Thermal physics', 'Waves', 'Electricity and magnetism', 'Nuclear physics', 'Space physics']);
    expect(by.physics.topics.flatMap((t) => t.children ?? [])).toHaveLength(25);
    expect(by.chemistry.code).toBe('5070');
    expect(by.chemistry.topics).toHaveLength(12);
    expect(by.chemistry.topics.flatMap((t) => t.children ?? [])).toHaveLength(49);
    expect(by.mathd.code).toBe('4024');
    expect(by.mathd.topics.flatMap((t) => t.children ?? [])).toHaveLength(67);
    expect(by.addmath.code).toBe('4037');
    expect(by.addmath.topics).toHaveLength(14);
    expect(by.bangla.code).toBe('3204');
    expect(by.economics.code).toBe('2281');
    expect(by.economics.years).toBe('2027–2029');
    expect(by.economics.topics).toHaveLength(6);
    expect(by.economics.topics.flatMap((t) => t.children ?? [])).toHaveLength(36);
    expect(by.chemistry.papers.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(by.english.code).toBe('1123');
    expect(by.english.years).toBe('2027–2028');
    expect(by.english.papers.map((p) => p.name)).toEqual(['Paper 1 — Reading (2 h, 50 marks, 50%)', 'Paper 2 — Writing (2 h, 50 marks, 50%)']);
    expect(by.english.topics.flatMap((t) => t.children ?? [])).toHaveLength(7);
    expect(SYLLABUS_PACKS).toHaveLength(7);
    // every subtopic ref sits under its parent number
    for (const k of ['physics', 'chemistry', 'mathd', 'economics'])
      for (const t of by[k].topics) for (const c of t.children ?? []) expect(c.ref.split('.')[0]).toBe(t.ref);
    expect(JSON.stringify(SYLLABUS_PACKS)).not.toMatch(/#|\.\.\.\./);
  });
});

describe('loading a syllabus', () => {
  beforeEach(async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
    await completeSetup({ config: {}, loadSyllabuses: false }, TODAY);
  });

  it('is idempotent, keeps hand-added topics and sets the code and papers', async () => {
    await db.topics.put({ id: 'mine', subjectId: 'physics', parentTopicId: null, syllabusReference: null, title: 'My own revision list', learningObjectives: '', order: 0, active: true, inMock: false });
    const n1 = await loadSyllabus('physics');
    expect(n1).toBe(31);
    expect(await loadSyllabus('physics')).toBe(0);
    expect(await db.topics.get('mine')).toBeDefined();
    const s = (await db.subjects.get('physics'))!;
    expect(s.syllabusCode).toBe('5054');
    expect(s.syllabusVersion).toBe('2026–2028');
    expect(s.papers.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect((await syllabusStatus('physics'))!.present).toBe(31);
    expect(await syllabusStatus('economics')).not.toBeNull();
    // Chemistry: an install that still has Paper 4 from the earlier pack loses it on reload
    await db.subjects.update('chemistry', { papers: [{ id: 'p4', name: 'Paper 4 — Alternative to Practical' }, { id: 'x', name: 'My mock paper' }] });
    await loadSyllabus('chemistry');
    expect((await db.subjects.get('chemistry'))!.papers.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'x']);
  });

  it('setup loads all seven packs by default', async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
    await completeSetup({ config: {} }, TODAY);
    expect(await db.topics.count()).toBe(SYLLABUS_PACKS.reduce((n, p) => n + p.topics.length + p.topics.flatMap((t) => t.children ?? []).length, 0));
    const physicsSessions = await db.sessions.where('subjectId').equals('physics').toArray();
    const ids = new Set((await db.topics.where('subjectId').equals('physics').toArray()).filter((t) => !t.parentTopicId).map((t) => t.id));
    for (const s of physicsSessions) for (const tid of s.topicIds) expect(ids.has(tid)).toBe(false); // never a main-topic heading
  });

  it('interleaves across main topics instead of working front to back', async () => {
    await loadSyllabus('mathd');
    const topics = await db.topics.toArray();
    const plan = generatePlan(ctx({ topics: topics as Topic[] }), TODAY, addDays(TODAY, 120));
    const leaves = new Map(schedulableTopics(topics, 'mathd').map((t) => [t.id, t.parentTopicId]));
    const mains = plan
      .filter((s) => s.subjectId === 'mathd' && s.topicIds.length)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((s) => leaves.get(s.topicIds[0]));
    // No main area repeats until all nine (Number … Statistics) have had a session.
    expect(mains.length).toBeGreaterThanOrEqual(9);
    expect(new Set(mains.slice(0, 9)).size).toBe(9);
  });
});
