/** Evidence-based "wins". Every message is derived from recorded results — nothing is invented. */
import type { AssessmentAttempt, ISODate, MasteryState, RepairTask, Topic } from '@/types';
import { addDays } from '@/utils/dates';
import { MASTERY_LABEL, computeMastery, pct } from './mastery';

const RANK: Record<MasteryState, number> = { unassessed: 0, red: 1, amber: 2, green: 3 };

export function masteryAsOf(topicId: string, attempts: AssessmentAttempt[], date: ISODate) {
  return computeMastery(attempts.filter((a) => a.topicId === topicId && a.date <= date));
}

export function wins(today: ISODate, topics: Topic[], attempts: AssessmentAttempt[], repairs: RepairTask[]): string[] {
  const out: string[] = [];
  const weekAgo = addDays(today, -7);
  const then = addDays(today, -14);
  for (const t of topics) {
    const before = masteryAsOf(t.id, attempts, then).state;
    const now = computeMastery(attempts.filter((a) => a.topicId === t.id));
    if (before !== 'unassessed' && RANK[now.state] > RANK[before]) out.push(`${t.title} moved from ${MASTERY_LABEL[before]} to ${MASTERY_LABEL[now.state]}.`);
    const lastPass = now.attempts.filter((a) => a.assistanceUsed === 'none' && a.unseen && pct(a) >= 70).at(-1);
    if (now.retentionConfirmed && lastPass && lastPass.date >= then) out.push(`You remembered ${t.title} from earlier — retention confirmed.`);
  }
  const strong = attempts.filter((a) => a.date > weekAgo && a.assistanceUsed === 'none' && a.unseen && pct(a) >= 70);
  if (strong.length >= 2) out.push(`${strong.length} results of 70%+ done independently on unseen questions this week.`);
  for (const r of repairs) {
    if (r.status !== 'closed' || !r.closedAt || r.closedAt.slice(0, 10) < weekAgo) continue;
    const rt = attempts.find((a) => a.id === r.retestAttemptId);
    const t = topics.find((x) => x.id === r.topicId);
    if (rt && pct(rt) >= 50) out.push(`Repair worked${t ? ` for ${t.title}` : ''}: retest ${pct(rt)}%.`);
  }
  return out.slice(0, 5);
}
