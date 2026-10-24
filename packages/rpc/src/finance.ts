// ============================================================================
// Finance — Schemas, Types & Client
// ============================================================================

import type { financeRoutes } from '@hominem/api/finance';
import type { InferResponseType } from 'hono/client';
import { hc } from 'hono/client';

import type { ClientConfig } from './core/api-client';
import type { HonoClient } from './core/api-client';
import { customFetch } from './core/api-client';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type InstitutionData = {
  id: string;
  name: string;
  logo?: string;
};

export type BudgetCategoryData = {
  id: string;
  name: string;
  userId: string;
  type?: 'income' | 'expense';
  color?: string;
  averageMonthlyExpense?: string;
};

export type AccountData = {
  id: string;
  userId: string;
  name: string;
  accountType: string;
  currentBalance: number | null;
};

export type TransactionData = {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  description: string | null;
  postedOn: string;
  merchantName: string | null;
  currencyCode?: string;
};

export type TimeSeriesTrend = {
  raw: string;
  formatted: string;
  direction: 'up' | 'down' | 'flat';
  percentChange?: string;
  previousAmount?: number;
  formattedPreviousAmount?: string;
  percentChangeExpenses?: string;
  rawExpenses?: string;
  previousExpenses?: number;
  formattedPreviousExpenses?: string;
  directionExpenses?: 'up' | 'down';
};

export type TimeSeriesDataPoint = {
  date: string;
  amount: number;
  expenses: number;
  income: number;
  count: number;
  average: number;
  trend?: TimeSeriesTrend;
  formattedAmount?: string;
  formattedIncome?: string;
  formattedExpenses?: string;
};

export type TimeSeriesStats = {
  total: number;
  average: number;
  min: number;
  max: number;
  trend: 'up' | 'down' | 'stable';
  changePercentage: number;
  periodCovered?: string;
  totalIncome?: number;
  totalExpenses?: number;
  averageIncome?: number;
  averageExpenses?: number;
  count?: number;
};

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export type AccountWithTransactions = AccountData & {
  transactions: TransactionData[];
};

export type AccountsAllData = {
  accounts: AccountWithTransactions[];
};

type _AccountListEndpoint = HonoClient['api']['finance']['accounts']['list']['$get'];
export type AccountListOutput = InferResponseType<_AccountListEndpoint, 200>;
export type AccountGetOutput = AccountWithTransactions;
export type AccountCreateOutput = AccountData;
export type AccountUpdateOutput = AccountData;
export type AccountDeleteOutput = { success: true };
export type AccountAllOutput = AccountsAllData;

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export type TransactionUpdateData = {
  accountId?: string;
  amount?: string | number;
  description?: string | null;
  category?: string | null;
  date?: string;
  merchantName?: string | null;
  note?: string | null;
  tags?: string | null;
  excluded?: boolean | null;
  recurring?: boolean | null;
};

type _TransactionListEndpoint = HonoClient['api']['finance']['transactions']['list']['$get'];
export type TransactionListOutput = InferResponseType<_TransactionListEndpoint, 200>;

export type TransactionCreateOutput = TransactionData;
export type TransactionUpdateOutput = TransactionData;
export type TransactionDeleteOutput = { success: boolean; message?: string };

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------

export type InstitutionsListOutput = InstitutionData[];

export type InstitutionCreateOutput = InstitutionData;

// ---------------------------------------------------------------------------
// Categories / Tags
// ---------------------------------------------------------------------------

export type CategoriesListItem = {
  id: string;
  userId: string;
  name: string;
  parentId?: string | null;
  icon?: string | null;
  color?: string | null;
};

export type CategoriesListOutput = CategoriesListItem[];

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type TransactionStats = {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
};

export type SpendingTimeSeriesOutput = {
  data: TimeSeriesDataPoint[];
  stats?: TimeSeriesStats | null;
};

type _FinanceTopMerchantsEndpoint =
  HonoClient['api']['finance']['analyze']['top-merchants']['$get'];
export type TopMerchantsOutput = InferResponseType<_FinanceTopMerchantsEndpoint, 200>;
export type Merchant = TopMerchantsOutput['merchants'][number];

type _FinanceTagBreakdownEndpoint =
  HonoClient['api']['finance']['analyze']['tag-breakdown']['$get'];
export type TagBreakdownOutput = InferResponseType<_FinanceTagBreakdownEndpoint, 200>;

type _FinanceMonthlyStatsEndpoint =
  HonoClient['api']['finance']['analyze']['monthly-stats']['$get'];
export type MonthlyStatsOutput = InferResponseType<_FinanceMonthlyStatsEndpoint, 200>;

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export type BudgetCategoryWithSpending = BudgetCategoryData & {
  actualSpending: number;
  percentageSpent: number;
  budgetAmount: number;
  allocationPercentage: number;
  variance: number;
  remaining: number;
  color: string;
  status: 'on-track' | 'warning' | 'over-budget';
  statusColor: string;
};

export type BudgetTrackingCategory = {
  id: string;
  name: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
  actualSpending?: number;
  percentageSpent?: number;
  budgetAmount?: number;
  allocationPercentage?: number;
  variance?: number;
  status?: 'on-track' | 'warning' | 'over-budget';
  statusColor?: string;
  color?: string;
};

export type BudgetChartDataPoint = {
  month: string;
  budgeted: number;
  actual: number;
};

export type BudgetPieDataPoint = {
  name: string;
  value: number;
};

export type BudgetHistoryDataPoint = {
  date: string;
  budgeted: number;
  actual: number;
};

export type BudgetCategoryAllocation = {
  category: string;
  amount: number;
  percentage: number;
};

export type BudgetProjection = {
  month: number;
  savings: number;
  totalSaved: number;
};

export type BudgetCategoryInput = {
  name: string;
  type: 'income' | 'expense';
  amount?: number;
  averageMonthlyExpense?: string;
  color?: string;
};

export type TransactionCategoryAnalysis = {
  category: string;
  name?: string;
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  type?: 'income' | 'expense';
  suggested?: boolean;
  suggestedBudget?: number;
  monthsWithTransactions?: number;
};

export type BudgetCategoriesListOutput = BudgetCategoryData[];

export type BudgetHistoryOutput = BudgetHistoryDataPoint[];

export type BudgetCalculateInput = {
  income: number;
  savingsGoal: number;
  allocations?: Record<string, number>;
  expenses?: Array<{
    category: string;
    amount: number;
  }>;
};

export type BudgetCalculateOutput = {
  totalBudget: number;
  disposable?: number;
  suggestedAllocations?: Record<string, number>;
  income?: number;
  totalExpenses?: number;
  surplus?: number;
  savingsRate?: number;
  categories?: BudgetCategoryAllocation[];
  projections?: BudgetProjection[];
  calculatedAt?: string;
  source?: 'manual' | 'categories';
};

export type TransactionCategoryAnalysisOutput = TransactionCategoryAnalysis[];

// ---------------------------------------------------------------------------
// Runway
// ---------------------------------------------------------------------------

export type RunwayCalculateInput = {
  balance: number;
  monthlyExpenses: number;
  plannedPurchases?: Array<{
    description: string;
    amount: number;
    date: string;
  }>;
  projectionMonths?: number;
};

type _RunwayCalculateEndpoint = HonoClient['api']['finance']['runway']['calculate']['$post'];
export type RunwayCalculateOutput = InferResponseType<_RunwayCalculateEndpoint, 200>;
type _RunwaySettingsEndpoint = HonoClient['api']['finance']['runway']['settings']['$get'];
export type RunwaySettingsOutput = InferResponseType<_RunwaySettingsEndpoint, 200>;

// ---------------------------------------------------------------------------
// Affordability
// ---------------------------------------------------------------------------

export type AffordabilityCheckInput = {
  purchaseAmount: number;
  currentBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  emergencyFundTarget?: number;
};

export type AffordabilityVerdict = 'affordable' | 'caution' | 'not-affordable';

type _AffordabilityCheckEndpoint = HonoClient['api']['finance']['affordability']['check']['$post'];
export type AffordabilityCheckOutput = InferResponseType<_AffordabilityCheckEndpoint, 200>;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export type FinanceClient = ReturnType<typeof hc<typeof financeRoutes>>;

export function createFinanceApiClient(config: ClientConfig): FinanceClient {
  return hc<typeof financeRoutes>(new URL('/api/finance', config.baseUrl).toString(), {
    fetch: customFetch(config),
  });
}
