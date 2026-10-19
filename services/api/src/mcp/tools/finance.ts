import { NotFoundError, ValidationError } from '@hominem/db/errors';
import {
  computeLedgerRunway,
  createOrGetFinanceCategory,
  deleteUnusedFinanceCategory,
  getFinanceNetWorth,
  getFinanceSpendingByCategory,
  getRunwaySettings,
  mergeFinanceCategories,
} from '@hominem/finance-services';

import {
  getMonthlyStatsReport,
  getTagBreakdownReport,
  getTopMerchantsReport,
  listFinanceCategoryOptions,
} from '../../application/finance.service';
import { mergeTags, renameTag } from '../../application/tags.service';
import './finance/register';
import {
  financeBudgetBreakdownInputSchema,
  financeBudgetBreakdownOutputSchema,
  financeCategoriesInputSchema,
  financeCategoriesOutputSchema,
  financeCategoryCreateInputSchema,
  financeCategoryCreateOutputSchema,
  financeCategoryDeleteInputSchema,
  financeCategoryDeleteOutputSchema,
  financeCategoryMergeInputSchema,
  financeCategoryMergeOutputSchema,
  financeMonthlyStatsInputSchema,
  financeMonthlyStatsOutputSchema,
  financeNetWorthInputSchema,
  financeNetWorthOutputSchema,
  financeRunwayInputSchema,
  financeRunwayOutputSchema,
  financeSpendingByCategoryInputSchema,
  financeSpendingByCategoryOutputSchema,
  financeTagBreakdownInputSchema,
  financeTagBreakdownOutputSchema,
  financeTagMergeInputSchema,
  financeTagMergeOutputSchema,
  financeTagRenameInputSchema,
  financeTagRenameOutputSchema,
  financeTopMerchantsInputSchema,
  financeTopMerchantsOutputSchema,
} from '../../schemas/finance.schema';
import { registerTool } from '../tool-registry';

// enforceResultCap in tool-registry rejects any top-level array longer than the tool's
// resultCap; these tools have no pagination input, so their arrays are truncated here to
// stay under cap instead of throwing for a user with more accounts than that.

// Reconciliation must see every account, so the summary cap is far higher than the accounts
// list cap; it exists only to bound the result, with totalCount exposing any truncation.
const MAX_REPORT_CURRENCIES = 500;
const MAX_RUNWAY_ACCOUNTS_RESULT = 50;

const REPORT_CAVEAT =
  'Computed from posted, non-excluded transactions in the range. ' +
  'Spending is every negative amount, so transfers between accounts are included.';

registerTool(
  {
    name: 'finance_net_worth',
    title: 'Finance Net Worth',
    description:
      'Compute current net worth from finance accounts included in net-worth totals, summing posted transaction activity per account. Returns per-account balances grouped by currency. Includes excluded rows; pending rows are omitted.',
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
  async (ownerUserId, input) => {
    const report = await getFinanceNetWorth(ownerUserId, input.includeClosed);
    return {
      ...report,
      totals: report.totals.map((total) => ({ ...total, total: total.totalCents / 100 })),
      accounts: report.accounts.map((account) => ({
        ...account,
        balance: account.balanceCents / 100,
      })),
    };
  },
);

registerTool(
  {
    name: 'finance_spending_by_category',
    title: 'Finance Spending by Category',
    description:
      'Sum posted, non-excluded, non-transfer spending grouped by category and currency over a date range (defaults to the last 30 days through today). Each category row is reported in its own currency; mixed-currency values are never combined. Check truncated and warnings because results may omit categories beyond the requested limit.',
    inputSchema: financeSpendingByCategoryInputSchema,
    outputSchema: financeSpendingByCategoryOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
  },
  async (ownerUserId, input) => {
    const report = await getFinanceSpendingByCategory(ownerUserId, input);
    return {
      ...report,
      categories: report.categories.map((category) => ({
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        currencyCode: category.currencyCode,
        spent: category.spentCents / 100,
        transactionCount: category.transactionCount,
      })),
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
    const { merchants, currencyCode, warnings } = await getTopMerchantsReport(ownerUserId, {
      from: input.from,
      to: input.to,
      accountId: input.accountId,
      tag: input.tag,
      limit: input.limit,
    });
    return {
      merchants: merchants.map((m) => ({
        name: m.name,
        totalSpent: m.totalSpent,
        transactionCount: m.transactionCount,
        currencyCode: m.currencyCode,
      })),
      count: merchants.length,
      currencyCode,
      warnings,
    };
  },
);

registerTool(
  {
    name: 'finance_tag_breakdown',
    title: 'Finance Tag Breakdown',
    description: `Break posted, non-excluded spending down by each assigned tag with per-currency shares and a per-day average. Untagged transactions appear as (untagged); a co-tagged transaction counts under every tag. ${REPORT_CAVEAT}`,
    inputSchema: financeTagBreakdownInputSchema,
    outputSchema: financeTagBreakdownOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: MAX_REPORT_CURRENCIES,
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
        amount: b.amount,
        percentage: b.percentage,
        transactionCount: b.transactionCount,
        currencyCode: b.currencyCode,
      })),
      totalSpending: report.totalSpending,
      totalsByCurrency: report.totalsByCurrency.slice(0, MAX_REPORT_CURRENCIES).map((item) => ({
        currencyCode: item.currencyCode,
        totalSpending: item.totalSpending,
        averagePerDay: item.averagePerDay,
      })),
      averagePerDay: report.averagePerDay,
      currencyCode: report.currencyCode,
      warnings:
        report.totalsByCurrency.length > MAX_REPORT_CURRENCIES
          ? [
              ...report.warnings,
              `Currency totals truncated after ${MAX_REPORT_CURRENCIES} currencies.`,
            ]
          : report.warnings,
    };
  },
);

registerTool(
  {
    name: 'finance_monthly_stats',
    title: 'Finance Monthly Stats',
    description: `Summarize posted, non-excluded activity for one month by currency: income, expenses, net, transaction count, top tag and top merchant. Mixed-currency months return null for combined monetary values and include currencyBreakdown. ${REPORT_CAVEAT}`,
    inputSchema: financeMonthlyStatsInputSchema,
    outputSchema: financeMonthlyStatsOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: MAX_REPORT_CURRENCIES,
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
      income: stats.income,
      expenses: stats.expenses,
      net: stats.net,
      transactionCount: stats.transactionCount,
      averageTransaction: stats.averageTransaction,
      topTag: stats.topTag,
      topMerchant: stats.topMerchant,
      tagSpending: stats.tagSpending.map((t) => ({
        name: t.name,
        amount: t.amount,
        currencyCode: t.currencyCode,
      })),
      currencyBreakdown: stats.currencyBreakdown
        .slice(0, MAX_REPORT_CURRENCIES)
        .map((currency) => ({
          currencyCode: currency.currencyCode,
          income: currency.income,
          expenses: currency.expenses,
          net: currency.net,
          transactionCount: currency.transactionCount,
          averageTransaction: currency.averageTransaction,
          topTag: currency.topTag,
          topMerchant: currency.topMerchant,
          tagSpending: currency.tagSpending.map((t) => ({
            name: t.name,
            amount: t.amount,
          })),
        })),
      ...(stats.startDate ? { startDate: stats.startDate } : {}),
      ...(stats.endDate ? { endDate: stats.endDate } : {}),
      currencyCode: stats.currencyCode,
      warnings:
        stats.currencyBreakdown.length > MAX_REPORT_CURRENCIES
          ? [
              ...stats.warnings,
              `Currency breakdown truncated after ${MAX_REPORT_CURRENCIES} currencies.`,
            ]
          : stats.warnings,
    };
  },
);

registerTool(
  {
    name: 'finance_runway',
    title: 'Finance Runway',
    description:
      'Project weekly cash from liquid accounts (checking, savings, cash) using trailing recurring outflows plus an optional ' +
      'monthly budget allowance. Uses the user-selected forecast currency and posted, non-excluded ledger rows. ' +
      'Derived from current data on every call; nothing is stored.',
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
    const settings = await getRunwaySettings(ownerUserId);
    const monthlyBudgets = new Map<
      string,
      { category: string; amount: number; currencyCode?: string; note?: string }
    >(
      settings.budgets
        .filter((budget) => budget.currencyCode === settings.currencyCode)
        .map(({ category, amount, currencyCode }) => [
          category.toLowerCase(),
          { category, amount, currencyCode },
        ]),
    );
    for (const budget of input.monthlyBudgets) {
      monthlyBudgets.set(budget.category.toLowerCase(), {
        category: budget.category,
        amount: budget.amountCents / 100,
        ...(settings.currencyCode ? { currencyCode: settings.currencyCode } : {}),
        ...(budget.note ? { note: budget.note } : {}),
      });
    }
    const runway = await computeLedgerRunway({
      userId: ownerUserId,
      currencyCode: settings.currencyCode,
      monthlyBudgets: [...monthlyBudgets.values()],
      projectionWeeks: input.projectionWeeks,
      ...(input.asOf ? { asOf: input.asOf } : {}),
    });
    return {
      asOfDate: runway.asOfDate,
      liquidAccounts: runway.liquidAccounts.slice(0, MAX_RUNWAY_ACCOUNTS_RESULT).map((a) => ({
        accountName: a.accountName,
        balance: a.balance,
      })),
      currencyCode: runway.currencyCode,
      warnings: runway.warnings,
      startingCash: runway.startingCash,
      weeklyRecurringOutflow: runway.weeklyRecurringOutflow,
      recurringLookbackMonths: runway.recurringLookbackMonths,
      recurringTxnCount: runway.recurringTxnCount,
      weeklyVariableAllowance: runway.weeklyVariableAllowance,
      weeks: runway.weeks.map((w) => ({
        week: w.week,
        weekStart: w.weekStart,
        weekEnd: w.weekEnd,
        beginningCash: w.beginningCash,
        recurringOutflows: w.recurringOutflows,
        variableAllowance: w.variableAllowance,
        netChange: w.netChange,
        endingCash: w.endingCash,
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
    // Computed directly in integer cents (rather than converting to dollars, splitting with
    // calculateBudgetBreakdown, and rounding each of the four shares back to cents
    // independently) so the four outputs always sum to exactly monthlyIncomeCents. Rounding
    // each share separately can otherwise allocate more cents than the income actually has —
    // e.g. 3 cents of income rounding to 2+1+1+0 = 4.
    const incomeCents = input.monthlyIncomeCents;
    const needsCents = Math.round(incomeCents * 0.5);
    const wantsCents = Math.round(incomeCents * 0.3);
    const capCents = Math.round(incomeCents * 0.2);
    const remainderCents = incomeCents - needsCents - wantsCents;
    const requestedSavingsCents = input.savingsTargetCents ?? capCents;
    const savingsCents = Math.max(0, Math.min(requestedSavingsCents, capCents, remainderCents));
    const unallocatedCents = remainderCents - savingsCents;
    return {
      needs: needsCents / 100,
      wants: wantsCents / 100,
      savings: savingsCents / 100,
      unallocated: unallocatedCents / 100,
    };
  },
);

const financeWriteTool = {
  readOnly: false as const,
  scopes: ['finance:write'] as const,
  destructive: false as const,
  idempotent: true as const,
  standaloneWrite: true as const,
};

registerTool(
  {
    ...financeWriteTool,
    name: 'finance_categories',
    title: 'Finance Categories',
    description:
      'List finance categories (id, name) for the authenticated user. Use to resolve sheet Category names before import.',
    inputSchema: financeCategoriesInputSchema,
    outputSchema: financeCategoriesOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 500,
  },
  async (ownerUserId) => listFinanceCategoryOptions(ownerUserId),
);

registerTool(
  {
    ...financeWriteTool,
    name: 'finance_category_create',
    title: 'Finance Category Create',
    description:
      'Create a finance category, or return the existing one when the name matches case-insensitively (created: false). Categories are what the sheet import resolves against and what budgets reference. dryRun reports the outcome without writing.',
    inputSchema: financeCategoryCreateInputSchema,
    outputSchema: financeCategoryCreateOutputSchema,
    resultCap: 1,
  },
  async (ownerUserId, input) => ({
    ...(await createOrGetFinanceCategory(ownerUserId, input.name, { dryRun: input.dryRun })),
    dryRun: input.dryRun,
  }),
);

registerTool(
  {
    ...financeWriteTool,
    name: 'finance_category_merge',
    title: 'Finance Category Merge',
    description:
      'Reassign every transaction from one category to another, then permanently remove the source. Uncategorized may be a target, never a source. dryRun counts what would move without writing.',
    inputSchema: financeCategoryMergeInputSchema,
    outputSchema: financeCategoryMergeOutputSchema,
    destructive: true,
    requiresConfirmation: true,
    resultCap: 1,
    preview: async (ownerUserId, input) => {
      const parsed = financeCategoryMergeInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const result = await mergeFinanceCategories(
        ownerUserId,
        { from: parsed.data.from, into: parsed.data.into },
        { dryRun: true },
      );
      return result.reason
        ? null
        : {
            from: parsed.data.from,
            into: result.category?.name ?? parsed.data.into,
            transactionsToMove: result.transactionsReassigned,
          };
    },
  },
  async (ownerUserId, input) => ({
    ...(await mergeFinanceCategories(
      ownerUserId,
      { from: input.from, into: input.into },
      { dryRun: input.dryRun },
    )),
    dryRun: input.dryRun,
  }),
);

registerTool(
  {
    ...financeWriteTool,
    name: 'finance_category_delete',
    title: 'Finance Category Delete',
    description:
      'Permanently delete an unused category by name or id. Categories referenced by transactions and Uncategorized cannot be deleted. The MCP server asks for confirmation before deletion.',
    inputSchema: financeCategoryDeleteInputSchema,
    outputSchema: financeCategoryDeleteOutputSchema,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    resultCap: 1,
    guidance: {
      whenToUse: 'Removing an unused test or duplicate category permanently.',
      whenNotToUse: 'Merge a category first if its transactions should be kept.',
      dependencies: [
        {
          tool: 'finance_categories',
          reason: 'resolve the category by name or id',
          provides: ['id'],
        },
      ],
    },
  },
  async (ownerUserId, input) => {
    const result = await deleteUnusedFinanceCategory(ownerUserId, input.category);
    if (result.reason === 'category_in_use') {
      throw new ValidationError(
        `category_in_use: ${result.referencingCount} transaction(s) reference this category.`,
        { reason: result.reason, referencingCount: result.referencingCount },
      );
    }
    if (result.reason === 'category_protected') {
      throw new ValidationError('category_protected', { reason: result.reason });
    }
    if (!result.category) throw new NotFoundError('Category', { reason: 'category_not_found' });
    return { deleted: result.category };
  },
);

// Tags are owner-wide, not finance-only, so these carry both scopes: a finance client must
// hold tags:write to rename or merge a tag that other domains also display.
registerTool(
  {
    readOnly: false,
    scopes: ['finance:write', 'tags:write'],
    destructive: false,
    idempotent: true,
    name: 'finance_tag_rename',
    title: 'Finance Tag Rename',
    description:
      'Rename a tag (display name only), keeping its id and every assignment. Refuses with target_exists when another tag already holds the new name — merge is for that. Tags are owner-wide, so a rename shows wherever the tag is used.',
    inputSchema: financeTagRenameInputSchema,
    outputSchema: financeTagRenameOutputSchema,
    resultCap: 1,
  },
  async (ownerUserId, input) => {
    const result = await renameTag(ownerUserId, input);
    return {
      assignmentsMoved: result.assignmentsPreserved,
      tag: result.tag,
      reason: result.reason,
    };
  },
);

registerTool(
  {
    readOnly: false,
    scopes: ['finance:write', 'tags:write'],
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    name: 'finance_tag_merge',
    title: 'Finance Tag Merge',
    description:
      'Move every assignment from one tag to another, then delete the emptied tag. Assignments the target already holds are not duplicated. Tags are owner-wide, so a merge affects every domain that uses them.',
    inputSchema: financeTagMergeInputSchema,
    outputSchema: financeTagMergeOutputSchema,
    resultCap: 1,
    // No elicitation: a client that does not declare the capability would hard-fail on the
    // prompt (the B5 lesson), and a merge is reversible by re-tagging.
    preview: async () => null,
  },
  async (ownerUserId, input) => mergeTags(ownerUserId, input),
);
