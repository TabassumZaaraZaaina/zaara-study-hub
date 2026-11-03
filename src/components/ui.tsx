import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SUBJECT_STYLE } from '@/data/catalog';
import { MASTERY_LABEL } from '@/domain/mastery';
import type { MasteryState, SubjectId } from '@/types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger';
export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<Variant, string> = {
    primary: 'bg-primary text-on-primary hover:brightness-105 active:brightness-95 shadow-sm',
    secondary: 'bg-surface text-ink border border-line hover:bg-sunken',
    ghost: 'text-ink hover:bg-sunken',
    soft: 'bg-primary-soft text-primary hover:brightness-[0.98]',
    danger: 'bg-red-soft text-red hover:brightness-[0.98]'
  };
  const s = { sm: 'min-h-[40px] px-3.5 text-sm', md: 'min-h-[46px] px-4 text-[15px]', lg: 'min-h-[54px] px-5 text-base' }[size];
  return (
    <button
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-45 disabled:pointer-events-none', v[variant], s, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ children, className, as: As = 'div', ...rest }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'li' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cx('rounded-2xl bg-surface shadow-card border border-line/60', className)} {...rest}>
      {children}
    </As>
  );
}

export function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: ReactNode; action?: ReactNode; back?: string }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3 pt-2">
      <div className="min-w-0">
        {back && (
          <Link to={back} className="mb-2 inline-flex min-h-[36px] items-center text-sm font-medium text-muted hover:text-ink">
            ← Back
          </Link>
        )}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-[15px] text-muted">{subtitle}</div>}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function SubjectGlyph({ id, size = 40 }: { id: SubjectId; size?: number }) {
  const st = SUBJECT_STYLE[id];
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-xl font-semibold"
      style={{ width: size, height: size, background: st.soft, color: st.ink, fontSize: size * 0.45 }}
    >
      {st.glyph}
    </span>
  );
}

export function SubjectTag({ id, name }: { id: SubjectId; name: string }) {
  const st = SUBJECT_STYLE[id];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: st.ink }}>
      <span className="h-2 w-2 rounded-full" style={{ background: st.accent }} />
      {name}
    </span>
  );
}

const M_STYLE: Record<MasteryState, string> = {
  unassessed: 'bg-sunken text-muted',
  red: 'bg-red-soft text-red',
  amber: 'bg-amber-soft text-amber',
  green: 'bg-green-soft text-green'
};
export function MasteryPill({ state, provisional }: { state: MasteryState; provisional?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold', M_STYLE[state])}>
      {MASTERY_LABEL[state]}
      {provisional && <span className="font-normal opacity-80">· confirming</span>}
    </span>
  );
}

export function Chip({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'red' | 'amber' | 'green'; className?: string }) {
  const t = { neutral: 'bg-sunken text-muted', primary: 'bg-primary-soft text-primary', red: 'bg-red-soft text-red', amber: 'bg-amber-soft text-amber', green: 'bg-green-soft text-green' }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold', t, className)}>{children}</span>;
}

export function ProgressRing({ value, size = 64, stroke = 7, label }: { value: number; size?: number; stroke?: number; label?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--primary))" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      {label && <span className="absolute text-sm font-semibold">{label}</span>}
    </div>
  );
}

export function Bar({ value, color = 'rgb(var(--primary))', className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-sunken', className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('min-h-[40px] flex-1 rounded-lg px-2 text-sm font-semibold transition', value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Accessible bottom sheet (dialog) — full-width on phones, centred on desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="animate-sheet relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-safe shadow-lift sm:max-w-lg sm:rounded-3xl sm:pb-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={id} className="text-lg font-semibold">{title}</h2>
          <button data-close onClick={onClose} aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-sunken">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-5 py-8 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[13px] text-muted">{hint}</span>}
    </label>
  );
}

export function Stepper({ value, onChange, step = 15, min = 0, max = 600, format }: { value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; format?: (n: number) => string }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-surface">
      <button aria-label="Decrease" className="h-11 w-11 text-lg text-muted hover:text-ink disabled:opacity-30" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span className="min-w-[70px] text-center text-[15px] font-semibold tabular-nums">{format ? format(value) : value}</span>
      <button aria-label="Increase" className="h-11 w-11 text-lg text-muted hover:text-ink disabled:opacity-30" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}

export function Sparkline({ values, height = 44 }: { values: number[]; height?: number }) {
  if (values.length < 2) return null;
  const w = 100;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - (v / 100) * (height - 6) - 3]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const y50 = height - 0.5 * (height - 6) - 3;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-12 w-full" role="img" aria-label={`Scores: ${values.join('%, ')}%`}>
      <line x1="0" x2={w} y1={y50} y2={y50} stroke="rgb(var(--line))" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke="rgb(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.2" fill="rgb(var(--primary))" />
      ))}
    </svg>
  );
}
