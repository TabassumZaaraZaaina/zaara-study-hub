import { useEffect, useState } from 'react';
import { ExternalLink, Pencil, Plus, Search } from 'lucide-react';
import { db } from '@/db/db';
import { useResources, useSubjectMap, useSubjects, useTopics } from '@/hooks/data';
import { uid } from '@/services/meta';
import { Button, Card, Empty, Field, PageHeader, Sheet } from '@/components/ui';
import type { Resource, SubjectId } from '@/types';

const TYPES: Record<Resource['type'], string> = {
  textbook: 'Textbook', syllabus: 'Syllabus', 'past-paper': 'Past paper', 'mark-scheme': 'Mark scheme', video: 'Video',
  notebooklm: 'NotebookLM', worksheet: 'Worksheet', notes: 'My notes', teacher: 'From teacher'
};

export function ResourcesScreen() {
  const resources = useResources();
  const subjects = useSubjectMap();
  const [q, setQ] = useState('');
  const [subj, setSubj] = useState<SubjectId | ''>('');
  const [editing, setEditing] = useState<Resource | 'new' | null>(null);
  const list = resources
    .filter((r) => !subj || r.subjectId === subj)
    .filter((r) => !q || `${r.title} ${r.notes ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title));
  return (
    <div className="animate-rise">
      <PageHeader back="/subjects" title="Resources" subtitle="Links to your books, papers, videos and NotebookLM notebooks." action={<Button size="sm" onClick={() => setEditing('new')}><Plus size={15} /> Add</Button>} />
      <div className="flex gap-2">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field pl-9" placeholder="Search" aria-label="Search resources" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="field w-36" aria-label="Filter subject" value={subj} onChange={(e) => setSubj(e.target.value as SubjectId | '')}>
          <option value="">All</option>
          {Object.values(subjects).map((s) => <option key={s.id} value={s.id}>{s.shortName}</option>)}
        </select>
      </div>
      <div className="mt-4 space-y-2">
        {!list.length && <Empty title="No resources yet" action={<Button size="sm" onClick={() => setEditing('new')}><Plus size={15} /> Add a resource</Button>}>Add links once and they appear inside the matching study sessions.</Empty>}
        {list.map((r) => (
          <Card key={r.id} className="flex items-center gap-2 p-2 pl-4">
            <a href={r.url} target="_blank" rel="noreferrer" onClick={() => db.resources.update(r.id, { lastAccessed: new Date().toISOString() })} className="min-w-0 flex-1 py-2">
              <p className="truncate font-semibold" lang="und">{r.title}</p>
              <p className="text-[13px] text-muted">{r.subjectId ? subjects[r.subjectId]?.shortName : 'All subjects'} · {TYPES[r.type]}{r.lastAccessed ? ` · opened ${r.lastAccessed.slice(0, 10)}` : ''}</p>
            </a>
            {r.url && <ExternalLink size={16} className="text-muted" />}
            <button aria-label={`Edit ${r.title}`} onClick={() => setEditing(r)} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sunken"><Pencil size={16} /></button>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-[13px] text-muted">NotebookLM links open NotebookLM itself. ZAARA doesn’t sync with NotebookLM — your notebooks stay there.</p>
      <ResourceSheet value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ResourceSheet({ value, onClose }: { value: Resource | 'new' | null; onClose: () => void }) {
  const subjects = useSubjects();
  const topics = useTopics();
  const blank: Resource = { id: '', subjectId: null, topicIds: [], title: '', type: 'textbook', url: '' };
  const [r, setR] = useState<Resource>(blank);
  useEffect(() => setR(value && value !== 'new' ? value : blank), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!value) return null;
  const urlOk = !r.url || /^https?:\/\//i.test(r.url);
  return (
    <Sheet open={!!value} onClose={onClose} title={value === 'new' ? 'Add resource' : 'Edit resource'}>
      <div className="space-y-4">
        <Field label="Title"><input className="field" value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject">
            <select className="field" value={r.subjectId ?? ''} onChange={(e) => setR({ ...r, subjectId: (e.target.value || null) as SubjectId | null, topicIds: [] })}>
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select className="field" value={r.type} onChange={(e) => setR({ ...r, type: e.target.value as Resource['type'] })}>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Link" hint={urlOk ? undefined : 'Links should start with https://'}><input className="field" inputMode="url" value={r.url ?? ''} onChange={(e) => setR({ ...r, url: e.target.value.trim() })} placeholder="https://" /></Field>
        {r.subjectId && (
          <Field label="Topic (optional)">
            <select className="field" value={r.topicIds[0] ?? ''} onChange={(e) => setR({ ...r, topicIds: e.target.value ? [e.target.value] : [] })}>
              <option value="">Whole subject</option>
              {topics.filter((t) => t.subjectId === r.subjectId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notes"><textarea className="field" value={r.notes ?? ''} onChange={(e) => setR({ ...r, notes: e.target.value })} /></Field>
        <Button className="w-full" disabled={!r.title.trim() || !urlOk} onClick={async () => { await db.resources.put({ ...r, id: r.id || uid(), title: r.title.trim() }); onClose(); }}>Save</Button>
        {value !== 'new' && <Button variant="ghost" className="w-full" onClick={async () => { await db.resources.delete(r.id); onClose(); }}>Delete</Button>}
      </div>
    </Sheet>
  );
}
