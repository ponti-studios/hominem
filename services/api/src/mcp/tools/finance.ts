import { ValidationError } from '@hominem/db/errors';
import {
  computeLedgerRunway,
  countAccounts,
  createOrGetAccount,
  deleteTransactionsByIds,
  getAccountSummaries,
  getFinanceNetWorth,
  getFinanceRecentTransactions,
  getFinanceSpendingByCategory,
  listAccounts,
} from '@hominem/finance-services';

import {
  getMonthlyStatsReport,
  getTagBreakdownReport,
  getTopMerchantsReport,
  importFinanceTransactions,
  isUuid,
  listFinanceCategoryOptions,
  searchTransactions,
  upsertFinanceTransaction,
} from '../../application/finance.service';
import { mergeTags, renameTag } from '../../application/tags.service';
import {
  financeAccountCreateInputSchema,
  financeAccountCreateOutputSchema,
  financeAccountsInputSchema,
  financeAccountsOutputSchema,
  financeAccountSummaryInputSchema,
  financeAccountSummaryOutputSchema,
  financeBudgetBreakdownInputSchema,
  financeBudgetBreakdownOutputSchema,
  financeCategoriesInputSchema,
  financeCategoriesOutputSchema,
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
  financeTagMergeInputSchema,
  financeTagMergeOutputSchema,
  financeTagRenameInputSchema,
  financeTagRenameOutputSchema,
  financeTopMerchantsInputSchema,
  financeTopMerchantsOutputSchema,
  financeTransactionSearchInputSchema,
  financeTransactionSearchOutputSchema,
  financeTransactionDeleteInputSchema,
  financeTransactionDeleteOutputSchema,
  financeTransactionUpsertInputSchema,
  financeTransactionUpsertOutputSchema,
  financeTransactionsImportInputSchema,
  financeTransactionsImportOutputSchema,
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

// Reconciliation must see every account, so the summary cap is far higher than the accounts
// list cap; it exists only to bound the result, with totalCount exposing any truncation.
const MAX_SUMMARY_ACCOUNTS = 500;

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
    const [limited, totalCount] = await Promise.all([
      listAccounts(ownerUserId, { includeClosed: input.includeClosed, limit: MAX_ACCOUNTS_RESULT }),
      countAccounts(ownerUserId, { includeClosed: input.includeClosed }),
    ]);
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
      totalCount,
    };
  },
);

registerTool(
  {
    name: 'finance_account_summary',
    title: 'Finance Account Summary',
    description:
      'Reconcile per account: transaction and excluded counts, per-currency totals, and the posted-on span. ' +
      'Counts and totals cover every row (pending and excluded included), and closed accounts are included by default.',
    inputSchema: financeAccountSummaryInputSchema,
    outputSchema: financeAccountSummaryOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: MAX_SUMMARY_ACCOUNTS,
    guidance: {
      whenToUse: 'Verifying an import or reconciling account totals without paging transactions.',
      whenNotToUse: 'Do not use for spending breakdowns; use finance_spending_by_category.',
      produces: ['per-account transaction counts', 'per-account totals'],
    },
  },
  async (ownerUserId, input) => {
    const { summaries } = await getAccountSummaries(ownerUserId, {
      ...(input.accountId ? { accountId: input.accountId } : {}),
      includeClosed: input.includeClosed,
    });
    const limited = summaries.slice(0, MAX_SUMMARY_ACCOUNTS);
    return {
      accounts: limited.map((summary) => ({
        accountId: summary.accountId,
        accountName: summary.accountName,
        status: summary.status,
        transactionCount: summary.transactionCount,
        excludedCount: summary.excludedCount,
        totals: summary.totals.map((total) => ({
          currencyCode: total.currencyCode,
          sumCents: toCents(total.sumAmount),
        })),
        minPostedOn: summary.minPostedOn,
        maxPostedOn: summary.maxPostedOn,
      })),
      count: limited.length,
      totalCount: summaries.length,
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
        totalSpentCents: toCents(m.totalSpent),
        transactionCount: m.transactionCount,
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
      currencyCode: report.currencyCode,
      warnings: report.warnings,
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
      currencyCode: stats.currencyCode,
      warnings: stats.warnings,
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
        accountName: t.accountName,
        postedOn: t.postedOn,
        description: t.description,
        merchantName: t.merchantName,
        amountCents: toCents(t.amount),
        currencyCode: t.currencyCode,
        transactionType: t.transactionType,
        categoryId: t.categoryId,
        categoryName: t.categoryName,
        tags: t.tags,
        notes: t.notes,
        orderNumber: t.orderNumber,
        source: t.source,
        recurring: t.recurring,
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
      currencyCode: runway.currencyCode,
      warnings: runway.warnings,
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
    return { needsCents, wantsCents, savingsCents, unallocatedCents };
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
    name: 'finance_account_create',
    title: 'Finance Account Create',
    description:
      'Create a finance account, or return the existing one when the name matches case-insensitively (created: false). ' +
      'Accounts created here are what sheet imports resolve against; the import never auto-creates an unknown account. ' +
      'dryRun reports the outcome without writing.',
    inputSchema: financeAccountCreateInputSchema,
    outputSchema: financeAccountCreateOutputSchema,
    resultCap: 1,
    guidance: {
      whenToUse: 'A sheet label or sync source needs an account that does not exist yet.',
      whenNotToUse: 'Do not use to rename, close, or merge an existing account.',
      produces: ['account ids', 'account names'],
    },
  },
  async (ownerUserId, input) =>
    createOrGetAccount({
      userId: ownerUserId,
      name: input.name,
      currencyCode: input.currencyCode,
      ...(input.institution ? { institution: input.institution } : {}),
      ...(input.accountNumber ? { mask: input.accountNumber } : {}),
      status: input.status,
      accountType: input.accountType,
      dryRun: input.dryRun,
    }),
);

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
    name: 'finance_transaction_upsert',
    title: 'Finance Transaction Upsert',
    description:
      'Upsert a single finance transaction. Idempotent on the natural key (postedOn, account, description, amountCents, currencyCode). Unknown accounts are rejected, never auto-created. A rejected row returns reason and null id instead of failing the call.',
    inputSchema: financeTransactionUpsertInputSchema,
    outputSchema: financeTransactionUpsertOutputSchema,
    resultCap: 1,
    guidance: {
      whenToUse: 'Pushing one sheet row or correcting a single transaction.',
      whenNotToUse: 'Do not invent account labels; resolve them via finance_accounts first.',
      dependencies: [
        { tool: 'finance_accounts', reason: 'resolve the account id', provides: ['id'] },
      ],
    },
  },
  async (ownerUserId, input) => upsertFinanceTransaction(ownerUserId, input),
);

registerTool(
  {
    ...financeWriteTool,
    destructive: true,
    requiresConfirmation: true,
    name: 'finance_transaction_delete',
    title: 'Finance Transaction Delete',
    description:
      'Hard-delete finance transactions by id (1–200). Requires iUnderstand: true — that flag is the confirmation contract and the server never elicits on top of it. Unknown ids come back in notFound, never as an error.',
    inputSchema: financeTransactionDeleteInputSchema,
    outputSchema: financeTransactionDeleteOutputSchema,
    resultCap: 200,
    guidance: {
      whenToUse: 'Removing a synthetic, duplicate or bad-sync transaction by id.',
      whenNotToUse: 'Do not guess ids; resolve them via finance_transaction_search first.',
      dependencies: [
        {
          tool: 'finance_transaction_search',
          reason: 'resolve the stable transaction id',
          provides: ['id'],
        },
      ],
    },
    // §4: iUnderstand is the confirmation contract — eliciting on top of it hard-fails every
    // MCP client without an elicitation handler (the B5 lesson). Returning null skips the
    // protocol prompt; the handler refuses without the flag with a named error instead.
    preview: async () => null,
  },
  async (ownerUserId, input) => {
    if (!input.iUnderstand) {
      throw new ValidationError('confirmation_required');
    }
    const { deleted, notFound } = await deleteTransactionsByIds(ownerUserId, input.ids);
    return {
      deleted: deleted.map((row) => ({
        id: row.id,
        postedOn: row.postedOn,
        accountId: row.accountId,
        description: row.description,
        amountCents: toCents(row.amount),
        currencyCode: row.currencyCode,
      })),
      notFound,
    };
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
  async (ownerUserId, input) => renameTag(ownerUserId, input),
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

registerTool(
  {
    ...financeWriteTool,
    destructive: true,
    requiresConfirmation: true,
    name: 'finance_transactions_import',
    title: 'Finance Transactions Import',
    description:
      'Batch upsert for backfill and daily deltas (max 1000 per call). Mode append adds/updates; mode replace wipes the finance store first. dryRun validates without writing. Per-row rejections never fail the batch.',
    inputSchema: financeTransactionsImportInputSchema,
    outputSchema: financeTransactionsImportOutputSchema,
    resultCap: 1000,
    guidance: {
      whenToUse: 'Backfilling sheet history or pushing daily deltas.',
      whenNotToUse: 'Do not use mode replace without explicit confirmation.',
      dependencies: [
        { tool: 'finance_accounts', reason: 'build the sheet-label map', provides: ['id'] },
      ],
    },
    preview: async (_ownerUserId, input) => {
      const parsed = financeTransactionsImportInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const { mode, dryRun, iUnderstand, transactions } = parsed.data;
      // Confirmation is only needed for a real wipe. A dry run writes nothing, and
      // `iUnderstand: true` is the tool's documented confirmation contract for replace —
      // the service already enforces both (it refuses replace without iUnderstand and a
      // matching prior dry run). Eliciting on top of that hard-fails every MCP client
      // that does not declare the elicitation capability, so skip it in both cases.
      if (mode !== 'replace') return null;
      if (dryRun || iUnderstand) return null;
      return { mode: 'replace', count: transactions.length, dryRun };
    },
  },
  async (ownerUserId, input) => importFinanceTransactions(ownerUserId, input),
);
