import type { MasteryState } from '@/types';
import { cx } from '@/components/ui';

const ORDER: { k: MasteryState; color: string; label: string }[] = [
  { k: 'green', color: 'rgb(var(--green))', label: 'Secure' },
  { k: 'amber', color: 'rgb(var(--amber))', label: 'Developing' },
  { k: 'red', color: 'rgb(var(--red))', label: 'Needs practice' },
  { k: 'unassessed', color: 'rgb(var(--line))', label: 'Not assessed' }
];

export function MasteryStack({ counts, className, legend }: { counts: Record<MasteryState, number>; className?: string; legend?: boolean }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return null;
  return (
    <div className={className}>
      <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={ORDER.map((o) => `${counts[o.k]} ${o.label}`).join(', ')}>
        {ORDER.filter((o) => counts[o.k]).map((o) => (
          <span key={o.k} style={{ width: `${(counts[o.k] / total) * 100}%`, background: o.color }} className="h-full" />
        ))}
      </div>
      {legend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
          {ORDER.map((o) => (
            <span key={o.k} className={cx('inline-flex items-center gap-1.5', !counts[o.k] && 'opacity-50')}>
              <span className="h-2 w-2 rounded-full" style={{ background: o.color }} /> {counts[o.k]} {o.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
