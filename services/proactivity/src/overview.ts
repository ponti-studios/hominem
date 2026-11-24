import type { AccountFlow, CategorySpend, MonthlyFlow } from './finance-facts.js';
import type { EvaluationRun } from './types.js';

/**
 * The shape the app's proactivity overview returns. Lives here so the RPC
 * client can name it through the package boundary (an api-local alias is not
 * portable across the HonoClient declaration).
 */
export type ProactivityGoalView = {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'achieved';
  domains: string[];
  description: string | null;
  targetAt: string | null;
};

export type ProactivityFinanceSummary = {
  months: MonthlyFlow[];
  categories: CategorySpend[];
  incomeEvents: { date: string; source: string; amount: number }[];
  recentFlows: AccountFlow[];
  openAccountsByType: { accountType: string; accounts: number }[];
  generatedAt: string;
};

export type ProactivityCareerSummary = {
  lastApplicationDate: string | null;
  totalApplications: number;
  applicationsLast120Days: number;
};

/** A real charge from the current month, offered as prepared reading. */
export type ProactivityPreparedCharge = {
  merchant: string;
  amount: number;
  charges: number;
};

export type ProactivityActionKind = 'task.create' | 'goal.pause' | 'finding.snooze';

/** What the person approved, as the app needs to render it. */
export type ProactivityActionView = {
  id: string;
  triggerId: string;
  goalId: string;
  kind: ProactivityActionKind;
  status: 'applied' | 'undone';
  taskId: string | null;
  until: string | null;
  appliedAt: string;
  undoneAt: string | null;
};

export type ProactivityOverview = {
  goals: ProactivityGoalView[];
  finance: ProactivityFinanceSummary | null;
  career: ProactivityCareerSummary | null;
  lastRun: EvaluationRun | null;
  actions: ProactivityActionView[];
  preparedCharges: ProactivityPreparedCharge[];
};
