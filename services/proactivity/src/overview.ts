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

export type ProactivityOverview = {
  goals: ProactivityGoalView[];
  finance: ProactivityFinanceSummary | null;
  career: ProactivityCareerSummary | null;
  lastRun: EvaluationRun | null;
};
