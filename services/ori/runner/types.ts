import type { Tier } from '../evals/lib/suite';

export type TrialRecord = {
  pass: boolean;
  /** Provider or infrastructure failure: not a model failure, never counted as one. */
  error?: string;
  score: number;
  latencyMs: number;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
  /** Names of the metrics (graders) that failed, e.g. `trajectory`, `judge`. */
  failedMetrics: string[];
  reason?: string;
};

export type CaseRecord = {
  id: string;
  category: string;
  trials: TrialRecord[];
  /** Mean pass rate across trials (pass@1 estimate). */
  passRate: number;
  /** True only when every trial passed (pass^k, the reliability measure). */
  passAll: boolean;
  errored: boolean;
};

export type SuiteSummary = {
  cases: number;
  trials: number;
  passRate: number;
  passAllRate: number;
  errors: number;
  meanScore: number;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  byCategory: Record<string, { cases: number; passRate: number }>;
};

export type SuiteRecord = {
  suite: string;
  tier: Tier;
  datasetHash: string;
  promptHash: string;
  targetModel: string;
  judgeModel: string;
  trialsPerCase: number;
  limited: boolean;
  summary: SuiteSummary;
  cases: CaseRecord[];
};

export type RunManifest = {
  runId: string;
  startedAt: string;
  gitSha: string;
  promptfooVersion: string;
  node: string;
  suites: SuiteRecord[];
};
