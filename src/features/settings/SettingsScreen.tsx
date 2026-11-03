import { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { db } from '@/db/db';
import { useConfig, useHasDemo, useMeta, useProfile, useSettings, useToday } from '@/hooks/data';
import { saveConfig } from '@/services/plan';
import { setMeta } from '@/services/meta';
import { checkBackup, downloadJSON, eraseAllData, exportBackup, restoreBackup, type ImportCheck } from '@/services/backup';
import { clearDemo, loadDemo } from '@/services/demo';
import { Button, Card, Field, PageHeader, SectionTitle, Segmented, Stepper } from '@/components/ui';
import type { PlanConfig, Settings, WeeklyCapacity } from '@/types';
import { addDays, diffDays, fmtShort, nowISO } from '@/utils/dates';
import { CapacityEditor, CommitmentsEditor } from './AvailabilityEditor';

export function SettingsScreen() {
  const today = useToday();
  const settings = useSettings();
  const profile = useProfile();
  const config = useConfig();
  const demo = useHasDemo();
  const lastBackup = useMeta<string | null>('lastBackup', null);
  const [draft, setDraft] = useState<PlanConfig | null>(null);
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [imp, setImp] = useState<ImportCheck | null>(null);
  const [impMsg, setImpMsg] = useState<string | null>(null);
  const [erase, setErase] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null)); }, []);
  const c = draft ?? config;
  const setS = (patch: Partial<Settings>) => setMeta('settings', { ...settings, ...patch });
  const dirty = !!draft;

  return (
    <div className="animate-rise">
      <PageHeader back="/" title="Settings" />

      <SectionTitle>You</SectionTitle>
      <Card className="space-y-4 p-4">
        <Field label="Name"><input className="field" defaultValue={profile?.displayName} onBlur={(e) => profile && e.target.value.trim() && setMeta('profile', { ...profile, displayName: e.target.value.trim() })} /></Field>
        <div>
          <span className="label">Appearance</span>
          <Segmented<Settings['theme']> label="Theme" value={settings.theme} onChange={(theme) => setS({ theme })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </div>
      </Card>

      <SectionTitle>Planning</SectionTitle>
      <Card className="space-y-5 p-4">
        <div>
          <p className="mb-1 font-semibold">Study time each day</p>
          <CapacityEditor value={c.capacity} onChange={(capacity: WeeklyCapacity) => setDraft({ ...c, capacity })} />
        </div>
        <div>
          <p className="mb-2 font-semibold">Tutoring and fixed commitments</p>
          <CommitmentsEditor value={c.commitments} onChange={(commitments) => setDraft({ ...c, commitments })} />
        </div>
        <div>
          <p className="mb-2 font-semibold">Unfinished work</p>
          <Segmented<PlanConfig['carryOverMode']> label="Unfinished work handling" value={c.carryOverMode} onChange={(carryOverMode) => setDraft({ ...c, carryOverMode })} options={[{ value: 'auto', label: 'Move it for me' }, { value: 'ask', label: 'Ask me first' }]} />
          <p className="mt-2 text-[13px] text-muted">{c.carryOverMode === 'auto' ? 'Each morning, missed sessions are moved to the best free slot before the subject’s next exam, and you’re told what moved.' : 'Missed sessions wait in Unfinished work with a suggested slot until you choose.'}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div><p className="font-semibold">Backlog limit</p><p className="text-[13px] text-muted">Above this many unplaceable sessions, only the top 3 are shown.</p></div>
          <Stepper value={c.backlogThreshold} step={1} min={2} max={10} onChange={(backlogThreshold) => setDraft({ ...c, backlogThreshold })} />
        </div>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--primary))]" checked={!c.provisional} onChange={(e) => setDraft({ ...c, provisional: !e.target.checked })} />
          <span>Exam dates and topics are confirmed (removes the “provisional” label)</span>
        </label>
        <Button className="w-full" disabled={!dirty} onClick={async () => {
          const r = await saveConfig(draft!, addDays(today, 1), 'Planning settings changed');
          setDraft(null);
          setPlanMsg(r ? `Saved. ${r.created} future sessions re-planned from tomorrow; completed and started work kept.` : 'Saved.');
        }}>Save and update plan</Button>
        {planMsg && <p role="status" className="text-sm font-medium text-primary">{planMsg}</p>}
        <p className="text-[13px] text-muted">Subject weights, syllabus codes and papers are in each subject’s page. Holidays are in Schedule → Unavailable days.</p>
      </Card>

      <SectionTitle>Reminders</SectionTitle>
      <Card className="space-y-1 p-4">
        {([['enabled', 'Show reminders'], ['dailyPlan', 'Today’s plan and unfinished work'], ['retests', 'Retests and repairs due'], ['examCountdown', 'Exam countdown and timetable prompts']] as const).map(([k, l]) => (
          <label key={k} className="flex min-h-[44px] items-center justify-between gap-3">
            <span>{l}</span>
            <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--primary))]" checked={settings.reminders[k]} onChange={(e) => setS({ reminders: { ...settings.reminders, [k]: e.target.checked } })} />
          </label>
        ))}
        <p className="pt-2 text-[13px] text-muted">Reminders appear inside ZAARA when you open it. Phone notifications are not scheduled in this version: browsers — iPhone especially — can’t reliably deliver them for an app that works offline without a server.</p>
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card className="space-y-4 p-4">
        <p className="text-sm text-muted">Everything is saved on this device only, in the browser’s storage. It isn’t synced to other phones or computers. Back up regularly — especially before changing phones or clearing browser data.</p>
        <p className="text-sm">
          Last backup: <b>{lastBackup ? fmtShort(lastBackup.slice(0, 10)) : 'never'}</b>
          {lastBackup && diffDays(lastBackup.slice(0, 10), today) > 14 && <span className="text-amber"> — over two weeks ago</span>}
          {persisted !== null && <span className="block text-[13px] text-muted">Storage protection: {persisted ? 'on (the browser won’t clear it automatically)' : 'not granted — install ZAARA to your home screen for stronger protection'}</span>}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={async () => { downloadJSON(await exportBackup(), `zaara-backup-${today}.json`); await setMeta('lastBackup', nowISO()); }}><Download size={16} /> Export backup</Button>
          <label className="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold">
            <Upload size={16} /> Restore
            <input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              setImpMsg(null);
              if (!f) return;
              try { setImp(checkBackup(JSON.parse(await f.text()))); } catch { setImp({ ok: false, errors: ['This file isn’t valid JSON.'] }); }
            }} />
          </label>
        </div>
        {imp && !imp.ok && <div role="alert" className="rounded-xl bg-red-soft p-3 text-sm text-red"><p className="font-semibold">This backup can’t be restored</p>{imp.errors.map((x) => <p key={x}>{x}</p>)}</div>}
        {imp?.ok && imp.summary && (
          <div className="rounded-xl bg-sunken p-3 text-sm">
            <p className="font-semibold">Backup from {fmtShort(imp.summary.exportedAt.slice(0, 10))}</p>
            <p className="text-muted">{imp.summary.sessions} sessions · {imp.summary.attempts} results · {imp.summary.exams} exams · {imp.summary.topics} topics</p>
            <p className="mt-2">Restoring replaces everything currently on this device.</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={async () => { await restoreBackup(imp.backup!); setImp(null); setImpMsg('Restored.'); }}>Replace with backup</Button>
              <Button size="sm" variant="ghost" onClick={() => setImp(null)}>Cancel</Button>
            </div>
          </div>
        )}
        {impMsg && <p role="status" className="text-sm font-medium text-primary">{impMsg}</p>}
      </Card>

      <SectionTitle>Sample data</SectionTitle>
      <Card className="space-y-3 p-4">
        <p className="text-sm text-muted">Adds a few clearly marked sample results, a repair and a missed session so you can see how the screens work. A banner shows while it’s present, and clearing removes only sample records.</p>
        {demo ? <Button variant="secondary" onClick={() => clearDemo(today)}>Clear sample data</Button> : <Button variant="secondary" onClick={() => loadDemo(today)}>Load sample data</Button>}
      </Card>

      <SectionTitle>Install ZAARA</SectionTitle>
      <Card className="space-y-2 p-4 text-sm">
        <p><b>Android (Chrome):</b> menu ⋮ → “Install app” or “Add to Home screen”.</p>
        <p><b>iPhone (Safari):</b> Share button → “Add to Home Screen”. Open ZAARA from the home-screen icon so its storage stays with the installed app.</p>
        <p className="text-muted">Once opened, ZAARA works offline. Updates are offered with an “Update” button so a session is never interrupted.</p>
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card className="space-y-3 p-4 text-sm">
        <p className="text-muted">No accounts, no ads, no analytics, no leaderboards. Nothing leaves this device unless you export a backup or open an external link.</p>
        <Field label="Delete all data on this device" hint="Type DELETE to confirm. Export a backup first if you might want it later.">
          <input className="field" value={erase} onChange={(e) => setErase(e.target.value)} />
        </Field>
        <Button variant="danger" disabled={erase !== 'DELETE'} onClick={async () => { await eraseAllData(); await db.close(); location.reload(); }}>Delete everything</Button>
      </Card>
      <p className="mt-6 text-center text-[13px] text-muted">ZAARA v1.0 · data schema v1</p>
    </div>
  );
}
