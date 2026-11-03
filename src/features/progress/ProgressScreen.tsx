import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { SUBJECT_STYLE } from '@/data/catalog';
import { pct } from '@/domain/mastery';
import { rangeStats, subjectSummary, dayStats } from '@/domain/progress';
import { wins, masteryAsOf } from '@/domain/insights';
import { useAttempts, useExams, useMastery, useRepairs, useSessions, useSubjects, useToday, useTopics } from '@/hooks/data';
import { useCarry } from '@/features/review/CarryQueue';
import { Card, Chip, PageHeader, SectionTitle, SubjectGlyph, cx } from '@/components/ui';
import { MasteryStack } from '@/features/subjects/MasteryStack';
import type { MasteryState } from '@/types';
import { addDays, dateRange, fmtMinutes, fmtShort, startOfWeek, weekdayShort } from '@/utils/dates';

export function ProgressScreen() {
  const today = useToday();
  const sessions = useSessions() ?? [];
  const subjects = useSubjects();
  const topics = useTopics();
  const attempts = useAttempts();
  const repairs = useRepairs();
  const exams = useExams();
  const carry = useCarry(today);
  const mastery = useMastery(topics, attempts);
  const ws = startOfWeek(today);
  const week = rangeStats(sessions, ws, addDays(ws, 6));
  const todayStats = dayStats(sessions, today);
  const w = wins(today, topics, attempts, repairs);
  const upcoming = exams.filter((e) => e.date && e.date >= today).sort((a, b) => (a.date! < b.date! ? -1 : 1)).slice(0, 3);
  const recent = [...attempts].sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)).slice(0, 5);
  const activeTopics = topics.filter((t) => t.active);
  const now: Record<MasteryState, number> = { unassessed: 0, red: 0, amber: 0, green: 0 };
  const before: Record<MasteryState, number> = { unassessed: 0, red: 0, amber: 0, green: 0 };
  for (const t of activeTopics) {
    now[mastery[t.id] ?? 'unassessed']++;
    before[masteryAsOf(t.id, attempts, addDays(today, -14)).state]++;
  }
  const load = subjects.map((s) => ({
    s,
    done: sessions.filter((x) => x.subjectId === s.id && x.status === 'completed' && x.date >= ws && x.date <= addDays(ws, 6)).reduce((t, x) => t + x.actualMinutes, 0),
    planned: sessions.filter((x) => x.subjectId === s.id && x.date >= ws && x.date <= addDays(ws, 6) && !['converted', 'consolidated', 'skipped'].includes(x.status)).reduce((t, x) => t + x.plannedMinutes, 0)
  }));
  const maxLoad = Math.max(1, ...load.map((l) => l.planned));

  return (
    <div className="animate-rise">
      <PageHeader title="Progress" subtitle="Activity, coverage, results and mastery — kept separate on purpose." />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><p className="text-[13px] text-muted">Today</p><p className="text-2xl font-semibold">{todayStats.completed}/{todayStats.planned}</p><p className="text-[12px] text-muted">sessions completed</p></Card>
        <Card className="p-4"><p className="text-[13px] text-muted">This week</p><p className="text-2xl font-semibold">{week.completed}/{week.planned}</p><p className="text-[12px] text-muted">{week.upcoming} still to come</p></Card>
      </div>

      <Card className="mt-3 p-4">
        <div className="flex h-24 items-end justify-between gap-2" role="img" aria-label="Sessions completed per day this week">
          {dateRange(ws, addDays(ws, 6)).map((d) => {
            const st = dayStats(sessions, d);
            const h = st.planned ? st.completed / st.planned : 0;
            return (
              <div key={d} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative flex h-16 w-full max-w-[28px] items-end overflow-hidden rounded-lg bg-sunken">
                  <div className="w-full rounded-lg bg-primary transition-[height] duration-500" style={{ height: `${h * 100}%` }} />
                </div>
                <span className={cx('text-[11px]', d === today ? 'font-bold text-primary' : 'text-muted')}>{weekdayShort(d)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] text-muted">Completed this week: {week.modeCounts.full} Full · {week.modeCounts.steady} Steady · {week.modeCounts.light} Light. Every mode counts.</p>
      </Card>

      {w.length > 0 && (
        <>
          <SectionTitle>Recent wins</SectionTitle>
          <Card className="divide-y divide-line">
            {w.map((x) => <p key={x} className="flex items-start gap-3 px-4 py-3 text-[15px]"><Sparkles size={16} className="mt-1 shrink-0 text-primary" /> {x}</p>)}
          </Card>
        </>
      )}

      <SectionTitle>Six subjects</SectionTitle>
      <div className="space-y-2">
        {subjects.map((s) => {
          const sum = subjectSummary(s.id, topics, sessions, attempts, mastery);
          return (
            <Link key={s.id} to={`/subjects/${s.id}`} className="block">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <SubjectGlyph id={s.id} size={36} />
                  <p className="flex-1 font-semibold">{s.name}</p>
                  {!sum.enoughEvidence && <Chip>Not enough data yet</Chip>}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[13px]">
                  <div><dt className="text-muted">Practised</dt><dd className="font-semibold">{fmtMinutes(sum.practiceMinutes)}</dd></div>
                  <div><dt className="text-muted">Coverage</dt><dd className="font-semibold">{sum.coverage === null ? '—' : `${sum.topicsPractised}/${sum.topicsListed}`}</dd></div>
                  <div><dt className="text-muted">Results</dt><dd className="font-semibold">{sum.recentAverage === null ? '—' : `${sum.recentAverage}% (${sum.recentCount})`}</dd></div>
                </dl>
                {sum.topicsListed > 0 && <MasteryStack counts={sum.mastery} className="mt-3" />}
              </Card>
            </Link>
          );
        })}
      </div>

      {activeTopics.length > 0 && (
        <>
          <SectionTitle>Mastery trend</SectionTitle>
          <Card className="p-4">
            <p className="mb-1 text-[13px] text-muted">14 days ago</p>
            <MasteryStack counts={before} />
            <p className="mb-1 mt-3 text-[13px] text-muted">Now</p>
            <MasteryStack counts={now} legend />
          </Card>
        </>
      )}

      <SectionTitle>Time this week by subject</SectionTitle>
      <Card className="space-y-3 p-4">
        {load.map(({ s, done, planned }) => (
          <div key={s.id}>
            <div className="flex justify-between text-[13px]"><span className="font-medium">{s.shortName}</span><span className="text-muted">{fmtMinutes(done)} of {fmtMinutes(planned)}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken" style={{ width: `${Math.max(8, (planned / maxLoad) * 100)}%` }}>
              <div className="h-full rounded-full" style={{ width: `${planned ? Math.min(100, (done / planned) * 100) : 0}%`, background: SUBJECT_STYLE[s.id].accent }} />
            </div>
          </div>
        ))}
      </Card>

      <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm font-semibold">Upcoming exams</p>
          {upcoming.length ? upcoming.map((e) => <p key={e.id} className="mt-1 text-sm text-muted">{subjects.find((s) => s.id === e.subjectId)?.shortName} {e.paper} · {fmtShort(e.date!)}</p>) : <p className="mt-1 text-sm text-muted">No paper dates entered. <Link className="text-primary underline" to="/exams">Add them</Link></p>}
        </Card>
        <Card className="p-4">
          <p className="text-sm font-semibold">Review queue</p>
          <p className="mt-1 text-sm text-muted">{carry?.proposals.length ?? 0} unfinished · {repairs.filter((r) => r.status !== 'closed').length} open repairs</p>
          <Link to="/review" className="mt-1 inline-block text-sm font-semibold text-primary">Open Review →</Link>
        </Card>
      </div>

      <SectionTitle>Recent results</SectionTitle>
      {recent.length ? (
        <Card className="divide-y divide-line">
          {recent.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{subjects.find((s) => s.id === a.subjectId)?.shortName} · {topics.find((t) => t.id === a.topicId)?.title ?? 'Mixed'} <span className="text-muted">· {fmtShort(a.date)}</span></span>
              <span className={cx('font-semibold', pct(a) < 50 ? 'text-red' : pct(a) >= 70 ? 'text-green' : 'text-amber')}>{pct(a)}%</span>
            </div>
          ))}
        </Card>
      ) : <p className="text-sm text-muted">Not enough assessment data yet. Results recorded after marked practice appear here.</p>}
    </div>
  );
}
