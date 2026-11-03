/**
 * Evidence-based topic mastery. Mastery is DERIVED from assessment attempts,
 * never stored as a manual toggle, so it can't contradict the evidence.
 *
 * Rules (thresholds in MASTERY):
 * - No attempts → unassessed (a self-rating may be shown, labelled as such).
 * - Latest attempt < 50% → Needs practice (red).
 * - Look only at evidence after the most recent < 50% result.
 *   - Latest independent attempt < 70% → Developing (amber).
 *   - One independent, unseen ≥ 70% result → Developing, "provisional";
 *     a retention check is due 7+ days later.
 *   - Two independent, unseen ≥ 70% results at least 7 days apart → Secure
 *     (green), retention confirmed.
 * - Assisted work can show Developing but can never by itself reach Secure.
 */
import type { AssessmentAttempt, ISODate, MasteryState } from '@/types';
import { addDays, diffDays } from '@/utils/dates';

export const MASTERY = { repairBelow: 50, passAt: 70, retentionGapDays: 7, secureReviewDays: 21, developingReviewDays: 7 };

export const MASTERY_LABEL: Record<MasteryState, string> = {
  unassessed: 'Not assessed',
  red: 'Needs practice',
  amber: 'Developing',
  green: 'Secure'
};

export const pct = (a: Pick<AssessmentAttempt, 'marksEarned' | 'marksAvailable'>) =>
  a.marksAvailable > 0 ? Math.round((a.marksEarned / a.marksAvailable) * 100) : 0;

export interface MasteryResult {
  state: MasteryState;
  provisional: boolean;
  retentionConfirmed: boolean;
  lastIndependent: AssessmentAttempt | null;
  nextReviewDate: ISODate | null;
  misconception: boolean;
  explanation: string;
  attempts: AssessmentAttempt[];
}

const byTime = (a: AssessmentAttempt, b: AssessmentAttempt) =>
  a.date === b.date ? (a.completedAt < b.completedAt ? -1 : 1) : a.date < b.date ? -1 : 1;

export function computeMastery(attemptsForTopic: AssessmentAttempt[]): MasteryResult {
  const attempts = [...attemptsForTopic].sort(byTime);
  const base = { attempts, misconception: false, lastIndependent: null, provisional: false, retentionConfirmed: false, nextReviewDate: null };
  if (!attempts.length) return { ...base, state: 'unassessed', explanation: 'No assessment evidence yet.' };

  const latest = attempts[attempts.length - 1];
  const independent = attempts.filter((a) => a.assistanceUsed === 'none');
  const lastIndependent = independent.at(-1) ?? null;
  const misconception = attempts.some((a) => a.confidence === 'confident' && pct(a) < MASTERY.repairBelow);

  if (pct(latest) < MASTERY.repairBelow) {
    return { ...base, lastIndependent, misconception, state: 'red', explanation: `Latest score ${pct(latest)}% is below ${MASTERY.repairBelow}%.` };
  }

  let resetIdx = -1;
  attempts.forEach((a, i) => {
    if (pct(a) < MASTERY.repairBelow) resetIdx = i;
  });
  const tail = attempts.slice(resetIdx + 1);
  const tailIndependent = tail.filter((a) => a.assistanceUsed === 'none');
  const lastTailIndep = tailIndependent.at(-1);

  if (lastTailIndep && pct(lastTailIndep) < MASTERY.passAt) {
    return {
      ...base, lastIndependent, misconception, state: 'amber',
      nextReviewDate: addDays(lastTailIndep.date, MASTERY.developingReviewDays),
      explanation: `Latest independent score ${pct(lastTailIndep)}% — aim for ${MASTERY.passAt}%+ on unseen questions.`
    };
  }

  const passes = tail.filter((a) => a.assistanceUsed === 'none' && a.unseen && pct(a) >= MASTERY.passAt);
  if (passes.length >= 2) {
    const first = passes[0];
    const confirming = passes.find((p) => diffDays(first.date, p.date) >= MASTERY.retentionGapDays);
    if (confirming) {
      const last = passes.at(-1)!;
      return {
        ...base, lastIndependent, misconception, state: 'green', retentionConfirmed: true,
        nextReviewDate: addDays(last.date, MASTERY.secureReviewDays),
        explanation: `Two independent unseen results of ${MASTERY.passAt}%+ at least ${MASTERY.retentionGapDays} days apart.`
      };
    }
  }
  if (passes.length >= 1) {
    const first = passes[0];
    return {
      ...base, lastIndependent, misconception, state: 'amber', provisional: true,
      nextReviewDate: addDays(first.date, MASTERY.retentionGapDays),
      explanation: `Strong independent result (${pct(first)}%). A retention check ${MASTERY.retentionGapDays}+ days later confirms it.`
    };
  }
  const assistedOnly = !tailIndependent.length;
  return {
    ...base, lastIndependent, misconception, state: 'amber',
    nextReviewDate: addDays(latest.date, MASTERY.developingReviewDays),
    explanation: assistedOnly
      ? 'Scores so far used help or seen questions. An independent unseen attempt is needed to progress.'
      : `Progressing — needs an unseen independent ${MASTERY.passAt}%+ result.`
  };
}

export function masteryMap(topicIds: string[], attempts: AssessmentAttempt[]): Record<string, MasteryState> {
  const out: Record<string, MasteryState> = {};
  for (const id of topicIds) out[id] = computeMastery(attempts.filter((a) => a.topicId === id)).state;
  return out;
}
