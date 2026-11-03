import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, Check, Plus, X } from 'lucide-react';
import { db } from '@/db/db';
import { ERROR_LABEL } from '@/domain/repair';
import { pct } from '@/domain/mastery';
import { useSubjects, useToday, useTopics } from '@/hooks/data';
import { addError, recordAttempt, updateAttemptMarking, type RecordResult } from '@/services/assess';
import { uid } from '@/services/meta';
import { Button, Card, Field, PageHeader, Segmented, cx } from '@/components/ui';
import type { AssessmentType, Assistance, Confidence, ErrorCategory, QuestionSource, SubjectId } from '@/types';
import { nowISO } from '@/utils/dates';

const TYPES: { v: AssessmentType; l: string }[] = [
  { v: 'topic-quiz', l: 'Topic questions' }, { v: 'past-paper', l: 'Past-paper questions' }, { v: 'timed-paper', l: 'Timed paper' },
  { v: 'school-test', l: 'School test' }, { v: 'homework', l: 'Homework' }, { v: 'retest', l: 'Retest (unseen)' }, { v: 'retention-check', l: 'Retention check' }
];
const SOURCES: { v: QuestionSource; l: string }[] = [
  { v: 'official-past-paper', l: 'Cambridge past paper' }, { v: 'teacher', l: 'Teacher' }, { v: 'textbook', l: 'Textbook' },
  { v: 'generated-practice', l: 'Generated practice (AI or other)' }, { v: 'own', l: 'My own questions' }
];

export function AssessScreen() {
  const [params] = useSearchParams();
  const today = useToday();
  const nav = useNavigate();
  const subjects = useSubjects();
  const topics = useTopics();

  const [subjectId, setSubject] = useState<SubjectId>((params.get('subject') as SubjectId) || 'physics');
  const [topicId, setTopic] = useState(params.get('topic') ?? '');
  const [sessionId, setSessionId] = useState<string | null>(params.get('session'));
  const [repairId, setRepairId] = useState<string | undefined>();
  const [type, setType] = useState<AssessmentType>('topic-quiz');
  const [paper, setPaper] = useState('');
  const [source, setSource] = useState<QuestionSource>('textbook');
  const [ref, setRef] = useState('');
  const [earned, setEarned] = useState('');
  const [available, setAvailable] = useState('');
  const [assist, setAssist] = useState<Assistance>('none');
  const [confidence, setConfidence] = useState<Confidence | ''>('');
  const [unseen, setUnseen] = useState(true);
  const [date, setDate] = useState(today);
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecordResult | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    db.sessions.get(sessionId).then((s) => {
      if (!s) return;
      setSubject(s.subjectId);
      if (s.topicIds[0]) setTopic(s.topicIds[0]);
      if (s.source === 'retest' || s.source === 'review') {
        setType(s.source === 'review' ? 'retention-check' : 'retest');
        setUnseen(true);
      }
      if (s.repairId && s.source === 'retest') setRepairId(s.repairId);
      if (s.purpose === 'exam') setType('timed-paper');
    });
  }, [sessionId]);

  const subject = subjects.find((s) => s.id === subjectId);
  const subjectTopics = topics.filter((t) => t.subjectId === subjectId && t.active);
  const e = Number(earned);
  const a = Number(available);
  const marksError = earned === '' || available === '' ? null : !(a > 0) ? 'Marks available must be more than 0.' : e < 0 ? 'Marks can’t be negative.' : e > a ? 'Marks earned can’t be more than marks available.' : null;
  const canSave = earned !== '' && available !== '' && !marksError;

  const addPhoto = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.size > 8 * 1024 * 1024) {
        setError('That photo is over 8 MB. Try a smaller one.');
        continue;
      }
      const id = uid();
      await db.files.put({ id, name: f.name, type: f.type, size: f.size, blob: f, createdAt: nowISO() });
      setPhotos((p) => [...p, { id, url: URL.createObjectURL(f) }]);
    }
  };

  const save = async () => {
    setError(null);
    try {
      const r = await recordAttempt(
        {
          subjectId, topicId: topicId || null, sessionId, assessmentType: type, paper: paper || undefined, source, sourceReference: ref.trim() || undefined,
          marksEarned: e, marksAvailable: a, assistanceUsed: assist, confidence: confidence || null, unseen, date, photoIds: photos.map((p) => p.id), repairId
        },
        today
      );
      setResult(r);
      window.scrollTo(0, 0);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (result) return <Marking result={result} onDone={() => nav(-1)} />;

  return (
    <div className="animate-rise">
      <PageHeader title="Record a result" subtitle="Mark first, then record honestly — partial marks and help used are useful information." />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject">
            <select className="field" value={subjectId} onChange={(ev) => { setSubject(ev.target.value as SubjectId); setTopic(''); setSessionId(null); }}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" className="field" value={date} max={today} onChange={(ev) => setDate(ev.target.value)} /></Field>
        </div>
        <Field label="Topic" hint={subjectTopics.length ? undefined : 'No topics listed for this subject yet — the result is saved at subject level.'}>
          <select className="field" value={topicId} onChange={(ev) => setTopic(ev.target.value)} disabled={!subjectTopics.length}>
            <option value="">Mixed / whole paper</option>
            {subjectTopics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="What was it?">
            <select className="field" value={type} onChange={(ev) => setType(ev.target.value as AssessmentType)}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
          </Field>
          {subject && subject.papers.length > 0 ? (
            <Field label="Paper">
              <select className="field" value={paper} onChange={(ev) => setPaper(ev.target.value)}>
                <option value="">—</option>
                {subject.papers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          ) : <div />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Questions from">
            <select className="field" value={source} onChange={(ev) => setSource(ev.target.value as QuestionSource)}>{SOURCES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
          </Field>
          <Field label="Reference (optional)"><input className="field" value={ref} onChange={(ev) => setRef(ev.target.value)} placeholder={source === 'official-past-paper' ? 'e.g. 5054/22 M/J 2019 Q3' : ''} /></Field>
        </div>
        {source === 'generated-practice' && <p className="rounded-xl bg-sunken p-3 text-[13px] text-muted">Saved as generated practice — never shown as an official Cambridge question.</p>}

        <div>
          <span className="label">Before you marked it, how sure were you?</span>
          <Segmented<Confidence | ''> label="Confidence" value={confidence} onChange={setConfidence} options={[{ value: 'guessing', label: 'Guessing' }, { value: 'unsure', label: 'Unsure' }, { value: 'confident', label: 'Confident' }]} />
        </div>

        <Card className="p-4">
          <span className="label">Marks</span>
          <div className="flex items-center gap-3">
            <input aria-label="Marks earned" inputMode="decimal" type="number" min={0} step="0.5" className="field text-center text-xl font-semibold" value={earned} onChange={(ev) => setEarned(ev.target.value)} placeholder="0" />
            <span className="text-2xl text-muted">/</span>
            <input aria-label="Marks available" inputMode="decimal" type="number" min={1} step="0.5" className="field text-center text-xl font-semibold" value={available} onChange={(ev) => setAvailable(ev.target.value)} placeholder="out of" />
          </div>
          {canSave && <p className="mt-2 text-center text-sm text-muted">{Math.round((e / a) * 100)}%</p>}
          {marksError && <p className="mt-2 text-sm text-red" role="alert">{marksError}</p>}
        </Card>

        <div>
          <span className="label">Help used</span>
          <Segmented<Assistance> label="Help used" value={assist} onChange={setAssist} options={[{ value: 'none', label: 'None' }, { value: 'some', label: 'Some' }, { value: 'heavy', label: 'A lot' }]} />
          <p className="mt-1 text-[13px] text-muted">Notes, answers, hints or someone explaining. Independent work is what moves a topic toward Secure.</p>
        </div>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--primary))]" checked={unseen} onChange={(ev) => setUnseen(ev.target.checked)} />
          <span>I hadn’t seen these questions before</span>
        </label>

        <div>
          <span className="label">Photos of your work (optional)</span>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                <img src={p.url} alt="Your work" className="h-20 w-20 rounded-xl object-cover" />
                <button aria-label="Remove photo" className="absolute -right-2 -top-2 rounded-full bg-ink p-1 text-bg" onClick={async () => { await db.files.delete(p.id); setPhotos((x) => x.filter((y) => y.id !== p.id)); }}><X size={12} /></button>
              </div>
            ))}
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line text-muted">
              <Camera size={20} /><span className="text-[11px]">Add</span>
              <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(ev) => addPhoto(ev.target.files)} />
            </label>
          </div>
          <p className="mt-1 text-[13px] text-muted">Photos stay on this device and are included in backups.</p>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-soft p-3 text-sm text-red">{error}</p>}
        <Button size="lg" className="w-full" disabled={!canSave} onClick={save}>Save result</Button>
      </div>
    </div>
  );
}

function Marking({ result, onDone }: { result: RecordResult; onDone: () => void }) {
  const at = result.attempt;
  const p = pct(at);
  const [original, setOriginal] = useState('');
  const [missing, setMissing] = useState('');
  const [corrected, setCorrected] = useState('');
  const [reattempt, setReattempt] = useState(false);
  const [errs, setErrs] = useState<{ category: ErrorCategory; description: string; correction: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const cbw = at.confidence === 'confident' && p < 50;
  const message = useMemo(() => {
    if (p >= 70 && at.assistanceUsed === 'none' && at.unseen) return 'Strong independent result.';
    if (p >= 50) return 'Solid progress. The marking notes below make the next attempt stronger.';
    return 'This idea needs a different approach. Let’s find what was difficult.';
  }, [p, at]);

  const save = async () => {
    await updateAttemptMarking(at.id, { originalAnswer: original || undefined, missingPoints: missing || undefined, correctedAnswer: corrected || undefined, reattemptDone: reattempt });
    for (const e of errs.filter((x) => x.description.trim() || x.correction.trim()))
      await addError({ attemptId: at.id, subjectId: at.subjectId, topicId: at.topicId, category: e.category, description: e.description, correction: e.correction, confidentButWrong: cbw });
    setSaved(true);
  };

  return (
    <div className="animate-rise">
      <Card className="p-5 text-center">
        <p className="text-4xl font-semibold tabular-nums">{p}%</p>
        <p className="text-sm text-muted">{at.marksEarned} / {at.marksAvailable}</p>
        <p className="mt-3 font-medium">{message}</p>
        {result.masteryBefore && result.masteryBefore !== result.masteryAfter && <p className="mt-1 text-sm text-muted">Topic: {result.masteryBefore} → <b className="text-ink">{result.masteryAfter}</b></p>}
        {cbw && <p className="mt-3 rounded-xl bg-red-soft p-3 text-sm text-red">You felt confident but lost marks — that often means a misconception worth fixing. It’s flagged in your error log.</p>}
        {result.repair && (
          <Link to={`/repair/${result.repair.id}`} className="mt-3 block rounded-xl bg-amber-soft p-3 text-sm font-medium text-amber">A short repair session is planned within 48 hours → choose what made this hard</Link>
        )}
      </Card>

      {!saved ? (
        <>
          <h2 className="mb-1 mt-6 text-lg font-semibold">Marking and correction</h2>
          <p className="mb-4 text-sm text-muted">Optional, but this is where most learning happens. Keep your original answer — don’t overwrite it.</p>
          <div className="space-y-4">
            <Field label="1 · Your original answer (or key part)"><textarea className="field min-h-[80px]" value={original} onChange={(ev) => setOriginal(ev.target.value)} /></Field>
            <Field label="2 · Marking points you missed"><textarea className="field min-h-[80px]" value={missing} onChange={(ev) => setMissing(ev.target.value)} placeholder="From the mark scheme" /></Field>
            <Field label="3 · Corrected answer"><textarea className="field min-h-[80px]" value={corrected} onChange={(ev) => setCorrected(ev.target.value)} /></Field>
            <div>
              <span className="label">4 · What kind of mistakes?</span>
              {errs.map((e, i) => (
                <Card key={i} className="mb-2 p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(ERROR_LABEL) as ErrorCategory[]).map((c) => (
                      <button key={c} onClick={() => setErrs((x) => x.map((y, j) => (j === i ? { ...y, category: c } : y)))} className={cx('min-h-[36px] rounded-full border px-3 text-[13px]', e.category === c ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-line')}>{ERROR_LABEL[c]}</button>
                    ))}
                  </div>
                  <input className="field mt-2" placeholder="What went wrong?" value={e.description} onChange={(ev) => setErrs((x) => x.map((y, j) => (j === i ? { ...y, description: ev.target.value } : y)))} />
                  <input className="field mt-2" placeholder="The correct idea" value={e.correction} onChange={(ev) => setErrs((x) => x.map((y, j) => (j === i ? { ...y, correction: ev.target.value } : y)))} />
                </Card>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setErrs((x) => [...x, { category: 'concept', description: '', correction: '' }])}><Plus size={15} /> Add a mistake</Button>
            </div>
            <label className="flex min-h-[44px] items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--primary))]" checked={reattempt} onChange={(ev) => setReattempt(ev.target.checked)} />
              <span>5 · I re-did it closed-book after correcting</span>
            </label>
            <Button size="lg" className="w-full" onClick={save}>Save marking notes</Button>
            <Button variant="ghost" className="w-full" onClick={onDone}>Skip for now</Button>
          </div>
        </>
      ) : (
        <div className="mt-6 text-center">
          <p className="inline-flex items-center gap-2 font-semibold text-green"><Check size={18} /> Saved</p>
          <Button size="lg" className="mt-4 w-full" onClick={onDone}>Done</Button>
        </div>
      )}
    </div>
  );
}
