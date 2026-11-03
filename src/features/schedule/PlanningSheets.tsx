import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { MODE_LABEL, TEMPLATES } from '@/data/catalog';
import { useConfig, useSubjects, useTopics } from '@/hooks/data';
import { addManualSession, regenerateFuture, saveConfig } from '@/services/plan';
import { uid } from '@/services/meta';
import { Button, Field, Segmented, Sheet } from '@/components/ui';
import type { ISODate, PaceMode, SubjectId } from '@/types';
import { addDays, fmtShort, isValidISODate } from '@/utils/dates';

export function AddSessionSheet({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate: ISODate }) {
  const subjects = useSubjects();
  const topics = useTopics();
  const [subjectId, setSubject] = useState<SubjectId>('physics');
  const [date, setDate] = useState(defaultDate);
  const [templateId, setTemplate] = useState('');
  const [mode, setMode] = useState<PaceMode>('full');
  const [topicId, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const templates = TEMPLATES.filter((t) => t.subjectId === subjectId || t.id === 'exam-prep');
  const tid = templateId && templates.some((t) => t.id === templateId) ? templateId : templates[0]?.id;
  return (
    <Sheet open={open} onClose={() => { setDone(false); onClose(); }} title="Add a session or test">
      <div className="space-y-4">
        <Field label="Subject">
          <select className="field" value={subjectId} onChange={(e) => { setSubject(e.target.value as SubjectId); setTopic(''); }}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Type">
          <select className="field" value={tid} onChange={(e) => setTemplate(e.target.value)}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Segmented<PaceMode> label="Length" value={mode} onChange={setMode} options={(['full', 'steady', 'light'] as PaceMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
        <Field label="Topic (optional)">
          <select className="field" value={topicId} onChange={(e) => setTopic(e.target.value)}>
            <option value="">—</option>
            {topics.filter((t) => t.subjectId === subjectId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Field>
        <Field label="Note (optional)" hint="e.g. “School class test” or “Tutor homework”"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Button className="w-full" disabled={!isValidISODate(date)} onClick={async () => {
          await addManualSession({ date, subjectId, templateId: tid, mode, topicIds: topicId ? [topicId] : [], note: note || undefined });
          setDone(true);
        }}>Add to {isValidISODate(date) ? fmtShort(date) : 'plan'}</Button>
        {done && <p role="status" className="text-sm font-medium text-primary">Added. It won’t be changed by plan refreshes.</p>}
      </div>
    </Sheet>
  );
}

export function UnavailableSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const config = useConfig();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [label, setLabel] = useState('');
  const valid = isValidISODate(start) && isValidISODate(end) && end >= start;
  return (
    <Sheet open={open} onClose={onClose} title="Holidays and unavailable days">
      <p className="text-sm text-muted">No new sessions are planned on these days. Untouched sessions already there are re-planned; anything you’ve started is kept.</p>
      <ul className="mt-3 space-y-2">
        {config.unavailable.map((u) => (
          <li key={u.id} className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2 text-sm">
            <span className="flex-1">{u.label || 'Unavailable'} · {fmtShort(u.start)}{u.end !== u.start ? ` – ${fmtShort(u.end)}` : ''}</span>
            <button aria-label="Remove" className="p-2 text-muted" onClick={() => saveConfig({ unavailable: config.unavailable.filter((x) => x.id !== u.id) }, u.start, 'Unavailable period removed')}><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="From"><input type="date" className="field" value={start} onChange={(e) => { setStart(e.target.value); if (!end) setEnd(e.target.value); }} /></Field>
        <Field label="To"><input type="date" className="field" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="Label"><input className="field" placeholder="e.g. Family wedding" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      {start && end && end < start && <p className="mt-2 text-sm text-red">The end date is before the start date.</p>}
      <Button className="mt-4 w-full" disabled={!valid} onClick={async () => {
        await saveConfig({ unavailable: [...config.unavailable, { id: uid(), start, end, label: label.trim() }] }, start, 'Unavailable period added');
        setStart(''); setEnd(''); setLabel('');
      }}>Add</Button>
    </Sheet>
  );
}

export function RegenerateSheet({ open, onClose, today }: { open: boolean; onClose: () => void; today: ISODate }) {
  const [res, setRes] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={() => { setRes(null); onClose(); }} title="Refresh future plan">
      <p className="text-muted">Re-plans untouched sessions from tomorrow using your latest exam dates, topics, results and available hours.</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Completed and started sessions are kept.</li>
        <li>Sessions you edited or that were moved are kept.</li>
        <li>Repairs, retests and your history are untouched.</li>
      </ul>
      <Button className="mt-5 w-full" onClick={async () => {
        const r = await regenerateFuture(addDays(today, 1), 'Manual refresh');
        setRes(`Done — ${r.created} sessions planned.`);
      }}>Refresh plan</Button>
      {res && <p role="status" className="mt-3 text-sm font-medium text-primary">{res}</p>}
    </Sheet>
  );
}
