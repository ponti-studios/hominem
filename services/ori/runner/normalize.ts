import type { Tier } from '../evals/lib/suite';
import type { CaseRecord, SuiteSummary, TrialRecord } from './types';

/** The few fields we read off a promptfoo result row. Loosely typed on purpose. */
export type RawResult = {
  success?: boolean;
  /** promptfoo: 0 none, 1 assertion failed, 2 provider/infrastructure error. */
  failureReason?: number;
  score?: number;
  error?: string | null;
  latencyMs?: number;
  cost?: number;
  testCase?: { description?: string; metadata?: Record<string, unknown> };
  response?: {
    error?: string;
    cost?: number;
    tokenUsage?: { prompt?: number; completion?: number };
  } | null;
  gradingResult?: {
    reason?: string;
    componentResults?: Array<{
      pass?: boolean;
      reason?: string;
      assertion?: { metric?: string; type?: string } | null;
    }>;
  } | null;
};

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const percentile = (values: readonly number[], fraction: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
};

const round = (value: number, places = 4): number => Number(value.toFixed(places));

export function toTrial(raw: RawResult): TrialRecord {
  const error =
    raw.response?.error ?? (raw.failureReason === 2 ? (raw.error ?? 'provider error') : undefined);
  const failed = (raw.gradingResult?.componentResults ?? []).filter((component) => !component.pass);
  return {
    pass: Boolean(raw.success) && !error,
    ...(error ? { error: String(error).slice(0, 500) } : {}),
    score: raw.score ?? 0,
    latencyMs: raw.latencyMs ?? 0,
    costUsd: raw.cost ?? raw.response?.cost ?? 0,
    promptTokens: raw.response?.tokenUsage?.prompt ?? 0,
    completionTokens: raw.response?.tokenUsage?.completion ?? 0,
    failedMetrics: failed.map(
      (component) => component.assertion?.metric ?? component.assertion?.type ?? 'assertion',
    ),
    ...(failed[0]?.reason || raw.gradingResult?.reason
      ? { reason: String(failed[0]?.reason ?? raw.gradingResult?.reason).slice(0, 500) }
      : {}),
  };
}

/** Group trial rows by case description, keeping dataset order. */
export function toCases(rows: readonly RawResult[], expectedIds: readonly string[]): CaseRecord[] {
  const byId = new Map<string, RawResult[]>();
  for (const id of expectedIds) byId.set(id, []);
  for (const row of rows) {
    const id = row.testCase?.description ?? 'unnamed';
    byId.set(id, [...(byId.get(id) ?? []), row]);
  }
  return [...byId.entries()].map(([id, group]) => {
    const trials = group.map(toTrial);
    const graded = trials.filter((trial) => !trial.error);
    return {
      id,
      category: String(group[0]?.testCase?.metadata?.category ?? 'uncategorized'),
      trials,
      passRate: round(mean(graded.map((trial) => (trial.pass ? 1 : 0)))),
      passAll: graded.length > 0 && graded.length === trials.length && graded.every((t) => t.pass),
      errored: trials.length === 0 || trials.some((trial) => trial.error),
    };
  });
}

export function summarize(cases: readonly CaseRecord[]): SuiteSummary {
  const trials = cases.flatMap((entry) => entry.trials);
  const graded = trials.filter((trial) => !trial.error);
  const categories = new Map<string, CaseRecord[]>();
  for (const entry of cases)
    categories.set(entry.category, [...(categories.get(entry.category) ?? []), entry]);
  return {
    cases: cases.length,
    trials: trials.length,
    passRate: round(mean(graded.map((trial) => (trial.pass ? 1 : 0)))),
    passAllRate: round(mean(cases.map((entry) => (entry.passAll ? 1 : 0)))),
    errors: trials.length - graded.length,
    meanScore: round(mean(graded.map((trial) => trial.score))),
    costUsd: round(
      trials.reduce((sum, trial) => sum + trial.costUsd, 0),
      6,
    ),
    promptTokens: trials.reduce((sum, trial) => sum + trial.promptTokens, 0),
    completionTokens: trials.reduce((sum, trial) => sum + trial.completionTokens, 0),
    latencyP50Ms: Math.round(
      percentile(
        trials.map((trial) => trial.latencyMs),
        0.5,
      ),
    ),
    latencyP95Ms: Math.round(
      percentile(
        trials.map((trial) => trial.latencyMs),
        0.95,
      ),
    ),
    byCategory: Object.fromEntries(
      [...categories.entries()].map(([category, group]) => [
        category,
        {
          cases: group.length,
          passRate: round(mean(group.map((entry) => entry.passRate))),
        },
      ]),
    ),
  };
}

export type { Tier };
