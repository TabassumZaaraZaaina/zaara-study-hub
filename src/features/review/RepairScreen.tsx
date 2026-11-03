import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { ERROR_LABEL, METHOD_FOR, REPAIR_METHODS } from '@/domain/repair';
import { pct } from '@/domain/mastery';
import { diagnoseRepair } from '@/services/assess';
import { useSubjectMap, useTopics } from '@/hooks/data';
import { Button, Card, Chip, PageHeader, cx } from '@/components/ui';
import type { ErrorCategory, RepairMethod } from '@/types';
import { fmtShort } from '@/utils/dates';

export function RepairScreen() {
  const { id } = useParams();
  const repair = useLiveQuery(() => db.repairs.get(id!), [id]);
  const source = useLiveQuery(async () => (repair ? db.attempts.get(repair.sourceAttemptId) : undefined), [repair?.sourceAttemptId]);
  const retest = useLiveQuery(async () => (repair?.retestAttemptId ? db.attempts.get(repair.retestAttemptId) : undefined), [repair?.retestAttemptId]);
  const session = useLiveQuery(async () => (repair?.repairSessionId ? db.sessions.get(repair.repairSessionId) : undefined), [repair?.repairSessionId]);
  const subjects = useSubjectMap();
  const topics = useTopics();
  const [diag, setDiag] = useState<ErrorCategory | null>(null);
  const [method, setMethod] = useState<RepairMethod | null>(null);
  if (!repair) return null;
  const d = diag ?? repair.diagnosis;
  const m = method ?? repair.method;
  const topic = topics.find((t) => t.id === repair.topicId);

  return (
    <div className="animate-rise">
      <PageHeader back="/review" title="Repair" subtitle={`${subjects[repair.subjectId]?.name ?? ''}${topic ? ` · ${topic.title}` : ''}`} />
      <Card className="p-5">
        <p className="text-lg font-semibold">This idea needs a different approach.</p>
        <p className="mt-1 text-muted">A low score is information, not a verdict. Pick what made it difficult, and use a method that targets that.</p>
        {source && <p className="mt-3 text-sm text-muted">From your result on {fmtShort(source.date)}: {source.marksEarned}/{source.marksAvailable} ({pct(source)}%).</p>}
        {retest && <p className="mt-1 text-sm font-semibold text-green">Retest on {fmtShort(retest.date)}: {pct(retest)}%</p>}
      </Card>

      <h2 className="mb-2 mt-6 font-semibold">What made it difficult?</h2>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(ERROR_LABEL) as ErrorCategory[]).map((c) => (
          <button key={c} onClick={() => { setDiag(c); setMethod(METHOD_FOR[c][0]); }} className={cx('min-h-[52px] rounded-xl border px-3 text-left text-sm font-medium', d === c ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface')}>{ERROR_LABEL[c]}</button>
        ))}
      </div>

      {d && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">Repair method</h2>
          <div className="space-y-2">
            {(Object.keys(REPAIR_METHODS) as RepairMethod[]).sort((a, b) => Number(METHOD_FOR[d].includes(b)) - Number(METHOD_FOR[d].includes(a))).map((k) => (
              <button key={k} onClick={() => setMethod(k)} className={cx('block w-full rounded-2xl border p-4 text-left', m === k ? 'border-primary bg-primary-soft/60' : 'border-line bg-surface')}>
                <span className="flex items-center gap-2 font-semibold">{REPAIR_METHODS[k].name}{METHOD_FOR[d].includes(k) && <Chip tone="primary">suits this</Chip>}</span>
                {m === k && <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{REPAIR_METHODS[k].steps.map((s) => <li key={s}>{s}</li>)}</ol>}
              </button>
            ))}
          </div>
          <Button size="lg" className="mt-5 w-full" disabled={!m} onClick={() => diagnoseRepair(repair.id, d, m!)}>
            {repair.method ? 'Update plan' : 'Use this method'}
          </Button>
        </>
      )}

      {session && repair.method && (
        <Card className="mt-5 p-4">
          <p className="font-semibold">Repair session · {fmtShort(session.date)}</p>
          <p className="text-sm text-muted">30 minutes. After it, an unseen retest is planned 2–4 days later.</p>
          {session.status !== 'completed' && <Link to={`/session/${session.id}`} className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 font-semibold text-on-primary">Open repair session</Link>}
          {session.status === 'completed' && <p className="mt-2 text-sm text-green">Done.</p>}
        </Card>
      )}
      <p className="mt-5 text-[13px] text-muted">Retests must use a question you haven’t seen. If you use AI or other generated questions, record them as “Generated practice” — they are never shown as official Cambridge questions.</p>
    </div>
  );
}
