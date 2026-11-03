import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Stepper } from '@/components/ui';
import type { FixedCommitment, WeeklyCapacity } from '@/types';
import { WEEKDAY_NAMES, fmtMinutes } from '@/utils/dates';
import { uid } from '@/services/meta';

export function CapacityEditor({ value, onChange }: { value: WeeklyCapacity; onChange: (v: WeeklyCapacity) => void }) {
  const total = value.reduce((a, b) => a + b, 0);
  return (
    <div>
      <ul className="divide-y divide-line">
        {value.map((m, i) => (
          <li key={i} className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium">{WEEKDAY_NAMES[i]}</span>
            <Stepper value={m} step={15} max={360} format={(n) => (n ? fmtMinutes(n) : 'Rest')} onChange={(n) => onChange(value.map((x, j) => (j === i ? n : x)) as WeeklyCapacity)} />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">About {fmtMinutes(total)} a week. A Full session is 90 min; 45 min left over becomes a Steady session.</p>
    </div>
  );
}

export function CommitmentsEditor({ value, onChange }: { value: FixedCommitment[]; onChange: (v: FixedCommitment[]) => void }) {
  const [label, setLabel] = useState('');
  const [weekday, setWeekday] = useState(6);
  const [minutes, setMinutes] = useState(90);
  return (
    <div>
      <ul className="space-y-2">
        {value.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2 text-sm">
            <span className="flex-1">{c.label} · {WEEKDAY_NAMES[c.weekday]} · {fmtMinutes(c.minutes)}</span>
            <button aria-label={`Remove ${c.label}`} className="p-2 text-muted" onClick={() => onChange(value.filter((x) => x.id !== c.id))}><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input className="field col-span-2" placeholder="e.g. Physics tutor" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Commitment name" />
        <select className="field" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} aria-label="Day">
          {WEEKDAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
        <Stepper value={minutes} step={15} min={15} max={300} format={fmtMinutes} onChange={setMinutes} />
      </div>
      <Button variant="secondary" size="sm" className="mt-2" disabled={!label.trim()} onClick={() => { onChange([...value, { id: uid(), label: label.trim(), weekday, minutes }]); setLabel(''); }}>Add</Button>
      <p className="mt-2 text-[13px] text-muted">This time is taken out of that day’s study time.</p>
    </div>
  );
}
