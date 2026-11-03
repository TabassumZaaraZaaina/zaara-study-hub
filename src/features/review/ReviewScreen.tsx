import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Search } from 'lucide-react';
import { useErrors, useRepairs, useSessions, useSubjectMap, useToday, useTopics } from '@/hooks/data';
import { ERROR_LABEL, REPAIR_METHODS } from '@/domain/repair';
import { setErrorResolved } from '@/services/assess';
import { SessionRow } from '@/components/session';
import { Card, Chip, Empty, PageHeader, Segmented, SubjectGlyph, cx } from '@/components/ui';
import type { SubjectId } from '@/types';
import { fmtShort } from '@/utils/dates';
import { CarryQueue, useCarry } from './CarryQueue';

type Tab = 'unfinished' | 'repairs' | 'retests' | 'errors';
const REPAIR_STATUS = { diagnose: 'Choose a method', scheduled: 'Repair planned', repaired: 'Repaired', 'retest-scheduled': 'Retest planned', closed: 'Closed' } as const;

export function ReviewScreen() {
  const [tab, setTab] = useState<Tab>('unfinished');
  const today = useToday();
  const carry = useCarry(today);
  const repairs = useRepairs();
  const sessions = useSessions() ?? [];
  const errors = useErrors();
  const subjects = useSubjectMap();
  const topics = useTopics();
  const [showResolved, setShowResolved] = useState(false);
  const [q, setQ] = useState('');
  const [subj, setSubj] = useState<SubjectId | ''>('');

  const openRepairs = repairs.filter((r) => r.status !== 'closed').sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const closedRepairs = repairs.filter((r) => r.status === 'closed').sort((a, b) => ((a.closedAt ?? '') < (b.closedAt ?? '') ? 1 : -1));
  const retests = sessions.filter((s) => (s.source === 'retest' || s.source === 'review') && ['planned', 'in_progress'].includes(s.status)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const errs = errors
    .filter((e) => (showResolved ? true : !e.resolved))
    .filter((e) => !subj || e.subjectId === subj)
    .filter((e) => !q || `${e.description} ${e.correction}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const topicName = (id: string | null) => (id ? topics.find((t) => t.id === id)?.title ?? '' : '');

  return (
    <div className="animate-rise">
      <PageHeader title="Review" subtitle="Unfinished work, repairs, retests and your error log." />
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <div className="min-w-[440px]">
          <Segmented<Tab> label="Review section" value={tab} onChange={setTab} options={[
            { value: 'unfinished', label: <>Unfinished{carry?.proposals.length ? ` · ${carry.proposals.length}` : ''}</> },
            { value: 'repairs', label: <>Repairs{openRepairs.length ? ` · ${openRepairs.length}` : ''}</> },
            { value: 'retests', label: <>Retests{retests.length ? ` · ${retests.length}` : ''}</> },
            { value: 'errors', label: 'Error log' }
          ]} />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {tab === 'unfinished' && (carry?.proposals.length ? <CarryQueue today={today} /> : <Empty icon={<CheckCircle2 />} title="Nothing unfinished">Missed or partly-done sessions appear here, so they’re never silently forgotten.</Empty>)}

        {tab === 'repairs' && (
          <>
            {!openRepairs.length && <Empty icon={<CheckCircle2 />} title="No open repairs">A repair is suggested when a marked result is below 50%.</Empty>}
            {openRepairs.map((r) => (
              <Link key={r.id} to={`/repair/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-line/60 bg-surface p-4 shadow-card">
                <SubjectGlyph id={r.subjectId} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{subjects[r.subjectId]?.name}{r.topicId ? ` · ${topicName(r.topicId)}` : ''}</p>
                  <p className="text-sm text-muted">{r.method ? REPAIR_METHODS[r.method].name : 'Find what was difficult'} · due {fmtShort(r.dueDate)}</p>
                </div>
                <Chip tone={r.status === 'diagnose' ? 'amber' : 'primary'}>{REPAIR_STATUS[r.status]}</Chip>
              </Link>
            ))}
            {closedRepairs.length > 0 && <p className="pt-3 text-sm font-semibold text-muted">Recently repaired</p>}
            {closedRepairs.slice(0, 5).map((r) => (
              <Link key={r.id} to={`/repair/${r.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm">
                <CheckCircle2 size={18} className="text-green" /> <span className="flex-1">{subjects[r.subjectId]?.shortName} · {topicName(r.topicId) || 'subject level'}</span> <ArrowRight size={15} className="text-muted" />
              </Link>
            ))}
          </>
        )}

        {tab === 'retests' && (retests.length ? (
          <Card className="p-2">{retests.map((s) => <SessionRow key={s.id} s={s} subject={subjects[s.subjectId]} topics={topics} today={today} />)}</Card>
        ) : <Empty title="No retests planned">Retests use unseen questions after a repair, and spaced checks confirm that strong results last.</Empty>)}

        {tab === 'errors' && (
          <>
            <div className="flex gap-2">
              <label className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="field pl-9" placeholder="Search" aria-label="Search errors" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <select className="field w-36" aria-label="Filter subject" value={subj} onChange={(e) => setSubj(e.target.value as SubjectId | '')}>
                <option value="">All</option>
                {Object.values(subjects).map((s) => <option key={s.id} value={s.id}>{s.shortName}</option>)}
              </select>
            </div>
            <label className="flex min-h-[40px] items-center gap-2 text-sm text-muted"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="h-4 w-4" /> Show corrected</label>
            {!errs.length && <Empty title="No errors logged">Errors you record while marking show up here, grouped by type.</Empty>}
            {errs.map((e) => (
              <Card key={e.id} className={cx('p-4', e.resolved && 'opacity-60')}>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={e.confidentButWrong ? 'red' : 'neutral'}>{ERROR_LABEL[e.category]}</Chip>
                  {e.confidentButWrong && <Chip tone="red">Confident but wrong</Chip>}
                  <span className="text-[13px] text-muted">{subjects[e.subjectId]?.shortName}{e.topicId ? ` · ${topicName(e.topicId)}` : ''}</span>
                </div>
                {e.description && <p className="mt-2 text-[15px]" lang="und">{e.description}</p>}
                {e.correction && <p className="mt-1 text-[15px] text-green" lang="und">→ {e.correction}</p>}
                <button onClick={() => setErrorResolved(e.id, !e.resolved)} className="mt-2 min-h-[40px] text-sm font-semibold text-primary">{e.resolved ? 'Mark as not yet corrected' : 'I’ve got this now'}</button>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
