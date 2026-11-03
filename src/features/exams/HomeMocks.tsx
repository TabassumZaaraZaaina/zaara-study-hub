import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Plus, Trash2 } from 'lucide-react';
import { useAttempts, useSessions, useSubjectMap, useSubjects, useToday } from '@/hooks/data';
import { pct } from '@/domain/mastery';
import { SUGGESTED_SERIES, bookHomeMock, rebalanceAfterMocks, bookSuggestedSeries, cancelHomeMock, summariseBookings, packPaper, paperMinutesFromName, paperShortName } from '@/services/homemock';
import { Button, Card, Chip, Empty, Field, SectionTitle, Sheet, Stepper, SubjectGlyph, cx } from '@/components/ui';
import type { ISODate, SubjectId } from '@/types';
import { fmtMinutes, fmtShort, isValidISODate } from '@/utils/dates';

export function HomeMocks() {
  const today = useToday();
  const sessions = useSessions() ?? [];
  const subjects = useSubjectMap();
  const attempts = useAttempts();
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const names = useMemo(() => Object.fromEntries(Object.values(subjects).map((s) => [s.id, s.shortName])), [subjects]);
  const mocks = sessions.filter((s) => s.source === 'homemock').sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
  const remaining = SUGGESTED_SERIES.filter((x) => x.date >= today && !mocks.some((m) => m.date === x.date && m.subjectId === x.subjectId && m.mockPaper?.paperId === x.paperId));
  const scoreFor = (mockId: string) => {
    const markIds = sessions.filter((s) => s.parentSessionId === mockId).map((s) => s.id);
    return attempts.find((a) => a.sessionId === mockId || (a.sessionId && markIds.includes(a.sessionId)));
  };

  return (
    <div>
      <p className="text-sm text-muted">Past papers sat at home under exam conditions. Booking one clears room on that day by moving untouched sessions to later days, and plans a marking session for the next day.</p>

      {remaining.length > 0 && (
        <Card className="mt-4 p-4">
          <p className="font-semibold">Suggested Mock 2 series · May/June 2026 papers</p>
          <p className="mt-1 text-[13px] text-muted">Add Maths and Maths D first, so their weak topics get the most repair time. Economics uses the old timings because all its past papers predate the 2027 syllabus.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {remaining.map((x, i) => (
              <li key={i} className="flex justify-between gap-2"><span>{fmtShort(x.date)} · {names[x.subjectId]} {paperShortName(packPaper(x.subjectId as SubjectId, x.paperId).label)}</span><span className="whitespace-nowrap text-muted">{fmtMinutes(x.minutes ?? packPaper(x.subjectId as SubjectId, x.paperId).minutes)}</span></li>
            ))}
          </ul>
          <Button className="mt-4 w-full" disabled={busy} onClick={async () => {
            setBusy(true);
            const rs = await bookSuggestedSeries(today);
            setBusy(false);
            setReport(await summariseBookings(rs, names));
          }}><CalendarCheck size={17} /> {busy ? 'Booking…' : `Book these ${remaining.length} papers`}</Button>
        </Card>
      )}

      {report && (
        <Card className="mt-3 p-4 text-sm" role="status">
          {report.map((l, i) => <p key={i} className={i ? 'mt-1 text-muted' : 'font-semibold'}>{l}</p>)}
        </Card>
      )}

      <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setOpen(true)}><Plus size={15} /> Book one</Button>}>Booked</SectionTitle>
      {mocks.length ? (
        <div className="space-y-2">
          {mocks.map((m) => {
            const a = scoreFor(m.id);
            const mark = sessions.find((s) => s.parentSessionId === m.id && s.source === 'homemock-mark');
            return (
              <Card key={m.id} className="flex items-center gap-3 p-3 pl-4">
                <SubjectGlyph id={m.subjectId} size={36} />
                <Link to={`/session/${m.id}`} className="min-w-0 flex-1">
                  <p className="font-semibold">{names[m.subjectId]} · {paperShortName(m.mockPaper?.label ?? '')}</p>
                  <p className="text-[13px] text-muted">{fmtShort(m.date)} · {fmtMinutes(m.mockPaper?.minutes ?? 0)}{m.mockPaper?.reference ? ` · ${m.mockPaper.reference}` : ''}{mark ? ` · marking ${fmtShort(mark.date)}` : ''}</p>
                </Link>
                {a ? <Chip tone={pct(a) < 50 ? 'red' : pct(a) >= 70 ? 'green' : 'amber'}>{pct(a)}%</Chip> : m.status === 'completed' ? <Chip tone="amber">To mark</Chip> : m.status === 'planned' ? (
                  <button aria-label="Cancel this home mock" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-sunken" onClick={() => cancelHomeMock(m.id)}><Trash2 size={16} /></button>
                ) : <Chip>{m.status === 'in_progress' ? 'In progress' : m.status}</Chip>}
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty title="No home mocks booked">Keep the papers you use here unseen — out of NotebookLM — so the score is honest.</Empty>
      )}
      <BookSheet open={open} onClose={() => setOpen(false)} today={today} onBooked={(lines) => setReport(lines)} names={names} />
    </div>
  );
}

function BookSheet({ open, onClose, today, onBooked, names }: { open: boolean; onClose: () => void; today: ISODate; onBooked: (l: string[]) => void; names: Record<string, string> }) {
  const subjects = useSubjects();
  const [subjectId, setSubject] = useState<SubjectId>('physics');
  const [paperId, setPaperId] = useState('');
  const [date, setDate] = useState(today);
  const [ref, setRef] = useState('');
  const [minutes, setMinutes] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const subject = subjects.find((s) => s.id === subjectId);
  const papers = subject?.papers.filter((p) => !/practical test/i.test(p.name)) ?? [];
  const paper = papers.find((p) => p.id === paperId) ?? papers[0];
  const defaultMin = (paper && paperMinutesFromName(paper.name)) ?? 120;
  const mins = minutes ?? defaultMin;
  return (
    <Sheet open={open} onClose={onClose} title="Book a home mock">
      <div className="space-y-4">
        <Field label="Subject">
          <select className="field" value={subjectId} onChange={(e) => { setSubject(e.target.value as SubjectId); setPaperId(''); setMinutes(null); }}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Paper" hint={papers.length ? undefined : 'Load this subject’s syllabus topics to list its papers.'}>
          <select className="field" value={paper?.id ?? ''} onChange={(e) => { setPaperId(e.target.value); setMinutes(null); }} disabled={!papers.length}>
            {papers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Which past paper?" hint="e.g. 4037/12 M/J 2026 — one she hasn’t seen."><input className="field" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="Date"><input type="date" className="field" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <div><span className="label">Length</span><Stepper value={mins} step={15} min={15} max={300} format={fmtMinutes} onChange={setMinutes} /></div>
        </div>
        {err && <p role="alert" className="text-sm text-red">{err}</p>}
        <Button className={cx('w-full')} disabled={!isValidISODate(date) || date < today} onClick={async () => {
          setErr(null);
          try {
            const r = await bookHomeMock({ date, subjectId, paper: { paperId: paper?.id ?? null, label: paper?.name ?? 'Paper', reference: ref.trim(), minutes: mins } });
            if (!r.alreadyBooked) await rebalanceAfterMocks(today);
            onBooked(r.alreadyBooked ? ['That paper is already booked on that day.'] : [`Booked ${names[subjectId]} for ${fmtShort(date)}.`, ...(await summariseBookings([r], names)).slice(1)]);
            onClose();
          } catch (e) { setErr((e as Error).message); }
        }}>Book</Button>
      </div>
    </Sheet>
  );
}
