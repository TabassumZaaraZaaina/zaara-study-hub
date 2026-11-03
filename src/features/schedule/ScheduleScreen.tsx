import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, RefreshCw, CalendarOff, GraduationCap } from 'lucide-react';
import { SUBJECT_STYLE } from '@/data/catalog';
import { dayCapacity, loadOn } from '@/scheduling/engine';
import { rangeStats } from '@/domain/progress';
import { useConfig, useExams, useSessions, useSubjectMap, useToday, useTopics } from '@/hooks/data';
import { SessionRow } from '@/components/session';
import { Button, Card, Chip, PageHeader, Segmented, cx } from '@/components/ui';
import type { ISODate, StudySession } from '@/types';
import { addDays, addMonths, dateRange, fmtDayMonth, fmtMinutes, fmtMonth, startOfMonth, startOfWeek, weekdayShort } from '@/utils/dates';
import { SessionEditor } from './SessionEditor';
import { AddSessionSheet, RegenerateSheet, UnavailableSheet } from './PlanningSheets';

type View = 'week' | 'month';

export function ScheduleScreen() {
  const today = useToday();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(today);
  const [editing, setEditing] = useState<StudySession | null>(null);
  const [sheet, setSheet] = useState<'add' | 'off' | 'regen' | null>(null);
  const [openDays, setOpenDays] = useState<Set<ISODate>>(new Set([today]));
  const [monthDay, setMonthDay] = useState<ISODate>(today);
  const sessions = useSessions() ?? [];
  const subjects = useSubjectMap();
  const topics = useTopics();
  const exams = useExams();
  const config = useConfig();

  const weekStart = startOfWeek(anchor);
  const days = view === 'week' ? dateRange(weekStart, addDays(weekStart, 6)) : [];
  const visible = (d: ISODate) => sessions.filter((s) => s.date === d && !['converted', 'consolidated'].includes(s.status)).sort((a, b) => a.order - b.order);
  const ws = useMemo(() => rangeStats(sessions, weekStart, addDays(weekStart, 6)), [sessions, weekStart]);
  const toggle = (d: ISODate) => setOpenDays((p) => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });

  return (
    <div className="animate-rise">
      <PageHeader title="Schedule" subtitle={config.provisional ? 'Provisional plan — it sharpens as you add exam dates and topics.' : undefined} />
      <Segmented label="Calendar view" value={view} onChange={setView} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />

      <div className="mt-4 flex items-center justify-between">
        <button aria-label="Previous" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-sunken" onClick={() => setAnchor(view === 'week' ? addDays(anchor, -7) : addMonths(anchor, -1))}><ChevronLeft /></button>
        <div className="text-center">
          <p className="font-semibold">{view === 'week' ? `${fmtDayMonth(weekStart)} – ${fmtDayMonth(addDays(weekStart, 6))}` : fmtMonth(anchor)}</p>
          {anchor !== today && <button className="text-sm font-semibold text-primary" onClick={() => { setAnchor(today); setMonthDay(today); }}>Back to today</button>}
        </div>
        <button aria-label="Next" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-sunken" onClick={() => setAnchor(view === 'week' ? addDays(anchor, 7) : addMonths(anchor, 1))}><ChevronRight /></button>
      </div>

      {view === 'week' && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Card className="p-2.5"><p className="text-lg font-semibold">{ws.completed}<span className="text-sm text-muted">/{ws.planned}</span></p><p className="text-xs text-muted">completed</p></Card>
            <Card className="p-2.5"><p className="text-lg font-semibold">{fmtMinutes(ws.plannedMinutes)}</p><p className="text-xs text-muted">planned</p></Card>
            <Card className="p-2.5"><p className="text-lg font-semibold">{ws.missed + ws.partial}</p><p className="text-xs text-muted">unfinished</p></Card>
          </div>
          <div className="mt-4 space-y-2.5">
            {days.map((d) => {
              const list = visible(d);
              const movedOut = sessions.filter((s) => s.moves.some((m) => m.from === d) && s.date !== d);
              const dayExams = exams.filter((e) => e.date === d);
              const cap = dayCapacity(config, d, exams);
              const load = loadOn(sessions, d);
              const off = config.unavailable.find((u) => d >= u.start && d <= u.end);
              const open = openDays.has(d);
              const done = list.filter((s) => s.status === 'completed').length;
              return (
                <Card key={d} className={cx('overflow-hidden', d === today && 'ring-1 ring-primary/40')}>
                  <button className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left" onClick={() => toggle(d)} aria-expanded={open}>
                    <div className={cx('w-11 text-center', d === today && 'text-primary')}>
                      <p className="text-xs font-semibold uppercase">{weekdayShort(d)}</p>
                      <p className="text-xl font-semibold leading-none">{Number(d.slice(8))}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {list.map((s) => (
                          <span key={s.id} className={cx('h-2.5 w-2.5 rounded-full', s.status === 'completed' ? '' : 'opacity-60')} style={{ background: SUBJECT_STYLE[s.subjectId].accent, outline: s.status === 'completed' ? '2px solid rgb(var(--green))' : undefined, outlineOffset: 1 }} />
                        ))}
                        {dayExams.map((e) => <Chip key={e.id} tone="primary"><GraduationCap size={12} /> {subjects[e.subjectId]?.shortName}</Chip>)}
                        {off && <Chip>{off.label}</Chip>}
                        {!list.length && !off && !dayExams.length && <span className="text-sm text-muted">{d < config.planStart ? 'Before your plan started' : cap === 0 ? 'Rest day' : 'Free'}</span>}
                      </div>
                      <p className="mt-1 text-[13px] text-muted">
                        {list.length ? `${done}/${list.length} done · ${fmtMinutes(load)}` : ''}
                        {load > cap && <span className="ml-1 font-semibold text-amber">· {fmtMinutes(load - cap)} over your available time</span>}
                      </p>
                    </div>
                    <ChevronDown size={18} className={cx('text-muted transition', open && 'rotate-180')} />
                  </button>
                  {open && (
                    <div className="border-t border-line px-2 py-2">
                      {list.map((s) => <SessionRow key={s.id} s={s} subject={subjects[s.subjectId]} topics={topics} today={today} onClick={() => setEditing(s)} />)}
                      {movedOut.map((s) => (
                        <p key={s.id} className="px-3 py-1.5 text-[13px] text-muted">↪ {subjects[s.subjectId]?.shortName} moved to {fmtDayMonth(s.date)}</p>
                      ))}
                      {!list.length && <p className="px-3 py-2 text-sm text-muted">No sessions. {off ? 'Marked unavailable.' : cap === 0 ? 'No study time set for this day.' : ''}</p>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {view === 'month' && <MonthGrid anchor={anchor} today={today} selected={monthDay} onSelect={setMonthDay} sessions={sessions} exams={exams.map((e) => e.date)} />}
      {view === 'month' && (
        <Card className="mt-3 p-2">
          <p className="px-2 pb-1 pt-2 text-sm font-semibold">{fmtDayMonth(monthDay)}</p>
          {visible(monthDay).map((s) => <SessionRow key={s.id} s={s} subject={subjects[s.subjectId]} topics={topics} today={today} onClick={() => setEditing(s)} />)}
          {!visible(monthDay).length && <p className="px-2 pb-2 text-sm text-muted">Nothing planned.</p>}
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button variant="secondary" onClick={() => setSheet('add')}><Plus size={16} /> Add session or test</Button>
        <Button variant="secondary" onClick={() => setSheet('off')}><CalendarOff size={16} /> Unavailable days</Button>
        <Button variant="secondary" onClick={() => setSheet('regen')}><RefreshCw size={16} /> Refresh plan</Button>
      </div>

      <SessionEditor session={editing} onClose={() => setEditing(null)} today={today} />
      <AddSessionSheet open={sheet === 'add'} onClose={() => setSheet(null)} defaultDate={view === 'month' ? monthDay : today} />
      <UnavailableSheet open={sheet === 'off'} onClose={() => setSheet(null)} />
      <RegenerateSheet open={sheet === 'regen'} onClose={() => setSheet(null)} today={today} />
    </div>
  );
}

function MonthGrid({ anchor, today, selected, onSelect, sessions, exams }: { anchor: ISODate; today: ISODate; selected: ISODate; onSelect: (d: ISODate) => void; sessions: StudySession[]; exams: (string | null)[] }) {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const cells = dateRange(gridStart, addDays(gridStart, 41));
  const month = first.slice(0, 7);
  return (
    <Card className="mt-3 p-3">
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-muted">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <span key={i} className="py-1">{x}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const list = sessions.filter((s) => s.date === d && !['converted', 'consolidated'].includes(s.status));
          const inMonth = d.slice(0, 7) === month;
          return (
            <button
              key={d}
              onClick={() => onSelect(d)}
              aria-label={`${d}: ${list.length} sessions`}
              className={cx('flex min-h-[52px] flex-col items-center rounded-xl pt-1.5 text-sm', !inMonth && 'opacity-35', selected === d && 'bg-primary-soft', d === today && 'font-bold text-primary')}
            >
              <span>{Number(d.slice(8))}</span>
              <span className="mt-1 flex flex-wrap justify-center gap-0.5 px-0.5">
                {list.slice(0, 4).map((s) => <span key={s.id} className="h-1.5 w-1.5 rounded-full" style={{ background: SUBJECT_STYLE[s.subjectId].accent, opacity: s.status === 'completed' ? 1 : 0.55 }} />)}
              </span>
              {exams.includes(d) && <span className="mt-0.5 h-1 w-4 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
