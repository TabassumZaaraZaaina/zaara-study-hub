import { db } from '@/db/db';
import type { SubjectId, Topic } from '@/types';
import { log, uid } from './meta';

/**
 * Parse pasted topic lines. Accepted forms (one topic per line):
 *   "1.2 | Speed and velocity"   → reference + title
 *   "1.2  Speed and velocity"    → leading numeric reference + title
 *   "Speed and velocity"         → title only
 * Indented lines (2+ spaces or a tab) become subtopics of the previous top-level line.
 * Bangla text is preserved as typed.
 */
export function parseTopicLines(text: string): { ref: string | null; title: string; child: boolean }[] {
  return text
    .split(/\r?\n/)
    .map((raw) => {
      const child = /^(\t| {2,})/.test(raw);
      const line = raw.trim().replace(/^[-•*]\s*/, '');
      if (!line) return null;
      const pipe = line.split('|');
      if (pipe.length >= 2) return { ref: pipe[0].trim() || null, title: pipe.slice(1).join('|').trim(), child };
      const m = /^(\d+(?:\.\d+)*[a-z]?)[.)]?\s+(.+)$/i.exec(line);
      if (m) return { ref: m[1], title: m[2].trim(), child };
      return { ref: null, title: line, child };
    })
    .filter((x): x is { ref: string | null; title: string; child: boolean } => !!x && !!x.title);
}

export async function importTopics(subjectId: SubjectId, text: string) {
  const rows = parseTopicLines(text);
  const existing = await db.topics.where('subjectId').equals(subjectId).toArray();
  let order = existing.reduce((m, t) => Math.max(m, t.order + 1), 0);
  const seen = new Set(existing.map((t) => `${t.syllabusReference ?? ''}|${t.title.toLowerCase()}`));
  const out: Topic[] = [];
  let parent: string | null = null;
  for (const r of rows) {
    const key = `${r.ref ?? ''}|${r.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t: Topic = {
      id: uid(), subjectId, parentTopicId: r.child ? parent : null, syllabusReference: r.ref, title: r.title,
      learningObjectives: '', order: order++, active: true, inMock: false, selfRating: null
    };
    if (!r.child) parent = t.id;
    out.push(t);
  }
  await db.topics.bulkPut(out);
  await log('topics.import', 'subject', subjectId, `${out.length} topics`);
  return out.length;
}

export async function updateTopic(id: string, patch: Partial<Topic>) {
  await db.topics.update(id, patch);
}

/** Topics with history are deactivated rather than deleted, to keep references intact. */
export async function removeTopic(id: string) {
  const used = (await db.attempts.where('topicId').equals(id).count()) + (await db.sessions.filter((s) => s.topicIds.includes(id) && s.status !== 'planned').count());
  if (used) {
    await db.topics.update(id, { active: false });
    return 'deactivated';
  }
  await db.transaction('rw', db.topics, db.sessions, async () => {
    await db.topics.delete(id);
    await db.sessions.filter((s) => s.topicIds.includes(id)).modify((s) => { s.topicIds = s.topicIds.filter((x) => x !== id); });
  });
  return 'deleted';
}

// ───────────── Official syllabus packs ─────────────
import { PACK_BY_SUBJECT } from '@/data/syllabus';
import { SUBJECTS } from '@/data/catalog';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Stable id per position in the pack, so loading twice never duplicates. */
export const packTopicId = (subjectId: SubjectId, i: number, j?: number) => `syl-${subjectId}-${i}${j === undefined ? '' : `-${j}`}`;

export async function syllabusStatus(subjectId: SubjectId) {
  const pack = PACK_BY_SUBJECT[subjectId];
  if (!pack) return null;
  const ids = pack.topics.flatMap((t, i) => [packTopicId(subjectId, i), ...(t.children ?? []).map((_, j) => packTopicId(subjectId, i, j))]);
  const present = (await db.topics.bulkGet(ids)).filter(Boolean).length;
  return { pack, total: ids.length, present };
}

/**
 * Add the official topic list for a subject. Idempotent: topics already
 * present (by pack id, or by identical title typed by hand) are skipped, and
 * nothing existing is changed or removed. Also records the syllabus code,
 * years and papers on the subject.
 */
export async function loadSyllabus(subjectId: SubjectId): Promise<number> {
  const pack = PACK_BY_SUBJECT[subjectId];
  if (!pack) return 0;
  return db.transaction('rw', db.topics, db.subjects, db.history, async () => {
    const existing = await db.topics.where('subjectId').equals(subjectId).toArray();
    const byId = new Set(existing.map((t) => t.id));
    const byTitle = new Map(existing.map((t) => [norm(t.title), t.id]));
    let order = existing.reduce((m, t) => Math.max(m, t.order + 1), 0);
    const out: Topic[] = [];
    pack.topics.forEach((p, i) => {
      const pid = packTopicId(subjectId, i);
      let parentId = pid;
      if (!byId.has(pid)) {
        const same = byTitle.get(norm(p.title));
        if (same) parentId = same;
        else out.push({ id: pid, subjectId, parentTopicId: null, syllabusReference: p.ref, title: p.title, learningObjectives: '', order: order++, active: true, inMock: false, selfRating: null });
      }
      (p.children ?? []).forEach((c, j) => {
        const cid = packTopicId(subjectId, i, j);
        if (byId.has(cid) || byTitle.has(norm(c.title))) return;
        out.push({
          id: cid, subjectId, parentTopicId: parentId, syllabusReference: c.ref, title: c.title,
          learningObjectives: c.covers?.length ? `Covers: ${c.covers.join('; ')}` : '', order: order++, active: true, inMock: false, selfRating: null
        });
      });
    });
    await db.topics.bulkPut(out);
    const subject = (await db.subjects.get(subjectId)) ?? SUBJECTS.find((s) => s.id === subjectId)!;
    const packIds = new Set(pack.papers.map((p) => p.id));
    const keep = subject.papers.filter((p) => !packIds.has(p.id) && !pack.retired?.includes(p.id) && !pack.papers.some((q) => norm(q.name) === norm(p.name)));
    await db.subjects.put({ ...subject, syllabusCode: pack.code, syllabusVersion: pack.years, papers: [...pack.papers, ...keep] });
    await log('syllabus.load', 'subject', subjectId, `${pack.code} (${pack.years}): ${out.length} topics added`);
    return out.length;
  });
}

export async function loadAllSyllabuses() {
  let n = 0;
  for (const s of SUBJECTS) n += await loadSyllabus(s.id);
  return n;
}

/** Apply paper corrections from updated packs (e.g. Chemistry Paper 4 removed) to subjects already loaded. */
export async function applyPackCorrections() {
  for (const pack of Object.values(PACK_BY_SUBJECT)) {
    if (!pack?.retired?.length) continue;
    const s = await db.subjects.get(pack.subjectId);
    if (!s || s.syllabusCode !== pack.code) continue;
    const papers = s.papers.filter((p) => !pack.retired!.includes(p.id)).map((p) => pack.papers.find((q) => q.id === p.id) ?? p);
    if (JSON.stringify(papers) !== JSON.stringify(s.papers)) await db.subjects.put({ ...s, papers });
  }
}
