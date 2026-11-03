import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { SUBJECTS } from '@/data/catalog';
import { useConfig, useProfile, useToday } from '@/hooks/data';
import { completeSetup } from '@/services/setup';
import { Button, Card, SubjectGlyph } from '@/components/ui';
import type { FixedCommitment, WeeklyCapacity } from '@/types';
import { diffDays } from '@/utils/dates';
import { CapacityEditor, CommitmentsEditor } from '@/features/settings/AvailabilityEditor';

export function SetupScreen() {
  const profile = useProfile();
  const config = useConfig();
  const today = useToday();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState<string | null>(null);
  const [cap, setCap] = useState<WeeklyCapacity | null>(null);
  const [commit, setCommit] = useState<FixedCommitment[]>([]);
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const capacity = cap ?? config.capacity;
  const finish = async () => {
    setBusy(true);
    await completeSetup({ displayName: name ?? profile.displayName, config: { capacity, commitments: commit } }, today);
    nav('/', { replace: true });
  };
  const steps = ['Welcome', 'Study time', 'Fixed commitments'];
  return (
    <div className="mx-auto max-w-lg animate-rise pt-6">
      <p className="text-center text-sm font-semibold tracking-[0.25em] text-muted">ZAARA</p>
      <div className="mt-4 flex justify-center gap-2" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((s, i) => <span key={s} className={`h-1.5 w-10 rounded-full ${i <= step ? 'bg-primary' : 'bg-line'}`} />)}
      </div>

      {step === 0 && (
        <div className="mt-8">
          <h1 className="text-3xl font-semibold leading-tight">Your O Level study hub</h1>
          <p className="mt-3 text-muted">Every day you’ll see exactly what to study, for how long, and what’s left. Unfinished work is kept and re-planned — never silently dropped.</p>
          <label className="mt-6 block">
            <span className="label">What should I call you?</span>
            <input className="field" value={name ?? profile.displayName} onChange={(e) => setName(e.target.value)} />
          </label>
          <Card className="mt-6 p-4">
            <p className="text-sm font-semibold">Already set up</p>
            <div className="mt-3 flex flex-wrap gap-2">{SUBJECTS.map((s) => <span key={s.id} className="inline-flex items-center gap-2 rounded-full bg-sunken py-1 pl-1 pr-3 text-sm"><SubjectGlyph id={s.id} size={24} />{s.name}</span>)}</div>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li className="flex gap-2"><Check size={16} className="mt-0.5 text-green" /> Mock 2 starts 25 November 2026 — {diffDays(today, '2026-11-25')} days away</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 text-green" /> Final O Levels: May/June 2027 series</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 text-green" /> Days run on Bangladesh time</li>
            </ul>
            <p className="mt-3 text-[13px] text-muted">Paper dates, syllabus codes and topic lists can be added any time — nothing is guessed.</p>
          </Card>
          <Button size="lg" className="mt-6 w-full" onClick={() => setStep(1)}>Continue</Button>
        </div>
      )}

      {step === 1 && (
        <div className="mt-8">
          <h1 className="text-2xl font-semibold">How much time can you usually study?</h1>
          <p className="mt-2 text-muted">These are starting suggestions — set what’s realistic. You can change it later.</p>
          <Card className="mt-5 px-4 py-2"><CapacityEditor value={capacity} onChange={setCap} /></Card>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(0)}>Back</Button>
            <Button className="flex-1" onClick={() => setStep(2)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-8">
          <h1 className="text-2xl font-semibold">Any tutoring or fixed commitments?</h1>
          <p className="mt-2 text-muted">Optional. Skip if none — you can add them later in Settings.</p>
          <Card className="mt-5 p-4"><CommitmentsEditor value={commit} onChange={setCommit} /></Card>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>Back</Button>
            <Button className="flex-1" disabled={busy} onClick={finish}>{busy ? 'Planning…' : 'Create my plan'}</Button>
          </div>
          <p className="mt-4 text-center text-[13px] text-muted">The first plan is provisional. It gets sharper as you add your Mock 2 timetable and topic lists.</p>
        </div>
      )}
    </div>
  );
}
