import { Link } from 'react-router-dom';
import { ChevronRight, Clock, RotateCcw } from 'lucide-react';
import { MODE_LABEL, SUBJECT_STYLE, TEMPLATE_BY_ID } from '@/data/catalog';
import { sessionProgress } from '@/domain/progress';
import type { ISODate, StudySession, Subject, Topic } from '@/types';
import { fmtMinutes, fmtShort } from '@/utils/dates';
import { Bar, Chip, SubjectGlyph, SubjectTag, cx } from './ui';

export function sessionTitle(s: StudySession, topics: Topic[]): string {
  if (s.source === 'homemock' && s.mockPaper) return `Home mock · ${s.mockPaper.label.replace(/\s*\(.*\)\s*$/, '')}`;
  if (s.source === 'homemock-mark') return 'Mark home mock';
  const t = s.topicIds.map((id) => topics.find((x) => x.id === id)?.title).filter(Boolean);
  if (t.length) return t.join(' + ');
  const tpl = TEMPLATE_BY_ID[s.templateId];
  if (tpl.purpose === 'exam') return tpl.name;
  if (s.source === 'repair') return 'Repair session';
  return `${tpl.name} · topic to choose`;
}

export function statusInfo(s: StudySession, today: ISODate): { label: string; tone: 'neutral' | 'primary' | 'red' | 'amber' | 'green' } {
  switch (s.status) {
    case 'completed':
      return { label: s.mode && s.mode !== 'full' ? `Completed · ${MODE_LABEL[s.mode]}` : 'Completed', tone: 'green' };
    case 'in_progress':
      return { label: 'In progress', tone: 'primary' };
    case 'partial':
      return { label: 'Partly done', tone: 'amber' };
    case 'missed':
      return { label: 'Not attempted', tone: 'neutral' };
    case 'skipped':
      return { label: 'Skipped', tone: 'neutral' };
    case 'converted':
      return { label: 'Replaced by quick check', tone: 'neutral' };
    case 'consolidated':
      return { label: 'Combined', tone: 'neutral' };
    default:
      if (s.moves.length) return { label: 'Rescheduled', tone: 'amber' };
      return s.date === today ? { label: 'Ready', tone: 'primary' } : s.date < today ? { label: 'Not attempted', tone: 'neutral' } : { label: 'Upcoming', tone: 'neutral' };
  }
}

export function SessionCard({ s, subject, topics, today, compact, onEdit, highlight }: { s: StudySession; subject?: Subject; topics: Topic[]; today: ISODate; compact?: boolean; onEdit?: () => void; highlight?: boolean }) {
  const st = statusInfo(s, today);
  const p = sessionProgress(s);
  const tpl = TEMPLATE_BY_ID[s.templateId];
  const done = s.status === 'completed';
  const body = (
    <div className={cx('flex items-start gap-3.5', done && 'opacity-70')}>
      <SubjectGlyph id={s.subjectId} size={compact ? 36 : 44} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SubjectTag id={s.subjectId} name={subject?.name ?? s.subjectId} />
          {s.source === 'repair' && <Chip tone="amber">Repair</Chip>}
          {(s.source === 'retest' || s.source === 'review') && <Chip tone="primary">Retest</Chip>}
          {s.source === 'followup' && <Chip>Follow-up</Chip>}
          {s.source === 'homemock' && <Chip tone="primary">Mock</Chip>}
        </div>
        <p className={cx('mt-1 font-semibold leading-snug', compact ? 'text-[15px]' : 'text-[17px]')} lang="und">{sessionTitle(s, topics)}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1"><Clock size={13} /> {fmtMinutes(s.plannedMinutes)}</span>
          {tpl.purpose !== 'exam' && !compact && <span>{tpl.name}</span>}
          {s.moves.length > 0 && s.status !== 'completed' && (
            <span className="inline-flex items-center gap-1"><RotateCcw size={12} /> from {fmtShort(s.originalDate)}</span>
          )}
        </div>
        {s.status === 'in_progress' && <Bar value={p} className="mt-2.5" color={SUBJECT_STYLE[s.subjectId].accent} />}
      </div>
      <div className="flex flex-col items-end gap-2">
        <Chip tone={st.tone}>{st.label}</Chip>
      </div>
    </div>
  );
  return (
    <div className={cx('rounded-2xl border bg-surface p-4 shadow-card transition', highlight ? 'border-primary/40 ring-1 ring-primary/20' : 'border-line/60')}>
      {onEdit ? (
        <button onClick={onEdit} className="block w-full text-left" aria-label={`Edit ${subject?.name} session`}>
          {body}
        </button>
      ) : (
        <Link to={`/session/${s.id}`} className="block">
          {body}
        </Link>
      )}
    </div>
  );
}

export function SessionRow({ s, subject, topics, today, onClick }: { s: StudySession; subject?: Subject; topics: Topic[]; today: ISODate; onClick?: () => void }) {
  const st = statusInfo(s, today);
  const inner = (
    <>
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: SUBJECT_STYLE[s.subjectId].accent }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold" style={{ color: SUBJECT_STYLE[s.subjectId].ink }}>{subject?.shortName ?? s.subjectId}</span>
        <span className="block truncate text-[15px]">{sessionTitle(s, topics)}</span>
      </span>
      <span className="text-right text-[12px] text-muted">
        <span className="block">{fmtMinutes(s.plannedMinutes)}</span>
        <span className={cx('block font-semibold', st.tone === 'green' && 'text-green', st.tone === 'amber' && 'text-amber', st.tone === 'primary' && 'text-primary')}>{st.label}</span>
      </span>
      <ChevronRight size={16} className="text-muted" />
    </>
  );
  const cls = 'flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-sunken min-h-[52px]';
  return onClick ? <button className={cls} onClick={onClick}>{inner}</button> : <Link className={cls} to={`/session/${s.id}`}>{inner}</Link>;
}
