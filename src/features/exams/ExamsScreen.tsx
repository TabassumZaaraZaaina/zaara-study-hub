import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GraduationCap, Pencil, Plus } from 'lucide-react';
import { db } from '@/db/db';
import { MILESTONES } from '@/data/catalog';
import { useExams, useSubjectMap, useSubjects, useToday, useTopics } from '@/hooks/data';
import { regenerateFuture } from '@/services/plan';
import { uid, log } from '@/services/meta';
import { updateTopic } from '@/services/topics';
import { Button, Card, Chip, Empty, Field, PageHeader, SectionTitle, Segmented, Sheet, SubjectGlyph } from '@/components/ui';
import type { Exam, ExamGroup, SubjectId } from '@/types';
import { addDays, diffDays, fmtLong, fmtShort, isValidISODate } from '@/utils/dates';
import { nextMilestone } from './countdown';
import { HomeMocks } from './HomeMocks';

export function validateExam(e: Pick<Exam, 'group' | 'date' | 'durationMinutes' | 'paper' | 'startTime'>): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!e.paper.trim()) errors.push('Add the paper name, e.g. “Paper 2”.');
  if (e.date && !isValidISODate(e.date)) errors.push('That date isn’t valid.');
  if (e.durationMinutes !== null && !(e.durationMinutes > 0 && e.durationMinutes <= 300)) errors.push('Duration should be between 1 and 300 minutes.');
  if (e.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.startTime)) errors.push('Start time should look like 09:00.');
  if (e.date && e.group === 'mock2' && e.date < MILESTONES[0].startDate!) warnings.push('Mock 2 is confirmed to start on 25 November 2026 — please double-check this date.');
  if (e.date && e.group === 'final' && (e.date < '2027-04-01' || e.date > '2027-07-15')) warnings.push('This is outside the May/June 2027 series — please double-check.');
  return { errors, warnings };
}

export function ExamsScreen() {
  const today = useToday();
  const exams = useExams();
  const subjects = useSubjectMap();
  const [editing, setEditing] = useState<Exam | 'new' | null>(null);
  const [params] = useSearchParams();
  const [tab, setTab] = useState<ExamGroup | 'home'>(params.get('tab') === 'home' ? 'home' : 'mock2');
  const group: ExamGroup = tab === 'home' ? 'mock2' : tab;
  const m = nextMilestone(today, exams, subjects);
  const list = exams.filter((e) => e.group === group).sort((a, b) => ((a.date ?? '9999') + (a.startTime ?? '') < (b.date ?? '9999') + (b.startTime ?? '') ? -1 : 1));
  const mock = MILESTONES[0];
  const daysToMock = diffDays(today, mock.startDate!);

  return (
    <div className="animate-rise">
      <PageHeader back="/" title="Exam timetable" subtitle={m?.text} />
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[13px] text-muted">Mock 2</p>
          <p className="text-2xl font-semibold">{daysToMock > 0 ? `${daysToMock} days` : daysToMock === 0 ? 'Today' : 'Under way'}</p>
          <p className="text-[12px] text-muted">starts {fmtShort(mock.startDate!)} (confirmed)</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-muted">O Level Finals</p>
          <p className="text-2xl font-semibold">May/June 2027</p>
          <p className="text-[12px] text-muted">{exams.some((e) => e.group === 'final' && e.date) ? 'dates entered' : 'dates not entered yet'}</p>
        </Card>
      </div>

      <div className="mt-5">
        <Segmented<ExamGroup | 'home'> label="Exam group" value={tab} onChange={setTab} options={[{ value: 'mock2', label: 'Mock 2' }, { value: 'final', label: 'Finals' }, { value: 'home', label: 'Home mocks' }]} />
      </div>
      {tab === 'home' && <div className="mt-4"><HomeMocks /></div>}
      {tab !== 'home' && <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setEditing('new')}><Plus size={15} /> Add paper</Button>}>Papers</SectionTitle>}
      {tab === 'home' ? null : list.length ? (
        <div className="space-y-2">
          {list.map((e) => (
            <button key={e.id} onClick={() => setEditing(e)} className="flex w-full items-center gap-3 rounded-2xl border border-line/60 bg-surface p-4 text-left shadow-card">
              <SubjectGlyph id={e.subjectId} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{subjects[e.subjectId]?.name} · {e.paper}</p>
                <p className="text-sm text-muted">
                  {e.date ? fmtLong(e.date) : 'Date pending'}
                  {e.startTime ? ` · ${e.startTime}` : ''}
                  {e.durationMinutes ? ` · ${e.durationMinutes} min` : ''}
                  {e.venue ? ` · ${e.venue}` : ''}
                </p>
              </div>
              {e.date && e.date >= today && <Chip tone="primary">{diffDays(today, e.date) === 0 ? 'today' : `${diffDays(today, e.date)}d`}</Chip>}
              <Pencil size={16} className="text-muted" />
            </button>
          ))}
        </div>
      ) : (
        <Empty icon={<GraduationCap />} title={group === 'mock2' ? 'No Mock 2 papers yet' : 'No final papers yet'} action={<Button size="sm" onClick={() => setEditing('new')}><Plus size={15} /> Add paper</Button>}>
          {group === 'mock2' ? 'Until you add them, the plan aims everything at 25 November.' : 'Add them from your Cambridge Statement of Entry when you have it.'}
        </Empty>
      )}

      <ExamSheet exam={editing} group={group} onClose={() => setEditing(null)} today={today} />
    </div>
  );
}

function ExamSheet({ exam, group, onClose, today }: { exam: Exam | 'new' | null; group: ExamGroup; onClose: () => void; today: string }) {
  const subjects = useSubjects();
  const topics = useTopics();
  const blank: Exam = { id: '', group, subjectId: 'physics', paper: '', date: null, startTime: null, durationMinutes: null, coverageTopicIds: [], status: 'pending' };
  const [e, setE] = useState<Exam>(blank);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setE(exam && exam !== 'new' ? exam : { ...blank, group });
    setMsg(null);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, group]);
  if (!exam) return null;
  const subject = subjects.find((s) => s.id === e.subjectId);
  const v = validateExam(e);
  const subjectTopics = topics.filter((t) => t.subjectId === e.subjectId && t.active);

  const save = async () => {
    const rec: Exam = { ...e, id: e.id || uid(), paper: e.paper.trim(), status: e.date ? (e.date < today ? 'done' : 'scheduled') : 'pending' };
    await db.exams.put(rec);
    await log('exam.save', 'exam', rec.id, `${rec.subjectId} ${rec.paper} ${rec.date ?? 'pending'}`);
    const r = await regenerateFuture(addDays(today, 1), 'Exam timetable changed');
    setMsg(`Saved. Plan updated from tomorrow (${r.created} sessions re-planned; completed work kept).`);
    if (exam === 'new') setE({ ...blank, group, subjectId: e.subjectId });
  };

  return (
    <Sheet open={!!exam} onClose={onClose} title={exam === 'new' ? 'Add exam paper' : 'Edit exam paper'}>
      <div className="space-y-4">
        <Segmented<ExamGroup> label="Group" value={e.group} onChange={(g) => setE({ ...e, group: g })} options={[{ value: 'mock2', label: 'Mock 2' }, { value: 'final', label: 'Finals' }]} />
        <Field label="Subject">
          <select className="field" value={e.subjectId} onChange={(x) => setE({ ...e, subjectId: x.target.value as SubjectId })}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Paper">
          <input className="field" list="paper-names" value={e.paper} onChange={(x) => setE({ ...e, paper: x.target.value })} placeholder="e.g. Paper 2" />
          <datalist id="paper-names">{subject?.papers.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className="field" value={e.date ?? ''} onChange={(x) => setE({ ...e, date: x.target.value || null })} /></Field>
          <Field label="Start time"><input type="time" className="field" value={e.startTime ?? ''} onChange={(x) => setE({ ...e, startTime: x.target.value || null })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration (min)"><input type="number" inputMode="numeric" className="field" value={e.durationMinutes ?? ''} onChange={(x) => setE({ ...e, durationMinutes: x.target.value ? Number(x.target.value) : null })} /></Field>
          <Field label="Venue (optional)"><input className="field" value={e.venue ?? ''} onChange={(x) => setE({ ...e, venue: x.target.value })} /></Field>
        </div>
        {e.group === 'mock2' && subjectTopics.length > 0 && (
          <div>
            <span className="label">Mock 2 coverage for {subject?.name}</span>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {subjectTopics.map((t) => (
                <label key={t.id} className="flex min-h-[40px] items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--primary))]" defaultChecked={t.inMock} onChange={(x) => updateTopic(t.id, { inMock: x.target.checked })} />
                  <span lang="und">{t.title}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-[13px] text-muted">Before Mock 2, sessions focus on ticked topics.</p>
          </div>
        )}
        <Field label="Revision notes (optional)"><textarea className="field" value={e.notes ?? ''} onChange={(x) => setE({ ...e, notes: x.target.value })} /></Field>
        {v.errors.map((x) => <p key={x} className="text-sm text-red" role="alert">{x}</p>)}
        {v.warnings.map((x) => <p key={x} className="text-sm text-amber">{x}</p>)}
        <Button className="w-full" disabled={v.errors.length > 0} onClick={save}>Save</Button>
        {msg && <p role="status" className="text-sm font-medium text-primary">{msg}</p>}
        {exam !== 'new' && (
          confirmDelete ? (
            <Button variant="danger" className="w-full" onClick={async () => { await db.exams.delete(e.id); await regenerateFuture(addDays(today, 1), 'Exam removed'); onClose(); }}>Yes, remove this paper</Button>
          ) : (
            <Button variant="ghost" className="w-full" onClick={() => setConfirmDelete(true)}>Remove paper</Button>
          )
        )}
      </div>
    </Sheet>
  );
}
