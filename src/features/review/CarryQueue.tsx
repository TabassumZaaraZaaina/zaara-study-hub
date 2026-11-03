import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, Layers } from 'lucide-react';
import { carryOverview, doToday, placeOne, quickCheckInstead, skipSession } from '@/services/plan';
import { useSubjectMap, useTopics } from '@/hooks/data';
import { sessionTitle } from '@/components/session';
import { Button, Card, Chip, Sheet, SubjectGlyph } from '@/components/ui';
import type { ISODate, StudySession } from '@/types';
import { fmtMinutes, fmtShort, relativeDay } from '@/utils/dates';

export function useCarry(today: ISODate) {
  return useLiveQuery(() => carryOverview(today), [today]);
}

export function CarryQueue({ today, limit }: { today: ISODate; limit?: number }) {
  const data = useCarry(today);
  const subjects = useSubjectMap();
  const topics = useTopics();
  const [skipFor, setSkipFor] = useState<StudySession | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  if (!data || !data.proposals.length) return null;

  const items = data.backlog ? data.proposals.slice(0, 3) : data.proposals;
  const shown = limit ? items.slice(0, limit) : items;
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-soft text-amber"><Layers size={18} /></span>
        <div>
          <p className="font-semibold">Unfinished work · {data.proposals.length}</p>
          <p className="text-sm text-muted">
            {data.backlog
              ? `About ${fmtMinutes(data.minutes)} has built up. Here are the ${Math.min(3, data.proposals.length)} that matter most — the rest is kept in Review.`
              : 'Kept safe from earlier days. Choose where each one goes.'}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {shown.map(({ session: s, placement: p, minutes }) => (
          <li key={s.id} className="py-3">
            <div className="flex items-start gap-3">
              <SubjectGlyph id={s.subjectId} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug">
                  {subjects[s.subjectId]?.name}: {sessionTitle(s, topics)}
                </p>
                <p className="text-[13px] text-muted">
                  {s.status === 'partial' ? 'Started' : 'Not started'} {relativeDay(s.date, today)} · {fmtMinutes(minutes)} left
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  {p.type === 'none' ? <Chip tone="amber">No free slot before the deadline</Chip> : <>Suggested: <b className="text-ink">{fmtShort(p.date)}</b> — {p.explanation}</>}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2 pl-[46px]">
              {p.type !== 'none' && (
                <Button size="sm" disabled={busy === s.id} onClick={() => act(s.id, () => placeOne(s.id, today))}>
                  <CalendarClock size={15} /> Move to {fmtShort(p.date)}
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled={busy === s.id} onClick={() => act(s.id, () => doToday(s.id, today))}>Do today</Button>
              <Button size="sm" variant="secondary" disabled={busy === s.id} onClick={() => act(s.id, () => quickCheckInstead(s.id, today))}>15-min check instead</Button>
              <Button size="sm" variant="ghost" onClick={() => { setSkipFor(s); setReason(''); }}>Let it go…</Button>
            </div>
          </li>
        ))}
      </ul>
      {limit && items.length > limit && <p className="pt-2 text-sm text-muted">+{items.length - limit} more in Review</p>}

      <Sheet open={!!skipFor} onClose={() => setSkipFor(null)} title="Let this session go">
        <p className="text-sm text-muted">It stays in your history with your reason, and won't be rescheduled. Nothing is marked as done.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['Covered at school', 'Already know it well', 'Replaced by other practice', 'Not in my exam'].map((r) => (
            <button key={r} onClick={() => setReason(r)} className={`min-h-[40px] rounded-full border px-3 text-sm ${reason === r ? 'border-primary bg-primary-soft text-primary' : 'border-line'}`}>{r}</button>
          ))}
        </div>
        <input className="field mt-3" placeholder="Or write a reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button className="mt-4 w-full" disabled={!reason.trim()} onClick={async () => { await skipSession(skipFor!.id, reason); setSkipFor(null); }}>Save</Button>
      </Sheet>
    </Card>
  );
}
