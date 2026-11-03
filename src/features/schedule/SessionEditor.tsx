import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Play } from 'lucide-react';
import { db } from '@/db/db';
import { MODE_LABEL, TEMPLATES } from '@/data/catalog';
import { useSubjectMap, useTopics } from '@/hooks/data';
import { moveSession, reorderDay, setPlannedMode, setTemplate, setTopics, skipSession } from '@/services/plan';
import { sessionTitle, statusInfo } from '@/components/session';
import { Button, Chip, Field, Segmented, Sheet } from '@/components/ui';
import { TopicOptions } from '@/components/TopicOptions';
import type { ISODate, PaceMode, StudySession } from '@/types';
import { fmtShort, isValidISODate } from '@/utils/dates';

export function SessionEditor({ session, onClose, today }: { session: StudySession | null; onClose: () => void; today: ISODate }) {
  const subjects = useSubjectMap();
  const topics = useTopics();
  const nav = useNavigate();
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [s, setS] = useState<StudySession | null>(session);
  useEffect(() => {
    setS(session);
    setDate(session?.date ?? '');
    setReason('');
    setMsg(null);
  }, [session]);
  if (!s) return null;
  const refresh = async () => setS((await db.sessions.get(s.id)) ?? null);
  const locked = s.status === 'completed' || s.status === 'converted' || s.status === 'consolidated' || s.status === 'skipped';
  const subjectTopics = topics.filter((t) => t.subjectId === s.subjectId && t.active);
  const templates = TEMPLATES.filter((t) => t.subjectId === s.subjectId || t.id === 'exam-prep');
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      await refresh();
      setMsg(ok);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const move = async (dir: -1 | 1) => {
    const day = (await db.sessions.where('date').equals(s.date).toArray()).filter((x) => !['converted', 'consolidated'].includes(x.status)).sort((a, b) => a.order - b.order);
    const i = day.findIndex((x) => x.id === s.id);
    const j = i + dir;
    if (j < 0 || j >= day.length) return;
    [day[i], day[j]] = [day[j], day[i]];
    await run(() => reorderDay(day.map((x) => x.id)), 'Order updated.');
  };

  return (
    <Sheet open={!!session} onClose={onClose} title={`${subjects[s.subjectId]?.name ?? ''} · ${fmtShort(s.date)}`}>
      <p className="font-semibold" lang="und">{sessionTitle(s, topics)}</p>
      <div className="mt-1 flex flex-wrap gap-2"><Chip tone={statusInfo(s, today).tone}>{statusInfo(s, today).label}</Chip>{s.pinned && <Chip>Edited by you</Chip>}</div>
      {s.reason && <p className="mt-2 text-sm text-muted">{s.reason}</p>}
      {s.moves.map((m, i) => <p key={i} className="mt-1 text-[13px] text-muted">Moved {fmtShort(m.from)} → {fmtShort(m.to)}. {m.reason}</p>)}
      {s.skipReason && <p className="mt-1 text-sm text-muted">Reason: {s.skipReason}</p>}

      {!locked && (
        <div className="mt-5 space-y-4">
          <Button className="w-full" onClick={() => nav(`/session/${s.id}`)}><Play size={16} /> Open session</Button>
          <div className="flex items-end gap-2">
            <Field label="Date">
              <input type="date" className="field" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Button variant="secondary" disabled={!isValidISODate(date) || date === s.date} onClick={() => run(() => moveSession(s.id, date), `Moved to ${fmtShort(date)}.`)}>Move</Button>
          </div>
          <div>
            <span className="label">Planned length</span>
            <Segmented<PaceMode> label="Planned length" value={s.plannedMode} onChange={(m) => run(() => setPlannedMode(s.id, m), `Planned as ${MODE_LABEL[m]}.`)} options={(['full', 'steady', 'light'] as PaceMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
          </div>
          {subjectTopics.length > 0 && (
            <Field label="Topic">
              <select className="field" value={s.topicIds[0] ?? ''} onChange={(e) => run(() => setTopics(s.id, e.target.value ? [e.target.value] : []), 'Topic updated.')}>
                <option value="">No specific topic / mixed</option>
                <TopicOptions topics={subjectTopics} />
              </select>
            </Field>
          )}
          {s.source !== 'repair' && s.source !== 'retest' && s.source !== 'review' && (
            <Field label="Session type">
              <select className="field" value={s.templateId} onChange={(e) => run(() => setTemplate(s.id, e.target.value), 'Session type updated.')}>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => move(-1)}><ArrowUp size={15} /> Earlier in day</Button>
            <Button variant="secondary" size="sm" onClick={() => move(1)}><ArrowDown size={15} /> Later in day</Button>
          </div>
          <div className="rounded-xl bg-sunken p-3">
            <span className="label">Skip with a reason</span>
            <div className="flex gap-2">
              <input className="field" value={reason} placeholder="e.g. School trip" onChange={(e) => setReason(e.target.value)} />
              <Button variant="secondary" disabled={!reason.trim()} onClick={() => run(() => skipSession(s.id, reason), 'Skipped — kept in your history.')}>Skip</Button>
            </div>
          </div>
        </div>
      )}
      {msg && <p role="status" className="mt-4 text-sm font-medium text-primary">{msg}</p>}
    </Sheet>
  );
}
