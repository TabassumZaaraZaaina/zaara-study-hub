import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronLeft, ClipboardCheck, ExternalLink, Pause, Play, Wrench } from 'lucide-react';
import { db } from '@/db/db';
import { MODE_LABEL, SUBJECT_STYLE, TEMPLATE_BY_ID, activitiesFor, templateMinutes } from '@/data/catalog';
import { REPAIR_METHODS } from '@/domain/repair';
import { sessionProgress } from '@/domain/progress';
import { useResources, useSubjectMap, useToday, useTopics } from '@/hooks/data';
import { addFocusMinutes, completeSession, setActivityDone, startSession, type CompletionResult } from '@/services/sessions';
import { doToday, setTopics } from '@/services/plan';
import { sessionTitle } from '@/components/session';
import { Bar, Button, Card, Chip, SubjectGlyph, SubjectTag, cx } from '@/components/ui';
import type { PaceMode } from '@/types';
import { fmtMinutes, fmtShort } from '@/utils/dates';

const MODE_TEXT: Record<PaceMode, string> = {
  full: 'The complete session.',
  steady: 'The core: recall, practice and marking.',
  light: 'A short recall to keep the thread going.'
};

export function SessionScreen() {
  const { id } = useParams();
  const nav = useNavigate();
  const today = useToday();
  const s = useLiveQuery(() => db.sessions.get(id!), [id]);
  const repair = useLiveQuery(async () => (s?.repairId ? db.repairs.get(s.repairId) : undefined), [s?.repairId]);
  const subjects = useSubjectMap();
  const topics = useTopics();
  const resources = useResources();
  const [summary, setSummary] = useState<CompletionResult | null>(null);
  const [changingMode, setChangingMode] = useState(false);

  if (s === undefined) return null;
  if (s === null || !s) return <p className="p-6">This session no longer exists. <Link className="text-primary underline" to="/">Back to Today</Link></p>;

  const subject = subjects[s.subjectId];
  const tpl = TEMPLATE_BY_ID[s.templateId];
  const style = SUBJECT_STYLE[s.subjectId];
  const subjectTopics = topics.filter((t) => t.subjectId === s.subjectId && t.active);
  const rel = resources.filter((r) => r.subjectId === s.subjectId && (r.topicIds.length === 0 || r.topicIds.some((t) => s.topicIds.includes(t))));
  const notStarted = !s.mode || changingMode || (s.status !== 'in_progress' && s.status !== 'completed');

  if (summary) return <Summary result={summary} subjectName={subject?.name ?? ''} title={sessionTitle(summary.session, topics)} />;

  const header = (
    <div className="sticky top-0 z-10 -mx-4 mb-4 bg-bg/90 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} aria-label="Leave session (progress is saved)" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-sunken"><ChevronLeft /></button>
        <div className="min-w-0 flex-1">
          <SubjectTag id={s.subjectId} name={subject?.name ?? ''} />
          <p className="truncate text-[15px] font-semibold" lang="und">{sessionTitle(s, topics)}</p>
        </div>
        {s.mode && !notStarted && (
          <button onClick={() => setChangingMode(true)} className="min-h-[36px] rounded-full bg-sunken px-3 text-sm font-semibold">{MODE_LABEL[s.mode]}</button>
        )}
      </div>
      {s.mode && !notStarted && <Bar value={sessionProgress(s)} className="mt-2" color={style.accent} />}
    </div>
  );

  if (s.status === 'completed' && !changingMode) {
    return (
      <div>
        {header}
        <Card className="p-5 text-center">
          <Check className="mx-auto text-green" />
          <p className="mt-2 font-semibold">Completed {s.mode && s.mode !== 'full' ? `(${MODE_LABEL[s.mode]})` : ''}</p>
          <p className="text-sm text-muted">{fmtMinutes(s.actualMinutes)} recorded</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => nav(`/assess?session=${s.id}`)}><ClipboardCheck size={16} /> Record a result</Button>
            <Button onClick={() => nav('/')}>Back to Today</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (notStarted) {
    return (
      <div className="animate-rise">
        {header}
        <div className="flex items-center gap-4">
          <SubjectGlyph id={s.subjectId} size={56} />
          <div>
            <h1 className="text-2xl font-semibold leading-tight" lang="und">{sessionTitle(s, topics)}</h1>
            <p className="text-muted">{tpl.name}</p>
          </div>
        </div>
        {s.reason && <p className="mt-3 text-sm text-muted">{s.reason}</p>}
        {s.moves.length > 0 && <p className="mt-1 text-sm text-muted">Originally planned for {fmtShort(s.originalDate)}.</p>}

        {tpl.purpose !== 'exam' && !s.topicIds.length && (
          <TopicPicker topics={subjectTopics} onPick={(tid) => setTopics(s.id, [tid])} />
        )}

        <h2 className="mb-3 mt-6 font-semibold">How much can you give today?</h2>
        <div className="space-y-3" role="radiogroup" aria-label="Study intensity">
          {(['full', 'steady', 'light'] as PaceMode[]).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={s.mode === m}
              onClick={async () => {
                if (s.date < today) await doToday(s.id, today);
                await startSession(s.id, m);
                setChangingMode(false);
              }}
              className={cx('flex w-full items-center gap-4 rounded-2xl border bg-surface p-4 text-left shadow-card transition hover:border-primary/50', s.mode === m ? 'border-primary' : 'border-line/60')}
            >
              <span className="inline-flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft text-primary">
                <span className="text-base font-bold leading-none">{templateMinutes(s.templateId, m)}</span>
                <span className="text-[10px] font-semibold">min</span>
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{MODE_LABEL[m]}{m === s.plannedMode && <span className="ml-2 text-xs font-medium text-muted">planned</span>}</span>
                <span className="block text-sm text-muted">{MODE_TEXT[m]}</span>
              </span>
              <Play size={18} className="text-muted" />
            </button>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-muted">All three are real study. A Light session counts as a completed Light session. If this was core practice, the main part will be planned again — nothing is lost and nothing is held against you.</p>
        {changingMode && <Button variant="ghost" className="mt-2 w-full" onClick={() => setChangingMode(false)}>Keep {s.mode && MODE_LABEL[s.mode]}</Button>}
      </div>
    );
  }

  const acts = activitiesFor(s.templateId, s.mode!);
  const currentIdx = acts.findIndex((a) => !s.completedActivities.includes(a.key));
  const allDone = currentIdx === -1;

  return (
    <div>
      {header}
      {repair?.method && (
        <Card className="mb-4 p-4">
          <p className="flex items-center gap-2 font-semibold"><Wrench size={16} className="text-amber" /> {REPAIR_METHODS[repair.method].name}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{REPAIR_METHODS[repair.method].steps.map((x) => <li key={x}>{x}</li>)}</ol>
        </Card>
      )}
      {s.source === 'repair' && !repair?.method && repair && (
        <Link to={`/repair/${repair.id}`} className="mb-4 block rounded-2xl bg-amber-soft p-4 text-sm font-medium text-amber">First, choose what made this difficult → pick a repair method</Link>
      )}

      <ol className="space-y-3">
        {acts.map((a, i) => {
          const done = s.completedActivities.includes(a.key);
          const current = i === currentIdx;
          return (
            <li key={a.key}>
              {current ? (
                <ActiveActivity
                  key={a.key}
                  sessionId={s.id}
                  title={a.title}
                  minutes={a.minutes}
                  instruction={a.instruction}
                  assessable={!!a.assessable}
                  accent={style.accent}
                  next={acts[i + 1] ? `${acts[i + 1].title} · ${acts[i + 1].minutes} min` : null}
                  onDone={() => setActivityDone(s.id, a.key, true)}
                />
              ) : (
                <button
                  onClick={() => done && setActivityDone(s.id, a.key, false)}
                  disabled={!done}
                  className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left', done ? 'text-muted' : 'text-muted/80')}
                  aria-label={done ? `${a.title} — done. Tap to undo.` : `${a.title} — later`}
                >
                  <span className={cx('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', done ? 'border-green bg-green-soft text-green' : 'border-line')}>
                    {done ? <Check size={15} /> : <span className="text-xs">{i + 1}</span>}
                  </span>
                  <span className={cx('flex-1', done && 'line-through decoration-1')}>{a.title}</span>
                  <span className="text-sm">{a.minutes} min</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {allDone && (
        <Card className="mt-5 p-5 text-center animate-rise">
          <p className="text-lg font-semibold">All activities done</p>
          <p className="text-sm text-muted">Finish to save this as a completed {MODE_LABEL[s.mode!]} session.</p>
          <Button size="lg" className="mt-4 w-full" onClick={async () => setSummary(await completeSession(s.id, today))}>Finish session</Button>
        </Card>
      )}

      {rel.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-muted">Materials</h3>
          <div className="space-y-2">
            {rel.map((r) => (
              <a key={r.id} href={r.url} target="_blank" rel="noreferrer" onClick={() => db.resources.update(r.id, { lastAccessed: new Date().toISOString() })} className="flex min-h-[48px] items-center gap-3 rounded-xl border border-line bg-surface px-3 text-sm">
                <ExternalLink size={15} className="text-muted" /> <span className="flex-1 truncate">{r.title}</span> <Chip>{r.type}</Chip>
              </a>
            ))}
          </div>
        </div>
      )}
      <p className="mt-6 text-center text-[13px] text-muted">Progress saves automatically. You can leave and come back any time.</p>
    </div>
  );
}

function TopicPicker({ topics, onPick }: { topics: { id: string; title: string }[]; onPick: (id: string) => void }) {
  if (!topics.length)
    return (
      <p className="mt-4 rounded-xl bg-sunken p-3 text-sm text-muted">
        No topics are listed for this subject yet, so work on your class’s current topic. You can add the syllabus topics in <Link to="/subjects" className="text-primary underline">Subjects</Link>.
      </p>
    );
  return (
    <label className="mt-4 block">
      <span className="label">Which topic will you work on?</span>
      <select className="field" defaultValue="" onChange={(e) => e.target.value && onPick(e.target.value)}>
        <option value="">Choose a topic…</option>
        {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
    </label>
  );
}

function ActiveActivity(p: { sessionId: string; title: string; minutes: number; instruction: string; assessable: boolean; accent: string; next: string | null; onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds since last save
  const startRef = useRef<number | null>(null);
  const savedRef = useRef(0);
  const nav = useNavigate();

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - elapsed * 1000;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current!) / 1000)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Save focused minutes on pause/leave so nothing is lost.
  const flush = () => {
    const mins = (elapsed - savedRef.current) / 60;
    if (mins >= 0.5) {
      addFocusMinutes(p.sessionId, mins);
      savedRef.current = elapsed;
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushRef.current();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flushRef.current();
    };
  }, []);

  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, '0');
  const over = elapsed > p.minutes * 60;
  return (
    <Card className="animate-rise overflow-hidden p-0">
      <div className="h-1" style={{ background: p.accent }} />
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold">{p.title}</h2>
          <span className="text-sm text-muted">{p.minutes} min</span>
        </div>
        <p className="mt-2 leading-relaxed">{p.instruction}</p>
        <div className="mt-5 flex items-center gap-3">
          <span className={cx('font-mono text-3xl tabular-nums', over ? 'text-muted' : '')} aria-live="off">{mm}:{ss}</span>
          <Button variant="soft" size="sm" onClick={() => { if (running) flush(); setRunning(!running); }} aria-label={running ? 'Pause timer' : 'Start timer'}>
            {running ? <><Pause size={15} /> Break</> : <><Play size={15} /> {elapsed ? 'Resume' : 'Start timer'}</>}
          </Button>
        </div>
        {over && <p className="mt-1 text-[13px] text-muted">Past the suggested time — that’s fine. Finish when you’re ready.</p>}
        {p.assessable && (
          <button onClick={() => nav(`/assess?session=${p.sessionId}`)} className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 text-sm font-semibold text-primary">
            <ClipboardCheck size={16} /> Record your score
          </button>
        )}
        <Button size="lg" className="mt-4 w-full" onClick={() => { flush(); setRunning(false); p.onDone(); }}>
          <Check size={18} /> Done
        </Button>
        {p.next && <p className="mt-3 text-center text-[13px] text-muted">Next: {p.next}</p>}
      </div>
    </Card>
  );
}

function Summary({ result, subjectName, title }: { result: CompletionResult; subjectName: string; title: string }) {
  const nav = useNavigate();
  const s = result.session;
  const hasMark = activitiesFor(s.templateId, s.mode!).some((a) => a.assessable);
  return (
    <div className="animate-rise pt-10 text-center">
      <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-soft text-green"><Check size={30} /></span>
      <h1 className="mt-4 text-2xl font-semibold">Session complete</h1>
      <p className="mt-1 text-muted">{subjectName} · {title}</p>
      <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3">
        <Card className="p-3"><p className="text-xs text-muted">Mode</p><p className="font-semibold">{MODE_LABEL[s.mode!]}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted">Time</p><p className="font-semibold">{fmtMinutes(s.actualMinutes)}</p></Card>
      </div>
      {result.followup && (
        <p className="mx-auto mt-4 max-w-sm rounded-xl bg-sunken p-3 text-sm">The main practice for this topic is planned for <b>{fmtShort(result.followup.date)}</b> as a 45-minute session.</p>
      )}
      {result.retest && <p className="mx-auto mt-4 max-w-sm rounded-xl bg-sunken p-3 text-sm">An unseen retest is planned for <b>{fmtShort(result.retest.date)}</b>.</p>}
      <div className="mx-auto mt-6 flex max-w-sm flex-col gap-3">
        {hasMark && <Button size="lg" onClick={() => nav(`/assess?session=${s.id}`, { replace: true })}><ClipboardCheck size={18} /> Record your score</Button>}
        <Button size="lg" variant={hasMark ? 'secondary' : 'primary'} onClick={() => nav('/', { replace: true })}>Back to Today</Button>
      </div>
    </div>
  );
}
