import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardCheck, ExternalLink } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { MASTERY_LABEL, computeMastery, pct } from '@/domain/mastery';
import { ERROR_LABEL } from '@/domain/repair';
import { useAttempts, useErrors, useResources, useSessions, useSubjectMap, useToday } from '@/hooks/data';
import { removeTopic, updateTopic } from '@/services/topics';
import { Button, Card, Chip, Field, MasteryPill, PageHeader, SectionTitle, Sheet, Sparkline, cx } from '@/components/ui';
import type { ErrorCategory } from '@/types';
import { fmtShort } from '@/utils/dates';

const ASSIST = { none: 'independent', some: 'some help', heavy: 'lots of help' } as const;

export function TopicScreen() {
  const { id } = useParams();
  const topic = useLiveQuery(() => db.topics.get(id!), [id]);
  const subjects = useSubjectMap();
  const attempts = useAttempts().filter((a) => a.topicId === id).sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1));
  const errors = useErrors().filter((e) => e.topicId === id);
  const sessions = (useSessions() ?? []).filter((s) => s.topicIds.includes(id!));
  const resources = useResources().filter((r) => r.topicIds.includes(id!));
  const today = useToday();
  const nav = useNavigate();
  const [edit, setEdit] = useState(false);
  if (!topic) return null;
  const m = computeMastery(attempts);
  const completed = sessions.filter((s) => s.status === 'completed');
  const upcomingRetest = sessions.filter((s) => (s.source === 'retest' || s.source === 'review') && s.date >= today && s.status === 'planned').sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const cats = errors.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + 1 }), {});
  const last = attempts.at(-1);

  return (
    <div className="animate-rise">
      <PageHeader back={`/subjects/${topic.subjectId}`} title={topic.title} subtitle={`${subjects[topic.subjectId]?.name ?? ''}${topic.syllabusReference ? ` · ${topic.syllabusReference}` : ''}`} />
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <MasteryPill state={m.state} provisional={m.provisional} />
          {m.misconception && <Chip tone="red">Confident but wrong — check this idea</Chip>}
        </div>
        <p className="mt-3 text-sm text-muted">{m.explanation}</p>
        {topic.selfRating && m.state === 'unassessed' && <p className="mt-1 text-sm text-muted">Your own starting rating: {MASTERY_LABEL[topic.selfRating]} (not evidence).</p>}
        {attempts.length >= 2 && <div className="mt-4"><Sparkline values={attempts.map(pct)} /><p className="text-right text-[11px] text-muted">dashed line = 50%</p></div>}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted">Last attempt</dt><dd className="font-semibold">{last ? `${pct(last)}% · ${fmtShort(last.date)}` : '—'}</dd></div>
          <div><dt className="text-muted">Next check</dt><dd className="font-semibold">{upcomingRetest ? fmtShort(upcomingRetest.date) : m.nextReviewDate ? fmtShort(m.nextReviewDate) : '—'}</dd></div>
          <div><dt className="text-muted">Sessions done</dt><dd className="font-semibold">{completed.length}</dd></div>
          <div><dt className="text-muted">Retention</dt><dd className="font-semibold">{m.retentionConfirmed ? 'Confirmed' : m.provisional ? 'Being confirmed' : '—'}</dd></div>
        </dl>
        <Button className="mt-4 w-full" variant="soft" onClick={() => nav(`/assess?subject=${topic.subjectId}&topic=${topic.id}`)}><ClipboardCheck size={16} /> Record a result</Button>
      </Card>

      {topic.learningObjectives && (
        <>
          <SectionTitle>Learning objectives</SectionTitle>
          <Card className="whitespace-pre-wrap p-4 text-[15px]" >{topic.learningObjectives}</Card>
        </>
      )}

      <SectionTitle>History</SectionTitle>
      {attempts.length ? (
        <Card className="divide-y divide-line">
          {[...attempts].reverse().map((a) => (
            <div key={a.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span>{fmtShort(a.date)} · {a.assessmentType.replace('-', ' ')}</span>
                <span className={cx('font-semibold', pct(a) < 50 ? 'text-red' : pct(a) >= 70 ? 'text-green' : 'text-amber')}>{pct(a)}%</span>
              </div>
              <p className="text-[13px] text-muted">{ASSIST[a.assistanceUsed]} · {a.unseen ? 'unseen questions' : 'seen before'}{a.confidence ? ` · felt ${a.confidence}` : ''}{a.source === 'generated-practice' ? ' · generated practice' : ''}</p>
            </div>
          ))}
        </Card>
      ) : (
        <p className="text-sm text-muted">No results yet. Mastery is based on marked work, so record a result after practice.</p>
      )}

      {Object.keys(cats).length > 0 && (
        <>
          <SectionTitle>Common errors</SectionTitle>
          <div className="flex flex-wrap gap-2">{Object.entries(cats).map(([k, n]) => <Chip key={k}>{ERROR_LABEL[k as ErrorCategory]} · {n}</Chip>)}</div>
        </>
      )}

      {resources.length > 0 && (
        <>
          <SectionTitle>Resources</SectionTitle>
          <div className="space-y-2">{resources.map((r) => <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="flex min-h-[48px] items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm"><ExternalLink size={15} className="text-muted" />{r.title}</a>)}</div>
        </>
      )}

      <Button variant="ghost" className="mt-6 w-full" onClick={() => setEdit(true)}>Edit topic</Button>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Edit topic">
        <div className="space-y-4">
          <Field label="Title"><input className="field" defaultValue={topic.title} onBlur={(e) => e.target.value.trim() && updateTopic(topic.id, { title: e.target.value.trim() })} /></Field>
          <Field label="Syllabus reference"><input className="field" defaultValue={topic.syllabusReference ?? ''} onBlur={(e) => updateTopic(topic.id, { syllabusReference: e.target.value.trim() || null })} /></Field>
          <Field label="Learning objectives"><textarea className="field min-h-[100px]" defaultValue={topic.learningObjectives} onBlur={(e) => updateTopic(topic.id, { learningObjectives: e.target.value })} /></Field>
          <label className="flex min-h-[44px] items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[rgb(var(--primary))]" defaultChecked={topic.inMock} onChange={(e) => updateTopic(topic.id, { inMock: e.target.checked })} /> Included in Mock 2</label>
          <Field label="Starting self-rating (optional)" hint="Shown only until real results exist. Never counted as evidence.">
            <select className="field" value={topic.selfRating ?? ''} onChange={(e) => updateTopic(topic.id, { selfRating: (e.target.value || null) as never })}>
              <option value="">—</option><option value="red">Needs practice</option><option value="amber">Developing</option><option value="green">Secure</option>
            </select>
          </Field>
          <Button variant="danger" className="w-full" onClick={async () => { const r = await removeTopic(topic.id); setEdit(false); if (r === 'deleted') nav(`/subjects/${topic.subjectId}`); }}>
            Remove topic
          </Button>
          <p className="text-[13px] text-muted">Topics with results or history are hidden rather than deleted, so your records stay intact.</p>
        </div>
      </Sheet>
    </div>
  );
}
