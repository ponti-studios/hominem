import {
  calculateBudgetBreakdown,
  computeLedgerRunway,
  getFinanceNetWorth,
  getFinanceRecentTransactions,
  getFinanceSpendingByCategory,
  listAccounts,
} from '@hominem/finance-services';

import {
  getMonthlyStatsReport,
  getTagBreakdownReport,
  getTopMerchantsReport,
  isUuid,
  searchTransactions,
} from '../../application/finance.service';
import {
  financeAccountsInputSchema,
  financeAccountsOutputSchema,
  financeBudgetBreakdownInputSchema,
  financeBudgetBreakdownOutputSchema,
  financeMonthlyStatsInputSchema,
  financeMonthlyStatsOutputSchema,
  financeNetWorthInputSchema,
  financeNetWorthOutputSchema,
  financeRecentTransactionsInputSchema,
  financeRecentTransactionsOutputSchema,
  financeRunwayInputSchema,
  financeRunwayOutputSchema,
  financeSpendingByCategoryInputSchema,
  financeSpendingByCategoryOutputSchema,
  financeTagBreakdownInputSchema,
  financeTagBreakdownOutputSchema,
  financeTopMerchantsInputSchema,
  financeTopMerchantsOutputSchema,
  financeTransactionSearchInputSchema,
  financeTransactionSearchOutputSchema,
} from '../../schemas/finance.schema';
import { registerTool } from '../tool-registry';

// Ledger amounts are stored as decimal currency units; tool outputs are integer cents.
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

// enforceResultCap in tool-registry rejects any top-level array longer than the tool's
// resultCap; these tools have no pagination input, so their arrays are truncated here to
// stay under cap instead of throwing for a user with more accounts than that.
const MAX_ACCOUNTS_RESULT = 50;

const REPORT_CAVEAT =
  'Computed from the most recent 200 non-excluded transactions in the range; narrow the range for exact totals. ' +
  'Spending is every negative amount, so transfers between accounts are included.';

registerTool(
  {
    name: 'finance_net_worth',
    title: 'Finance Net Worth',
    description:
      'Compute current net worth from finance accounts included in net-worth totals, summing posted transaction activity per account. Returns per-account balances grouped by currency.',
    inputSchema: financeNetWorthInputSchema,
    outputSchema: financeNetWorthOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks for current net worth or account balances.',
      whenNotToUse: 'Do not use for transaction history or category spending.',
      produces: ['account balances', 'net worth totals'],
    },
  },
  async (ownerUserId, input) => getFinanceNetWorth(ownerUserId, input.includeClosed),
);

registerTool(
  {
    name: 'finance_recent_transactions',
    title: 'Finance Recent Transactions',
    description:
      'List posted finance transactions in a bounded window, optionally scoped to one account, with category annotations where available.',
    inputSchema: financeRecentTransactionsInputSchema,
    outputSchema: financeRecentTransactionsOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks for recent transactions or spending evidence.',
      whenNotToUse: 'Do not use for net worth or category aggregation.',
      produces: ['transaction ids', 'transaction dates', 'merchant names', 'amounts'],
    },
  },
  async (ownerUserId, input) => getFinanceRecentTransactions(ownerUserId, input),
);

registerTool(
  {
    name: 'finance_spending_by_category',
    title: 'Finance Spending by Category',
    description:
      'Sum posted, non-excluded, non-transfer spending grouped by category over a date range. Returns spend totals in cents.',
    inputSchema: financeSpendingByCategoryInputSchema,
    outputSchema: financeSpendingByCategoryOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
  },
  async (ownerUserId, input) => getFinanceSpendingByCategory(ownerUserId, input),
);

registerTool(
  {
    name: 'finance_accounts',
    title: 'Finance Accounts',
    description:
      'List finance accounts with type, currency, lifecycle status and current balance (posted transactions only). ' +
      'Unlike finance_net_worth this includes accounts left out of net-worth totals, such as credit cards.',
    inputSchema: financeAccountsInputSchema,
    outputSchema: financeAccountsOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks which accounts they have, or an account id is needed as a filter.',
      whenNotToUse: 'Do not use for net worth totals; use finance_net_worth.',
      produces: ['account ids', 'account names', 'account balances'],
    },
  },
  async (ownerUserId, input) => {
    const accounts = await listAccounts(ownerUserId);
    const visible = accounts.filter((a) => input.includeClosed || a.lifecycleStatus !== 'closed');
    const limited = visible.slice(0, MAX_ACCOUNTS_RESULT);
    return {
      accounts: limited.map((a) => ({
        id: a.id,
        name: a.name,
        accountType: a.accountType,
        currencyCode: a.currencyCode,
        lifecycleStatus: a.lifecycleStatus,
        includeInNetWorth: a.includeInNetWorth,
        balanceCents: toCents(a.currentBalance),
      })),
      count: limited.length,
      totalCount: visible.length,
    };
  },
);

registerTool(
  {
    name: 'finance_top_merchants',
    title: 'Finance Top Merchants',
    description: `Rank merchants by total spending, optionally filtered by date range, account or tag. ${REPORT_CAVEAT}`,
    inputSchema: financeTopMerchantsInputSchema,
    outputSchema: financeTopMerchantsOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks where their money goes or which merchants they spend the most at.',
      whenNotToUse: 'Do not use for category totals; use finance_spending_by_category.',
      produces: ['merchant names', 'merchant spending totals'],
    },
  },
  async (ownerUserId, input) => {
    const { merchants } = await getTopMerchantsReport(ownerUserId, {
      from: input.from,
      to: input.to,
      accountId: input.accountId,
      tag: input.tag,
      limit: input.limit,
    });
    return {
      merchants: merchants.map((m) => ({
        name: m.name,
        totalSpentCents: toCents(m.totalSpent),
        transactionCount: m.transactionCount,
      })),
      count: merchants.length,
    };
  },
);

registerTool(
  {
    name: 'finance_tag_breakdown',
    title: 'Finance Tag Breakdown',
    description: `Break spending down by tag with each tag's share of the total and a per-day average. ${REPORT_CAVEAT}`,
    inputSchema: financeTagBreakdownInputSchema,
    outputSchema: financeTagBreakdownOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks how spending splits across their own tags.',
      whenNotToUse:
        'Do not use for the ledger category breakdown; use finance_spending_by_category.',
      produces: ['tag names', 'tag spending shares'],
    },
  },
  async (ownerUserId, input) => {
    const report = await getTagBreakdownReport(ownerUserId, {
      from: input.from,
      to: input.to,
      accountId: input.accountId,
      tag: input.tag,
      limit: input.limit,
    });
    return {
      breakdown: report.breakdown.map((b) => ({
        tag: b.tag,
        amountCents: toCents(b.amount),
        percentage: b.percentage,
        transactionCount: b.transactionCount,
      })),
      totalSpendingCents: toCents(report.totalSpending),
      averagePerDayCents: toCents(report.averagePerDay),
    };
  },
);

registerTool(
  {
    name: 'finance_monthly_stats',
    title: 'Finance Monthly Stats',
    description: `Summarize one month: income, expenses, net, transaction count, top tag and top merchant. ${REPORT_CAVEAT}`,
    inputSchema: financeMonthlyStatsInputSchema,
    outputSchema: financeMonthlyStatsOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 10,
    guidance: {
      whenToUse: 'The user asks how a month went financially.',
      whenNotToUse: 'Do not use for multi-month trends.',
      produces: ['monthly income', 'monthly expenses', 'monthly net'],
    },
  },
  async (ownerUserId, input) => {
    const stats = await getMonthlyStatsReport(ownerUserId, input.month);
    return {
      month: stats.month,
      incomeCents: toCents(stats.income),
      expensesCents: toCents(stats.expenses),
      netCents: toCents(stats.net),
      transactionCount: stats.transactionCount,
      averageTransactionCents: toCents(stats.averageTransaction),
      topTag: stats.topTag,
      topMerchant: stats.topMerchant,
      tagSpending: stats.tagSpending.map((t) => ({
        name: t.name,
        amountCents: toCents(t.amount),
      })),
      ...(stats.startDate ? { startDate: stats.startDate } : {}),
      ...(stats.endDate ? { endDate: stats.endDate } : {}),
    };
  },
);

registerTool(
  {
    name: 'finance_transaction_search',
    title: 'Finance Transaction Search',
    description:
      'Search transactions by text in the description or merchant name, with optional date range, account and tag filters. ' +
      'Includes pending and excluded transactions (flagged), newest first, and pages with offset.',
    inputSchema: financeTransactionSearchInputSchema,
    outputSchema: financeTransactionSearchOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks to find specific transactions, e.g. "what did I pay Comcast".',
      whenNotToUse: 'Use finance_recent_transactions for a plain recent-activity list.',
      produces: ['transaction ids', 'transaction amounts', 'merchant names'],
    },
  },
  async (ownerUserId, input) => {
    const result = await searchTransactions(ownerUserId, {
      accountIds: input.accountId ? [input.accountId] : [],
      dateFrom: input.from,
      dateTo: input.to,
      text: input.query,
      ...(input.tag
        ? isUuid(input.tag)
          ? { tagIds: [input.tag] }
          : { tagNames: [input.tag] }
        : {}),
      limit: input.limit,
      offset: input.offset,
    });
    return {
      transactions: result.data.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        postedOn: t.postedOn,
        description: t.description,
        merchantName: t.merchantName,
        amountCents: toCents(t.amount),
        pending: t.pending,
        excluded: t.excluded,
      })),
      count: result.data.length,
      filteredCount: result.filteredCount,
    };
  },
);

registerTool(
  {
    name: 'finance_runway',
    title: 'Finance Runway',
    description:
      'Project weekly cash from liquid accounts (checking, savings, cash) using trailing recurring outflows plus an optional ' +
      'monthly budget allowance. Derived from current data on every call; nothing is stored.',
    inputSchema: financeRunwayInputSchema,
    outputSchema: financeRunwayOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 52,
    guidance: {
      whenToUse:
        'The user asks how long their cash will last or what their balance will look like.',
      whenNotToUse: 'Do not use for current balances; use finance_accounts.',
      produces: ['weekly cash projection', 'weekly recurring outflow'],
    },
  },
  async (ownerUserId, input) => {
    const runway = await computeLedgerRunway({
      userId: ownerUserId,
      monthlyBudgets: input.monthlyBudgets.map((b) => ({
        category: b.category,
        amount: b.amountCents / 100,
        ...(b.note ? { note: b.note } : {}),
      })),
      projectionWeeks: input.projectionWeeks,
      ...(input.asOf ? { asOf: input.asOf } : {}),
    });
    return {
      asOfDate: runway.asOfDate,
      liquidAccounts: runway.liquidAccounts.slice(0, MAX_ACCOUNTS_RESULT).map((a) => ({
        accountName: a.accountName,
        balanceCents: toCents(a.balance),
      })),
      startingCashCents: toCents(runway.startingCash),
      weeklyRecurringOutflowCents: toCents(runway.weeklyRecurringOutflow),
      recurringLookbackMonths: runway.recurringLookbackMonths,
      recurringTxnCount: runway.recurringTxnCount,
      weeklyVariableAllowanceCents: toCents(runway.weeklyVariableAllowance),
      weeks: runway.weeks.map((w) => ({
        week: w.week,
        weekStart: w.weekStart,
        weekEnd: w.weekEnd,
        beginningCashCents: toCents(w.beginningCash),
        recurringOutflowsCents: toCents(w.recurringOutflows),
        variableAllowanceCents: toCents(w.variableAllowance),
        netChangeCents: toCents(w.netChange),
        endingCashCents: toCents(w.endingCash),
      })),
    };
  },
);

registerTool(
  {
    name: 'finance_budget_breakdown',
    title: 'Finance Budget Breakdown',
    description:
      'Split a monthly income into a 50/30/20 needs, wants and savings budget. Pure calculation over the given income; reads no ledger data.',
    inputSchema: financeBudgetBreakdownInputSchema,
    outputSchema: financeBudgetBreakdownOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 1,
    guidance: {
      whenToUse: 'The user asks how to budget a given income.',
      whenNotToUse: 'Do not use to report what the user actually spent.',
      produces: ['needs allocation', 'wants allocation', 'savings allocation'],
    },
  },
  async (_ownerUserId, input) => {
    const breakdown = calculateBudgetBreakdown({
      monthlyIncome: input.monthlyIncomeCents / 100,
      ...(input.savingsTargetCents !== undefined
        ? { savingsTarget: input.savingsTargetCents / 100 }
        : {}),
    });
    return {
      needsCents: toCents(breakdown.needs),
      wantsCents: toCents(breakdown.wants),
      savingsCents: toCents(breakdown.savings),
      unallocatedCents: toCents(breakdown.unallocated),
    };
  },
);
