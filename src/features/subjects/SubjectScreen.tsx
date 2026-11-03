import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardCheck, Plus, Search, Settings2, Trash2 } from 'lucide-react';
import { db } from '@/db/db';
import { SUBJECT_CYCLE, SUBJECT_STYLE, TEMPLATE_BY_ID } from '@/data/catalog';
import { computeMastery, pct } from '@/domain/mastery';
import { subjectSummary } from '@/domain/progress';
import { useAttempts, useExams, useMastery, useRepairs, useSessions, useSubjectMap, useToday, useTopics } from '@/hooks/data';
import { importTopics, loadSyllabus, syllabusStatus } from '@/services/topics';
import { useLiveQuery } from 'dexie-react-hooks';
import { regenerateFuture } from '@/services/plan';
import { uid } from '@/services/meta';
import { SessionRow } from '@/components/session';
import { Button, Card, Empty, Field, MasteryPill, PageHeader, SectionTitle, Sheet, cx } from '@/components/ui';
import type { SubjectId } from '@/types';
import { addDays, fmtShort, localDate } from '@/utils/dates';
import { MasteryStack } from './MasteryStack';

export function SubjectScreen() {
  const { id } = useParams() as { id: SubjectId };
  const subjects = useSubjectMap();
  const subject = subjects[id];
  const allTopics = useTopics();
  const attempts = useAttempts();
  const sessions = useSessions() ?? [];
  const exams = useExams();
  const repairs = useRepairs();
  const today = useToday();
  const nav = useNavigate();
  const mastery = useMastery(allTopics, attempts);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [q, setQ] = useState('');
  if (!subject) return null;

  const topics = allTopics.filter((t) => t.subjectId === id && t.active);
  const isParent = (tid: string) => topics.some((c) => c.parentTopicId === tid);
  const sum = subjectSummary(id, allTopics, sessions, attempts, mastery);
  const subjAttempts = attempts.filter((a) => a.subjectId === id).sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
  const upcoming = sessions.filter((s) => s.subjectId === id && s.date >= today && ['planned', 'in_progress'].includes(s.status)).sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
  const retests = upcoming.filter((s) => s.source === 'retest' || s.source === 'review');
  const subjectExams = exams.filter((e) => e.subjectId === id).sort((a, b) => ((a.date ?? '9') < (b.date ?? '9') ? -1 : 1));
  const weak = topics.filter((t) => mastery[t.id] === 'red');
  const openRepairs = repairs.filter((r) => r.subjectId === id && r.status !== 'closed');
  const done14 = sessions.filter((s) => s.subjectId === id && s.status === 'completed' && s.date >= addDays(today, -13) && s.date <= today).length;
  const planned14 = sessions.filter((s) => s.subjectId === id && s.date >= addDays(today, -13) && s.date <= today && ['completed', 'partial', 'missed', 'skipped', 'planned', 'in_progress'].includes(s.status)).length;
  const filtered = q ? topics.filter((t) => `${t.syllabusReference ?? ''} ${t.title}`.toLowerCase().includes(q.toLowerCase())) : topics;
  const byPaper = subject.papers.map((p) => {
    const xs = subjAttempts.filter((a) => a.paper === p.id);
    return { p, n: xs.length, avg: xs.length ? Math.round(xs.reduce((t, a) => t + pct(a), 0) / xs.length) : null };
  });

  return (
    <div className="animate-rise">
      <PageHeader
        back="/subjects"
        title={subject.name}
        subtitle={<>{subject.syllabusCode ? `Syllabus ${subject.syllabusCode}` : 'Syllabus code pending — add it from your Statement of Entry'}</>}
        action={<button aria-label="Edit subject details" onClick={() => setEditOpen(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-sunken"><Settings2 size={20} /></button>}
      />

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Sessions (14 days)" value={`${done14}/${planned14}`} hint="activity completed" />
        <Metric label="Syllabus coverage" value={sum.coverage === null ? '—' : `${sum.topicsPractised}/${sum.topicsListed}`} hint={sum.coverage === null ? 'no topics listed yet' : 'topics practised'} />
        <Metric label="Recent results" value={sum.recentAverage === null ? '—' : `${sum.recentAverage}%`} hint={sum.recentCount ? `average of last ${sum.recentCount}` : 'no results yet'} />
        <Metric label="Open repairs" value={String(openRepairs.length)} hint={`${weak.length} topic${weak.length === 1 ? '' : 's'} need practice`} />
      </div>
      {!sum.enoughEvidence && <p className="mt-3 text-sm text-muted">Not enough assessment data yet to judge exam readiness. Record results after marked practice to build the picture.</p>}
      {sum.topicsListed > 0 && (
        <Card className="mt-3 p-4">
          <p className="mb-2 text-sm font-semibold">Demonstrated mastery</p>
          <MasteryStack counts={sum.mastery} legend />
        </Card>
      )}

      <SectionTitle>How you study {subject.shortName}</SectionTitle>
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {[...new Set(SUBJECT_CYCLE[id])].map((t) => (
            <span key={t} className="rounded-full px-3 py-1.5 text-sm font-medium" style={{ background: SUBJECT_STYLE[id].soft, color: SUBJECT_STYLE[id].ink }}>{TEMPLATE_BY_ID[t].name}</span>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">Close to an exam, sessions switch to exam preparation and timed practice.</p>
      </Card>

      {subjectExams.length > 0 && (
        <>
          <SectionTitle action={<Link to="/exams" className="text-sm font-semibold text-primary">Edit</Link>}>Exams</SectionTitle>
          <Card className="divide-y divide-line">
            {subjectExams.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{e.group === 'mock2' ? 'Mock 2' : 'Final'} · {e.paper}</span>
                <span className="text-muted">{e.date ? fmtShort(e.date) : 'date pending'}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {subject.papers.length > 0 && (
        <>
          <SectionTitle>Papers</SectionTitle>
          <Card className="divide-y divide-line">
            {byPaper.map(({ p, n, avg }) => (
              <div key={p.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted">{n ? `${n} result${n === 1 ? '' : 's'} · ${avg}%` : 'no results yet'}</span>
                </div>
                {p.note && <p className="mt-0.5 text-[13px] text-muted">{p.note}</p>}
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Coming up</SectionTitle>
      {upcoming.length ? (
        <Card className="p-2">{upcoming.slice(0, 4).map((s) => <SessionRow key={s.id} s={s} subject={subject} topics={allTopics} today={today} />)}</Card>
      ) : (
        <p className="text-sm text-muted">Nothing planned yet.</p>
      )}
      {retests.length > 0 && <p className="mt-2 text-sm text-muted">{retests.length} retest{retests.length === 1 ? '' : 's'} planned.</p>}

      <SyllabusCard subjectId={id} />
      <SectionTitle action={<button onClick={() => setImportOpen(true)} className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-primary"><Plus size={15} /> Add topics</button>}>
        Topics
      </SectionTitle>
      {topics.length ? (
        <>
          {topics.length > 6 && (
            <label className="relative mb-2 block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="field pl-9" placeholder="Search topics" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search topics" />
            </label>
          )}
          <Card className="divide-y divide-line">
            {filtered.map((t) => {
              const m = computeMastery(attempts.filter((a) => a.topicId === t.id));
              return (
                <Link key={t.id} to={`/topics/${t.id}`} className={cx('flex min-h-[56px] items-center gap-3 px-4 py-3', t.parentTopicId && 'pl-8', isParent(t.id) && 'bg-sunken/60 font-semibold')}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug" lang="und">{t.syllabusReference && <span className="mr-1.5 text-muted">{t.syllabusReference}</span>}{t.title}</span>
                    {t.inMock && <span className="text-[12px] font-medium text-primary">In Mock 2</span>}
                  </span>
                  {isParent(t.id) ? <span className="text-[12px] text-muted">{topics.filter((c) => c.parentTopicId === t.id).length} subtopics</span> : <MasteryPill state={m.state} provisional={m.provisional} />}
                </Link>
              );
            })}
          </Card>
        </>
      ) : (
        <Empty title="No topics yet" action={<Button size="sm" onClick={() => setImportOpen(true)}><Plus size={15} /> Add topics</Button>}>
          Paste the topic list from your verified syllabus. Until then, sessions are planned at subject level and you choose the topic when you start.
        </Empty>
      )}

      <SectionTitle action={<Button size="sm" variant="soft" onClick={() => nav(`/assess?subject=${id}`)}><ClipboardCheck size={15} /> Record</Button>}>Recent results</SectionTitle>
      {subjAttempts.length ? (
        <Card className="divide-y divide-line">
          {subjAttempts.slice(0, 6).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{allTopics.find((t) => t.id === a.topicId)?.title ?? 'Mixed'} <span className="text-muted">· {fmtShort(a.date)}</span></span>
              <span className={cx('font-semibold', pct(a) < 50 ? 'text-red' : pct(a) >= 70 ? 'text-green' : 'text-amber')}>{a.marksEarned}/{a.marksAvailable}</span>
            </div>
          ))}
        </Card>
      ) : (
        <p className="text-sm text-muted">No results recorded yet.</p>
      )}

      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} subjectId={id} />
      <SubjectEditSheet open={editOpen} onClose={() => setEditOpen(false)} subjectId={id} />
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-[12px] text-muted">{hint}</p>
    </Card>
  );
}

function ImportSheet({ open, onClose, subjectId }: { open: boolean; onClose: () => void; subjectId: SubjectId }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={() => { setMsg(null); onClose(); }} title="Add topics">
      <p className="text-sm text-muted">Paste topics from your verified syllabus, one per line. Use “1.2 | Title”, “1.2 Title” or just the title. Indent a line to make it a subtopic. Bangla is fine.</p>
      <textarea className="field mt-3 min-h-[180px] font-[inherit]" value={text} onChange={(e) => setText(e.target.value)} placeholder={'1 | Motion, forces and energy\n  1.1 Physical quantities\n  1.2 Motion'} />
      <Button className="mt-3 w-full" disabled={!text.trim()} onClick={async () => {
        const n = await importTopics(subjectId, text);
        await regenerateFuture(addDays(localDate(), 1), 'Topics added');
        setText('');
        setMsg(`${n} topic${n === 1 ? '' : 's'} added. Future sessions now include them.`);
      }}>Add topics</Button>
      {msg && <p role="status" className="mt-3 text-sm font-medium text-primary">{msg}</p>}
    </Sheet>
  );
}

function SubjectEditSheet({ open, onClose, subjectId }: { open: boolean; onClose: () => void; subjectId: SubjectId }) {
  const subjects = useSubjectMap();
  const s = subjects[subjectId];
  const [paper, setPaper] = useState('');
  if (!s) return null;
  return (
    <Sheet open={open} onClose={onClose} title={`${s.name} details`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Syllabus code"><input className="field" defaultValue={s.syllabusCode ?? ''} placeholder="pending" onBlur={(e) => db.subjects.update(s.id, { syllabusCode: e.target.value.trim() || null })} /></Field>
          <Field label="Syllabus years"><input className="field" defaultValue={s.syllabusVersion ?? ''} placeholder="e.g. 2025–2027" onBlur={(e) => db.subjects.update(s.id, { syllabusVersion: e.target.value.trim() || null })} /></Field>
        </div>
        <div>
          <span className="label">Papers</span>
          <ul className="space-y-2">
            {s.papers.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2 text-sm">
                <span className="flex-1">{p.name}</span>
                <button aria-label={`Remove ${p.name}`} className="p-2 text-muted" onClick={() => db.subjects.update(s.id, { papers: s.papers.filter((x) => x.id !== p.id) })}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input className="field" value={paper} onChange={(e) => setPaper(e.target.value)} placeholder="e.g. Paper 2 — Structured" />
            <Button variant="secondary" disabled={!paper.trim()} onClick={async () => { await db.subjects.update(s.id, { papers: [...s.papers, { id: uid(), name: paper.trim() }] }); setPaper(''); }}>Add</Button>
          </div>
        </div>
        <Field label={`Planning weight: ${s.weight.toFixed(2)}`} hint="Relative share of study time. 1.00 is average. Applied from tomorrow when you refresh the plan.">
          <input type="range" min={0.5} max={1.6} step={0.05} defaultValue={s.weight} className="w-full accent-[rgb(var(--primary))]" onChange={(e) => db.subjects.update(s.id, { weight: Number(e.target.value) })} />
        </Field>
      </div>
    </Sheet>
  );
}

function SyllabusCard({ subjectId }: { subjectId: SubjectId }) {
  const status = useLiveQuery(() => syllabusStatus(subjectId), [subjectId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (status === undefined) return null;
  if (status === null)
    return subjectId === 'economics' ? (
      <p className="mt-6 rounded-xl bg-sunken p-3 text-sm text-muted">The official Economics topic list isn’t built in yet. Add topics below, or it will be added in an update once the syllabus is supplied.</p>
    ) : null;
  const { pack, total, present } = status;
  return (
    <Card className="mt-6 p-4">
      <p className="font-semibold">Official syllabus {pack.code} · {pack.years}</p>
      <p className="mt-0.5 text-[13px] text-muted">{pack.source}</p>
      {present >= total ? (
        <p className="mt-2 text-sm text-green">All {total} syllabus topics are loaded.</p>
      ) : (
        <>
          <p className="mt-2 text-sm">{present ? `${present} of ${total} loaded.` : `${total} topics and subtopics, in Cambridge’s own numbering.`} Loading adds what’s missing — it never changes or removes your own topics or progress.</p>
          <Button className="mt-3 w-full" disabled={busy} onClick={async () => {
            setBusy(true);
            const n = await loadSyllabus(subjectId);
            await regenerateFuture(addDays(localDate(), 1), 'Syllabus topics loaded');
            setBusy(false);
            setMsg(`${n} topics added. Sessions from tomorrow now rotate through the whole syllabus.`);
          }}>{busy ? 'Loading…' : 'Load syllabus topics'}</Button>
        </>
      )}
      {msg && <p role="status" className="mt-2 text-sm font-medium text-primary">{msg}</p>}
    </Card>
  );
}
