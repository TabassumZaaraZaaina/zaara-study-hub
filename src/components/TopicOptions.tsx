import type { Topic } from '@/types';

/** <option>s for a topic <select>: subtopics grouped under their main topic; main topics with subtopics aren't selectable. */
export function TopicOptions({ topics }: { topics: Topic[] }) {
  const parents = new Set(topics.map((t) => t.parentTopicId).filter(Boolean));
  const roots = topics.filter((t) => !t.parentTopicId).sort((a, b) => a.order - b.order);
  const label = (t: Topic) => (t.syllabusReference ? `${t.syllabusReference} ${t.title}` : t.title);
  return (
    <>
      {roots.map((r) =>
        parents.has(r.id) ? (
          <optgroup key={r.id} label={label(r)}>
            {topics.filter((c) => c.parentTopicId === r.id).sort((a, b) => a.order - b.order).map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
          </optgroup>
        ) : (
          <option key={r.id} value={r.id}>{label(r)}</option>
        )
      )}
    </>
  );
}
