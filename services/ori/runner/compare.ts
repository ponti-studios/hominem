import type { Tier } from '../evals/lib/suite';
import type { SuiteRecord } from './types';

/** Allowed drop in suite pass rate before a non-regression tier fails the gate. */
export const TIER_TOLERANCE: Record<Tier, number> = {
  regression: 0,
  capability: 0.1,
  holdout: 0.05,
};

export type Comparison = {
  suite: string;
  /** Why the numbers can or cannot be compared to the baseline. */
  comparable: boolean;
  note?: string;
  passRateDelta?: number;
  /** Cases that passed in the baseline and fail now. */
  regressions: string[];
  /** Cases that failed in the baseline and pass now. */
  fixes: string[];
  /** Cases that failed in both. */
  knownFailures: string[];
  gate: 'pass' | 'fail' | 'skipped';
  gateReason: string;
};

export function compareToBaseline(current: SuiteRecord, baseline?: SuiteRecord): Comparison {
  const base = { suite: current.suite, regressions: [], fixes: [], knownFailures: [] };
  if (!baseline) {
    return {
      ...base,
      comparable: false,
      note: 'no baseline committed yet',
      gate: 'skipped',
      gateReason: 'no baseline',
    };
  }
  const reasons: string[] = [];
  if (baseline.datasetHash !== current.datasetHash) reasons.push('dataset changed');
  if (baseline.promptHash !== current.promptHash) reasons.push('prompt changed');
  if (baseline.graderHash !== current.graderHash) reasons.push('grading logic changed');
  if (baseline.targetModel !== current.targetModel) reasons.push('target model changed');
  if (baseline.judgeModel !== current.judgeModel) reasons.push('judge model changed');
  if (current.limited) reasons.push('partial run (--limit)');
  if (reasons.length > 0) {
    return {
      ...base,
      comparable: false,
      note: reasons.join(', '),
      gate: 'skipped',
      gateReason: `not comparable: ${reasons.join(', ')}`,
    };
  }

  const baseCases = new Map(baseline.cases.map((entry) => [entry.id, entry]));
  const regressions: string[] = [];
  const fixes: string[] = [];
  const knownFailures: string[] = [];
  for (const entry of current.cases) {
    if (entry.errored) continue;
    const before = baseCases.get(entry.id);
    if (!before || before.errored) continue;
    if (before.passRate >= 1 && entry.passRate < 1) regressions.push(entry.id);
    else if (before.passRate < 1 && entry.passRate >= 1) fixes.push(entry.id);
    else if (before.passRate < 1 && entry.passRate < 1) knownFailures.push(entry.id);
  }
  const passRateDelta = Number((current.summary.passRate - baseline.summary.passRate).toFixed(4));
  const tolerance = TIER_TOLERANCE[current.tier];

  let gate: Comparison['gate'] = 'pass';
  let gateReason = `pass rate ${current.summary.passRate} (baseline ${baseline.summary.passRate})`;
  if (current.tier === 'regression' && regressions.length > 0) {
    gate = 'fail';
    gateReason = `${regressions.length} case(s) that passed in the baseline now fail`;
  } else if (passRateDelta < -tolerance) {
    gate = 'fail';
    gateReason = `pass rate dropped ${(-passRateDelta).toFixed(2)} (tolerance ${tolerance})`;
  }
  return {
    ...base,
    comparable: true,
    passRateDelta,
    regressions,
    fixes,
    knownFailures,
    gate,
    gateReason,
  };
}
