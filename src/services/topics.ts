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
