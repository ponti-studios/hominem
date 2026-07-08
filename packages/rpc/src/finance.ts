// ============================================================================
// Finance — Schemas, Types & Client
// ============================================================================

import * as z from 'zod'

import type { RawHonoClient } from './core/raw-client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type EmptyInput = {}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

// -- Accounts --

export const accountListSchema = z.object({
  includeInactive: z.boolean().optional().default(false),
})

export const accountGetSchema = z.object({
  id: z.string().uuid(),
})

export const accountCreateSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1).optional(),
  balance: z.union([z.number(), z.string()]).optional(),
  institutionId: z.string().optional(),
  institution: z.string().optional(),
})

export const accountUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  balance: z.union([z.number(), z.string()]).optional(),
  institutionId: z.string().optional(),
  institution: z.string().optional(),
})

export const accountDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const institutionAccountsSchema = z.object({
  institutionId: z.string(),
})

// -- Transactions --

export const TransactionInsertSchema = z.object({
  userId: z.string().uuid(),
  accountId: z.string().uuid(),
  amount: z.number(),
  description: z.string().min(1),
  date: z.string(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
})

export const TransactionQueryFiltersSchema = z.object({
  accountId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
  tagIds: z.array(z.string().uuid()).optional(),
  tagNames: z.array(z.string().min(1)).optional(),
})

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type InstitutionData = {
  id: string
  name: string
  logo?: string
}

export type BudgetCategoryData = {
  id: string
  name: string
  userId: string
  type?: 'income' | 'expense'
  color?: string
  averageMonthlyExpense?: string
}

export type AccountData = {
  id: string
  userId: string
  name: string
  accountType: string
  currentBalance: number | null
}

export type TransactionData = {
  id: string
  userId: string
  accountId: string
  amount: number
  description: string | null
  postedOn: string
  merchantName: string | null
}

export type AccountWithPlaidInfo = AccountData & {
  institutionName?: string | null
  plaidAccountId?: string | null
  plaidItemId?: string | null
}

export type TimeSeriesTrend = {
  raw: string
  formatted: string
  direction: 'up' | 'down' | 'flat'
  percentChange?: string
  previousAmount?: number
  formattedPreviousAmount?: string
  percentChangeExpenses?: string
  rawExpenses?: string
  previousExpenses?: number
  formattedPreviousExpenses?: string
  directionExpenses?: 'up' | 'down'
}

export type TimeSeriesDataPoint = {
  date: string
  amount: number
  expenses: number
  income: number
  count: number
  average: number
  trend?: TimeSeriesTrend
  formattedAmount?: string
  formattedIncome?: string
  formattedExpenses?: string
}

export type TimeSeriesStats = {
  total: number
  average: number
  min: number
  max: number
  trend: 'up' | 'down' | 'stable'
  changePercentage: number
  periodCovered?: string
  totalIncome?: number
  totalExpenses?: number
  averageIncome?: number
  averageExpenses?: number
  count?: number
}

export type PlaidConnection = {
  id: string
  institutionId: string
  institutionName: string
  institutionLogo: string | null
  status: 'active' | 'error' | 'disconnected'
  lastSynced: string
  accounts: number
}

export type AccountWithPlaidData = AccountData

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export type AccountWithTransactions = AccountWithPlaidInfo & {
  transactions: TransactionData[]
}

export type AccountsAllData = {
  accounts: AccountWithTransactions[]
  connections: PlaidConnection[]
}

export type AccountListInput = {
  includeInactive?: boolean
}

export type AccountGetInput = {
  id: string
}

export type AccountCreateInput = {
  name: string
  type: string
  balance?: number | string
  institution?: string
  institutionId?: string
}

export type AccountUpdateInput = {
  id: string
  name?: string
  type?: string
  balance?: number | string
  institution?: string
  institutionId?: string
}

export type AccountDeleteInput = {
  id: string
}

export type AccountInstitutionAccountsInput = {
  institutionId: string
}

export type AccountListOutput = AccountData[]
export type AccountGetOutput = AccountWithTransactions
export type AccountCreateOutput = AccountData
export type AccountUpdateOutput = AccountData
export type AccountDeleteOutput = { success: true }
export type AccountAllOutput = AccountsAllData
export type AccountsWithPlaidOutput = AccountWithPlaidInfo[]
export type AccountConnectionsOutput = PlaidConnection[]
export type AccountInstitutionAccountsOutput = AccountWithPlaidInfo[]

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export type TransactionUpdateData = {
  accountId?: string
  amount?: string | number
  description?: string | null
  category?: string | null
  date?: string
  merchantName?: string | null
  note?: string | null
  tags?: string | null
  excluded?: boolean | null
  recurring?: boolean | null
}

export type TransactionListInput = {
  from?: string
  to?: string
  category?: string
  min?: string
  max?: string
  account?: string
  limit?: number
  offset?: number
  description?: string
  search?: string
  sortBy?: string[]
  sortDirection?: ('asc' | 'desc')[]
}

export type TransactionCreateInput = {
  accountId: string
  amount: string | number
  description?: string | null
  type?: string | null
  category?: string | null
  date?: string
}

export type TransactionUpdateInput = {
  id: string
  data: TransactionUpdateData
}

export type TransactionDeleteInput = {
  id: string
}

export type TransactionListOutput = {
  data: TransactionData[]
  filteredCount: number
  totalUserCount: number
}

export type TransactionCreateOutput = TransactionData
export type TransactionUpdateOutput = TransactionData
export type TransactionDeleteOutput = { success: boolean; message?: string }

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------

export type InstitutionsListInput = EmptyInput
export type InstitutionsListOutput = InstitutionData[]

export type InstitutionCreateInput = {
  id: string
  name: string
  logo?: string
  url?: string
  primaryColor?: string
  country?: string
}

export type InstitutionCreateOutput = InstitutionData

// ---------------------------------------------------------------------------
// Categories / Tags
// ---------------------------------------------------------------------------

export type CategoriesListInput = EmptyInput
export type CategoriesListItem = {
  id: string
  userId: string
  name: string
  parentId?: string | null
  icon?: string | null
  color?: string | null
}

export type CategoriesListOutput = CategoriesListItem[]

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type Merchant = {
  name: string
  totalSpent: number
  transactionCount: number
}

export type TagBreakdownItem = {
  tag: string
  amount: number
  percentage: number
  transactionCount: number
}

export type TransactionStats = {
  min: number
  max: number
  mean: number
  median: number
  stdDev: number
}

export type TagSpendingItem = {
  name: string | null
  amount: number
}

export type SpendingDataPointBase = {
  date: string
  amount: number
  expenses: number
  income: number
  count: number
  average: number
  formattedAmount?: string
  formattedIncome?: string
  formattedExpenses?: string
}

export type SpendingDataPointTrend = {
  raw: string
  formatted: string
  direction: 'up' | 'down' | 'flat'
  percentChange?: string
  previousAmount?: number
  formattedPreviousAmount?: string
  percentChangeExpenses?: string
  rawExpenses?: string
  previousExpenses?: number
  formattedPreviousExpenses?: string
  directionExpenses?: 'up' | 'down'
}

export type SpendingDataPointWithTrend = SpendingDataPointBase & {
  trend: SpendingDataPointTrend
}

export type SpendingDataPoint = SpendingDataPointBase | SpendingDataPointWithTrend

export type SpendingTimeSeriesInput = {
  from?: string
  to?: string
  account?: string
  tag?: string
  limit?: number
  groupBy?: 'month' | 'week' | 'day'
  includeStats?: boolean
  compareToPrevious?: boolean
}

export type SpendingTimeSeriesOutput = {
  data: TimeSeriesDataPoint[]
  stats?: TimeSeriesStats | null
}

export type TopMerchantsInput = {
  from?: string
  to?: string
  account?: string
  tag?: string
  limit?: number
}

export type TopMerchantsOutput = {
  merchants: Merchant[]
}

export type TagBreakdownInput = {
  from?: string
  to?: string
  tag?: string
  limit?: number
}

export type TagBreakdownOutput = {
  breakdown: TagBreakdownItem[]
  totalSpending: number
  averagePerDay: number
}

export type CalculateTransactionsInput = {
  from?: string
  to?: string
  tag?: string
  account?: string
  type?: 'income' | 'expense' | 'credit' | 'debit' | 'transfer' | 'investment'
  calculationType?: 'sum' | 'average' | 'count' | 'stats'
  descriptionLike?: string
  transactionIds?: string[]
}

export type CalculateTransactionsOutput = {
  sum?: number
  average?: number
  count?: number
  stats?: TransactionStats
  formattedSum?: string
  formattedAverage?: string
}

export type MonthlyStatsInput = {
  year?: number
  month?: number
}

export type MonthlyStatsOutput = {
  month: string
  income: number
  expenses: number
  net: number
  transactionCount: number
  averageTransaction: number
  topTag: string
  topMerchant: string
  formattedIncome: string
  formattedExpenses: string
  formattedNet: string
  formattedAverage: string
  totalIncome?: number
  totalExpenses?: number
  netIncome?: number
  tagSpending?: TagSpendingItem[]
  startDate?: string
  endDate?: string
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export type BudgetCategoryWithSpending = BudgetCategoryData & {
  actualSpending: number
  percentageSpent: number
  budgetAmount: number
  allocationPercentage: number
  variance: number
  remaining: number
  color: string
  status: 'on-track' | 'warning' | 'over-budget'
  statusColor: string
}

export type BudgetTrackingCategory = {
  id: string
  name: string
  budgeted: number
  spent: number
  remaining: number
  percentage: number
  actualSpending?: number
  percentageSpent?: number
  budgetAmount?: number
  allocationPercentage?: number
  variance?: number
  status?: 'on-track' | 'warning' | 'over-budget'
  statusColor?: string
  color?: string
}

export type BudgetChartDataPoint = {
  month: string
  budgeted: number
  actual: number
}

export type BudgetPieDataPoint = {
  name: string
  value: number
}

export type BudgetHistoryDataPoint = {
  date: string
  budgeted: number
  actual: number
}

export type BudgetCategoryAllocation = {
  category: string
  amount: number
  percentage: number
}

export type BudgetProjection = {
  month: number
  savings: number
  totalSaved: number
}

export type BudgetCategoryInput = {
  name: string
  type: 'income' | 'expense'
  amount?: number
  averageMonthlyExpense?: string
  color?: string
}

export type TransactionCategoryAnalysis = {
  category: string
  name?: string
  totalAmount: number
  transactionCount: number
  averageAmount: number
  type?: 'income' | 'expense'
  suggested?: boolean
  suggestedBudget?: number
  monthsWithTransactions?: number
}

export type BudgetCategoriesListInput = EmptyInput
export type BudgetCategoriesListOutput = BudgetCategoryData[]

export type BudgetCategoriesListWithSpendingInput = {
  month?: string
  monthYear?: string
}

export type BudgetCategoriesListWithSpendingOutput = BudgetCategoryWithSpending[]

export type BudgetCategoryGetInput = { id: string }

export type BudgetCategoryCreateInput = {
  name: string
  type: 'income' | 'expense'
  averageMonthlyExpense?: string
  budgetId?: string
  color?: string
}

export type BudgetCategoryUpdateInput = {
  id: string
  name?: string
  type?: 'income' | 'expense'
  averageMonthlyExpense?: string
  budgetId?: string
  color?: string
}

export type BudgetCategoryGetOutput = BudgetCategoryData
export type BudgetCategoryCreateOutput = BudgetCategoryData
export type BudgetCategoryUpdateOutput = BudgetCategoryData

export type BudgetCategoryDeleteInput = { id: string }
export type BudgetCategoryDeleteOutput = { success: true; message: string }

export type BudgetTrackingInput = {
  month?: string
  monthYear?: string
}

export type BudgetTrackingOutput = {
  month: string
  monthYear?: string
  totalBudget: number
  totalSpent: number
  remaining: number
  status: 'on-track' | 'warning' | 'over-budget'
  summary?: {
    totalBudget: number
    totalSpent: number
    remaining: number
    percentUsed: number
  }
  categories: BudgetTrackingCategory[]
  chartData?: BudgetChartDataPoint[]
  pieData?: BudgetPieDataPoint[]
}

export type BudgetHistoryInput = {
  months?: number
}

export type BudgetHistoryOutput = BudgetHistoryDataPoint[]

export type BudgetCalculateInput = {
  income: number
  savingsGoal: number
  allocations?: Record<string, number>
  expenses?: Array<{
    category: string
    amount: number
  }>
}

export type BudgetCalculateOutput = {
  totalBudget: number
  disposable?: number
  suggestedAllocations?: Record<string, number>
  income?: number
  totalExpenses?: number
  surplus?: number
  savingsRate?: number
  categories?: BudgetCategoryAllocation[]
  projections?: BudgetProjection[]
  calculatedAt?: string
  source?: 'manual' | 'categories'
}

export type BudgetBulkCreateInput = {
  categories: BudgetCategoryInput[]
}

export type BudgetBulkCreateOutput = {
  created: number
  categories: BudgetCategoryData[]
}

export type TransactionCategoryAnalysisOutput = TransactionCategoryAnalysis[]

// ---------------------------------------------------------------------------
// Plaid
// ---------------------------------------------------------------------------

export type PlaidCreateLinkTokenInput = {
  userId: string
}

export type PlaidCreateLinkTokenOutput = {
  linkToken: string
  expiration: string
  requestId: string
}

export type PlaidExchangeTokenOutput = {
  accessToken: string
  itemId: string
  requestId: string
}

export type PlaidExchangeTokenInput = {
  publicToken: string
  institutionId?: string
  institutionName?: string
  metaData?: unknown
}

export type PlaidSyncItemInput = {
  itemId: string
}

export type PlaidSyncItemOutput = {
  success: boolean
  added: number
  modified: number
  removed: number
}

export type PlaidRemoveConnectionOutput = {
  success: boolean
}

export type PlaidRemoveConnectionInput = {
  connectionId: string
  itemId?: string
}

// ---------------------------------------------------------------------------
// Runway
// ---------------------------------------------------------------------------

export type RunwayCalculateInput = {
  balance: number
  monthlyExpenses: number
  plannedPurchases?: Array<{
    description: string
    amount: number
    date: string
  }>
  projectionMonths?: number
}

export type RunwayCalculateOutput = {
  runwayMonths: number
  runwayEndDate: string
  isRunwayDangerous: boolean
  totalPlannedExpenses: number
  projectionData: Array<{
    month: string
    balance: number
  }>
  months: number
  years: number
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type ExportTransactionsInput = {
  format: 'csv' | 'json' | 'pdf'
  year?: number
  month?: number
  accountId?: string
  startDate?: string
  endDate?: string
  accounts?: string[]
  categories?: string[]
}

export type ExportTransactionsOutput = {
  url: string
  filename: string
  expiresAt: string
  data?: string
  fileName?: string
  createdAt?: string
}

export type ExportSummaryOutput = {
  url: string
  filename: string
  data?: string
  fileName?: string
  createdAt?: string
}

export type ExportSummaryInput = {
  year: number
  format: 'pdf' | 'html' | 'csv' | 'json'
  startDate?: string
  endDate?: string
  accounts?: string[]
  categories?: string[]
}

// ---------------------------------------------------------------------------
// Data Management
// ---------------------------------------------------------------------------

export type DataDeleteAllInput = {
  confirm: boolean
}

export type DataDeleteAllOutput = {
  success: boolean
  deletedCounts?: {
    transactions: number
    accounts: number
    budgets: number
    connections: number
  }
  message?: string
}

// ---------------------------------------------------------------------------
// Domain Client
// ---------------------------------------------------------------------------

export interface FinanceMonthlyStatsInput {
  month: string
}

export interface FinanceTransactionsListInput {
  account?: string
  dateFrom?: string
  dateTo?: string
  description?: string
  limit?: number
  offset?: number
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
}

export interface FinanceTagBreakdownInput {
  account?: string
  from?: string
  to?: string
  tag?: string
  limit?: number
}

export interface FinanceSpendingTimeSeriesInput {
  account?: string
  compareToPrevious?: boolean
  from?: string
  groupBy?: 'month' | 'week' | 'day'
  includeStats?: boolean
  tag?: string
  to?: string
}

export interface FinanceTopMerchantsInput {
  account?: string
  from?: string
  limit?: number
  tag?: string
  to?: string
}

export interface FinanceClient {
  listAccounts(input: AccountListInput): Promise<AccountListOutput>
  listAllAccounts(): Promise<AccountAllOutput>
  getAccount(input: AccountGetInput): Promise<AccountGetOutput>
  listTransactions(input: FinanceTransactionsListInput): Promise<TransactionListOutput>
  listInstitutions(): Promise<InstitutionsListOutput>
  createInstitution(input: InstitutionCreateInput): Promise<InstitutionCreateOutput>
  listAccountsWithPlaid(): Promise<AccountsWithPlaidOutput>
  listConnections(): Promise<AccountConnectionsOutput>
  listInstitutionAccounts(input: AccountInstitutionAccountsInput): Promise<AccountInstitutionAccountsOutput>
  getTagBreakdown(input: FinanceTagBreakdownInput): Promise<TagBreakdownOutput>
  listTags(): Promise<CategoriesListOutput>
  getMonthlyStats(input: FinanceMonthlyStatsInput): Promise<MonthlyStatsOutput>
  getSpendingTimeSeries(input: FinanceSpendingTimeSeriesInput): Promise<SpendingTimeSeriesOutput>
  getTopMerchants(input: FinanceTopMerchantsInput): Promise<TopMerchantsOutput>
  calculateRunway(input: RunwayCalculateInput): Promise<RunwayCalculateOutput>
}

export function createFinanceClient(rawClient: RawHonoClient): FinanceClient {
  return {
    async listAccounts(input) {
      const res = await rawClient.api.finance.accounts.list.$post({ json: input })
      return res.json() as Promise<AccountListOutput>
    },
    async listAllAccounts() {
      const res = await rawClient.api.finance.accounts.all.$post({ json: {} })
      return res.json() as Promise<AccountAllOutput>
    },
    async getAccount(input) {
      const res = await rawClient.api.finance.accounts.get.$post({ json: input })
      return res.json() as Promise<AccountGetOutput>
    },
    async listTransactions(input) {
      const res = await rawClient.api.finance.transactions.list.$post({ json: input })
      return res.json() as Promise<TransactionListOutput>
    },
    async listInstitutions() {
      const res = await rawClient.api.finance.institutions.list.$post({ json: {} })
      return res.json() as Promise<InstitutionsListOutput>
    },
    async createInstitution(input) {
      const res = await rawClient.api.finance.institutions.create.$post({ json: input })
      return res.json() as Promise<InstitutionCreateOutput>
    },
    async listAccountsWithPlaid() {
      const res = await rawClient.api.finance.accounts['with-plaid'].$post({ json: {} })
      return res.json() as Promise<AccountsWithPlaidOutput>
    },
    async listConnections() {
      const res = await rawClient.api.finance.accounts.connections.$post({ json: {} })
      return res.json() as Promise<AccountConnectionsOutput>
    },
    async listInstitutionAccounts(input) {
      const res = await rawClient.api.finance.accounts['institution-accounts'].$post({ json: input })
      return res.json() as Promise<AccountInstitutionAccountsOutput>
    },
    async getTagBreakdown(input) {
      const res = await rawClient.api.finance.analyze['tag-breakdown'].$post({ json: input })
      return res.json() as Promise<TagBreakdownOutput>
    },
    async listTags() {
      const res = await rawClient.api.finance.tags.list.$post({ json: {} })
      return res.json() as Promise<CategoriesListOutput>
    },
    async getMonthlyStats(input) {
      const res = await rawClient.api.finance.analyze['monthly-stats'].$post({ json: input })
      return res.json() as Promise<MonthlyStatsOutput>
    },
    async getSpendingTimeSeries(input) {
      const res = await rawClient.api.finance.analyze['spending-time-series'].$post({ json: input })
      return res.json() as Promise<SpendingTimeSeriesOutput>
    },
    async getTopMerchants(input) {
      const res = await rawClient.api.finance.analyze['top-merchants'].$post({ json: input })
      return res.json() as Promise<TopMerchantsOutput>
    },
    async calculateRunway(input) {
      const res = await rawClient.api.finance.runway.calculate.$post({ json: input })
      return res.json() as Promise<RunwayCalculateOutput>
    },
  }
}
