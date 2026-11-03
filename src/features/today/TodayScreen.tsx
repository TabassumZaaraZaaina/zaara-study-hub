import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BedDouble, CalendarRange, ChevronDown, ClipboardCheck, Info, Play, Sparkles, X } from 'lucide-react';
import { useConfig, useExams, useNotices, useProfile, useRepairs, useSessions, useSettings, useSubjectMap, useToday, useTopics } from '@/hooks/data';
import { dayStats } from '@/domain/progress';
import { TEMPLATE_BY_ID } from '@/data/catalog';
import { SessionCard, SessionRow, sessionTitle } from '@/components/session';
import { Button, Card, Chip, ProgressRing, SectionTitle, Sheet, SubjectGlyph, SubjectTag, cx } from '@/components/ui';
import { CarryQueue } from '@/features/review/CarryQueue';
import { dismissNotice } from '@/services/meta';
import { takeRestDay } from '@/services/plan';
import { nextMilestone } from '@/features/exams/countdown';
import { addDays, fmtLong, fmtMinutes, greeting } from '@/utils/dates';

export function TodayScreen() {
  const today = useToday();
  const profile = useProfile();
  const sessions = useSessions();
  const subjects = useSubjectMap();
  const topics = useTopics();
  const exams = useExams();
  const repairs = useRepairs();
  const notices = useNotices();
  const config = useConfig();
  const settings = useSettings();
  const nav = useNavigate();
  const [showRest, setShowRest] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [restMsg, setRestMsg] = useState<string | null>(null);

  const todays = useMemo(
    () => (sessions ?? []).filter((s) => s.date === today && !['converted', 'consolidated'].includes(s.status)).sort((a, b) => a.order - b.order),
    [sessions, today]
  );
  const stats = dayStats(sessions ?? [], today);
  const next = todays.find((s) => s.status === 'in_progress') ?? todays.find((s) => s.status === 'planned');
  const others = todays.filter((s) => s !== next);
  const milestone = nextMilestone(today, exams, subjects);
  const examSoon = exams.filter((e) => e.date && (e.date === today || e.date === addDays(today, 1))).sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const toDiagnose = repairs.filter((r) => r.status === 'diagnose');
  const todaysNotices = notices.filter((n) => n.date === today).slice(0, 3);
  const mockMissing = exams.filter((e) => e.group === 'mock2' && e.date).length === 0;

  if (!sessions || !profile) return null;
  const allDone = todays.length > 0 && !next;

  return (
    <div className="animate-rise">
      <header className="pt-3">
        <p className="text-sm font-semibold tracking-[0.18em] text-muted lg:hidden">ZAARA</p>
        <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">
          {greeting()}, {profile.displayName}
        </h1>
        <p className="mt-1 text-muted">{fmtLong(today)}</p>
        {milestone && (
          <Link to="/exams" className="mt-3 inline-flex min-h-[36px] items-center gap-2 rounded-full bg-primary-soft px-3.5 text-sm font-semibold text-primary">
            <CalendarRange size={15} /> {milestone.text}
          </Link>
        )}
      </header>

      {examSoon.length > 0 && (
        <Card className="mt-5 border-primary/30 bg-primary-soft/50 p-4">
          {examSoon.map((e) => (
            <p key={e.id} className="font-semibold">
              {subjects[e.subjectId]?.name} {e.paper} {e.date === today ? 'today' : 'tomorrow'}
              {e.startTime ? ` at ${e.startTime}` : ''}
            </p>
          ))}
          <p className="mt-1 text-sm text-muted">Today’s focus: light recall, your weak topics and a short timed practice. Keep the evening calm and sleep well.</p>
        </Card>
      )}

      {todaysNotices.map((n) => (
        <div key={n.id} role="status" className="mt-3 flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 text-sm shadow-card">
          <Info size={17} className="mt-0.5 shrink-0 text-primary" />
          <p className="flex-1">{n.text}</p>
          <button aria-label="Dismiss" onClick={() => dismissNotice(n.id)} className="-m-2 p-2 text-muted"><X size={16} /></button>
        </div>
      ))}

      <Card className="mt-5 flex items-center gap-4 p-4">
        <ProgressRing value={stats.planned ? stats.completed / stats.planned : 0} label={`${stats.completed}/${stats.planned}`} />
        <div className="min-w-0">
          <p className="font-semibold">
            {stats.planned === 0 ? 'Nothing planned today' : allDone ? 'Today’s plan is done' : `${stats.completed} of ${stats.planned} sessions completed`}
          </p>
          <p className="text-sm text-muted">
            {stats.planned === 0 ? 'A free day — rest counts too.' : `${fmtMinutes(stats.plannedMinutes)} planned${config.provisional ? ' · provisional plan' : ''}`}
          </p>
        </div>
      </Card>

      {next && (
        <>
          <SectionTitle>{next.status === 'in_progress' ? 'Continue' : 'Up next'}</SectionTitle>
          <Card className="overflow-hidden p-0">
            <div className="p-5">
              <div className="flex items-start gap-4">
                <SubjectGlyph id={next.subjectId} size={52} />
                <div className="min-w-0">
                  <SubjectTag id={next.subjectId} name={subjects[next.subjectId]?.name ?? ''} />
                  <p className="mt-1 text-xl font-semibold leading-snug" lang="und">{sessionTitle(next, topics)}</p>
                  <p className="mt-1 text-sm text-muted">
                    {TEMPLATE_BY_ID[next.templateId].name} · {fmtMinutes(next.plannedMinutes)}
                  </p>
                </div>
              </div>
              {next.reason && <p className="mt-3 text-[13px] text-muted">{next.reason}</p>}
              <Button size="lg" className="mt-4 w-full" onClick={() => nav(`/session/${next.id}`)}>
                <Play size={18} /> {next.status === 'in_progress' ? 'Continue session' : 'Start session'}
              </Button>
            </div>
          </Card>
        </>
      )}

      {allDone && (
        <Card className="mt-5 p-5 text-center">
          <Sparkles className="mx-auto text-primary" />
          <p className="mt-2 font-semibold">All of today’s sessions are done.</p>
          <p className="mt-1 text-sm text-muted">Use the rest of the day however you like. Tomorrow’s plan will be ready.</p>
        </Card>
      )}

      {others.length > 0 && (
        <>
          <SectionTitle
            action={
              <button onClick={() => setExpanded((e) => !e)} className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-primary" aria-expanded={expanded}>
                {expanded ? 'Less' : 'Show all'} <ChevronDown size={16} className={cx('transition', expanded && 'rotate-180')} />
              </button>
            }
          >
            Rest of today
          </SectionTitle>
          {expanded ? (
            <div className="space-y-3">{others.map((s) => <SessionCard key={s.id} s={s} subject={subjects[s.subjectId]} topics={topics} today={today} />)}</div>
          ) : (
            <Card className="p-2">{others.map((s) => <SessionRow key={s.id} s={s} subject={subjects[s.subjectId]} topics={topics} today={today} />)}</Card>
          )}
        </>
      )}

      <div className="mt-5 space-y-3">
        <CarryQueue today={today} limit={3} />
        {toDiagnose.map((r) => (
          <Link key={r.id} to={`/repair/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-line/60 bg-surface p-4 shadow-card">
            <SubjectGlyph id={r.subjectId} size={36} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">This idea needs a different approach</p>
              <p className="text-sm text-muted">{subjects[r.subjectId]?.name}{r.topicId ? ` · ${topics.find((t) => t.id === r.topicId)?.title ?? ''}` : ''} — let’s find what was difficult.</p>
            </div>
            <ArrowRight size={18} className="text-muted" />
          </Link>
        ))}
        {settings.reminders.enabled && settings.reminders.examCountdown && mockMissing && (
          <Link to="/exams" className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-4 text-sm">
            <CalendarRange size={18} className="text-primary" />
            <span className="flex-1">Got your Mock 2 timetable? Add the paper dates and the plan will focus on each exam as it gets close.</span>
            <ArrowRight size={16} className="text-muted" />
          </Link>
        )}
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => nav('/assess')}><ClipboardCheck size={17} /> Record a result</Button>
        <Button variant="secondary" onClick={() => setShowRest(true)} disabled={!todays.some((s) => s.status === 'planned')}><BedDouble size={17} /> Rest day</Button>
      </div>
      {restMsg && <p role="status" className="mt-3 text-center text-sm text-muted">{restMsg}</p>}

      <Sheet open={showRest} onClose={() => setShowRest(false)} title="Take a rest day">
        <p className="text-muted">Rest is part of a good plan. Today’s sessions that haven’t started will be moved to the coming days where there’s room. Nothing is marked as done, and nothing counts against you.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {todays.filter((s) => s.status === 'planned').map((s) => (
            <Chip key={s.id}>{subjects[s.subjectId]?.shortName} · {fmtMinutes(s.plannedMinutes)}</Chip>
          ))}
        </div>
        <Button className="mt-5 w-full" onClick={async () => {
          const r = await takeRestDay(today);
          setShowRest(false);
          setRestMsg(r.moved === r.total ? 'Enjoy your rest. Today’s sessions have been moved.' : `Enjoy your rest. ${r.moved} of ${r.total} sessions were moved; the rest will wait in Unfinished work.`);
        }}>Rest today</Button>
      </Sheet>
    </div>
  );
}

