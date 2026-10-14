import { z } from 'zod';

export const financeMonthlySummaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const financeMonthlySummarySchema = z.object({
  month: z.string(),
  startsOn: z.string(),
  endsBefore: z.string(),
  currencyCode: z.string(),
  totalSpent: z.number(),
  totalIncome: z.number(),
  transactionCount: z.number().int().nonnegative(),
  topMerchants: z.array(
    z.object({
      merchantName: z.string(),
      totalSpent: z.number(),
      transactionCount: z.number().int().nonnegative(),
    }),
  ),
  transactions: z.array(
    z.object({
      transactionId: z.string().uuid(),
      accountId: z.string().uuid(),
      accountName: z.string(),
      institutionName: z.string().nullable(),
      postedOn: z.string(),
      amount: z.number(),
      transactionType: z.string(),
      merchantName: z.string().nullable(),
    }),
  ),
});

// ── MCP tools ────────────────────────────────────────────────────────

function isIsoDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD).')
  .refine(isIsoDate, 'Invalid ISO date.');

const mcpLimitSchema = z.number().int().min(1).max(50);

// -- finance_net_worth --

const financeAccountBalanceSchema = z.object({
  accountId: z.string(),
  name: z.string(),
  institution: z.string().nullable(),
  accountType: z.string(),
  currencyCode: z.string(),
  balanceCents: z.number().int(),
  balanceAsOf: z.string().nullable(),
});

export const financeNetWorthInputSchema = z.object({
  includeClosed: z
    .boolean()
    .default(false)
    .describe('Whether to include closed accounts in the current balance totals.'),
});

export const financeNetWorthOutputSchema = z.object({
  asOf: z.string(),
  totals: z.array(
    z.object({
      currencyCode: z.string(),
      totalCents: z.number().int(),
      accountCount: z.number().int().min(0),
    }),
  ),
  accounts: z.array(financeAccountBalanceSchema),
  warnings: z.array(z.string()),
});

// -- finance_recent_transactions --

export const financeTransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  postedOn: z.string(),
  description: z.string().nullable(),
  merchantName: z.string().nullable(),
  amountCents: z.number().int(),
  currencyCode: z.string(),
  transactionType: z.string(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  tags: z.array(z.string()),
  notes: z.string().nullable(),
  orderNumber: z
    .string()
    .nullable()
    .describe('Read back out of notes; the write DTO folds it in as an "Order #: <value>" line.'),
  source: z.string().nullable(),
  recurring: z.boolean(),
  pending: z.boolean(),
  excluded: z.boolean(),
  counterpartId: z
    .string()
    .nullable()
    .describe('Other leg of an internal transfer; mirrored on both rows.'),
});

export const financeRecentTransactionsInputSchema = z
  .object({
    accountId: z.string().optional().describe('Stable account ID returned by a finance tool.'),
    from: isoDateSchema
      .optional()
      .describe('Inclusive ISO calendar date (YYYY-MM-DD) in the user timezone.'),
    to: isoDateSchema
      .optional()
      .describe('Inclusive ISO calendar date (YYYY-MM-DD) in the user timezone.'),
    limit: mcpLimitSchema
      .default(20)
      .describe('Maximum number of transactions to return, from 1 to 50.'),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from must be on or before to.',
        path: ['to'],
      });
    }
  });

export const financeRecentTransactionsOutputSchema = z.object({
  transactions: z.array(financeTransactionSchema),
  count: z.number().int().min(0),
});

// -- finance_spending_by_category --

export const financeSpendingByCategoryInputSchema = z
  .object({
    from: isoDateSchema
      .optional()
      .describe('Inclusive ISO calendar date (YYYY-MM-DD) in the user timezone.'),
    to: isoDateSchema
      .optional()
      .describe('Inclusive ISO calendar date (YYYY-MM-DD) in the user timezone.'),
    limit: mcpLimitSchema
      .default(20)
      .describe('Maximum number of categories to return, from 1 to 50.'),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from must be on or before to.',
        path: ['to'],
      });
    }
  });

export const financeSpendingByCategoryOutputSchema = z.object({
  from: z.string(),
  to: z.string(),
  currencyCode: z.string().nullable(),
  categories: z.array(
    z.object({
      categoryId: z.string(),
      categoryName: z.string(),
      spentCents: z.number().int(),
      transactionCount: z.number().int(),
    }),
  ),
  warnings: z.array(z.string()),
});

// -- shared filters for the report tools --

const dateRangeFields = {
  from: isoDateSchema
    .optional()
    .describe('Inclusive ISO calendar date (YYYY-MM-DD) in the user timezone.'),
  to: isoDateSchema
    .optional()
    .describe('Inclusive ISO calendar date (YYYY-MM-DD) in the user timezone.'),
};

function rejectInvertedRange(
  value: { from?: string | undefined; to?: string | undefined },
  context: z.RefinementCtx,
) {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'from must be on or before to.',
      path: ['to'],
    });
  }
}

const accountIdField = z
  .string()
  .uuid()
  .optional()
  .describe('Stable account ID returned by finance_accounts.');

const tagField = z
  .string()
  .min(1)
  .optional()
  .describe('Restrict to transactions carrying this tag, given as a tag id or a tag name.');

// -- finance_accounts --

export const financeAccountsInputSchema = z.object({
  includeClosed: z.boolean().default(false).describe('Whether to include closed accounts.'),
});

export const financeAccountsOutputSchema = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      accountType: z.string(),
      currencyCode: z.string(),
      lifecycleStatus: z.string(),
      includeInNetWorth: z.boolean(),
      balanceCents: z.number().int(),
    }),
  ),
  count: z.number().int().min(0),
  totalCount: z
    .number()
    .int()
    .min(0)
    .describe('Total visible accounts before the 50-account result cap.'),
});

// -- finance_account_create --

const accountTypeSchema = z.enum([
  'cash',
  'checking',
  'credit_card',
  'investment',
  'loan',
  'other',
  'retirement',
  'savings',
]);

export const financeAccountCreateInputSchema = z.object({
  name: z.string().trim().min(1, 'invalid_name').describe('Display name of the account.'),
  currencyCode: z
    .string()
    .regex(/^[A-Za-z]{3}$/, 'invalid_currency')
    .describe('ISO 4217 currency code, e.g. USD or GBP.'),
  institution: z.string().optional().describe('Institution name, e.g. Wise.'),
  accountNumber: z.string().optional().describe('Mask / last digits as displayed elsewhere.'),
  status: z.enum(['open', 'closed']).default('open').describe('Account lifecycle status.'),
  accountType: accountTypeSchema
    .default('checking')
    .describe(
      'Account type; cash/checking/savings count as liquid in finance_runway, so pick it deliberately.',
    ),
  dryRun: z.boolean().default(false).describe('Report the outcome without writing.'),
});

export const financeAccountCreateOutputSchema = z.object({
  id: z.string().nullable().describe('Account id; null on a dry run that would create.'),
  name: z.string(),
  currencyCode: z.string(),
  status: z.string(),
  created: z.boolean(),
});

// -- finance_account_summary --

export const financeAccountSummaryInputSchema = z.object({
  accountId: z
    .string()
    .uuid()
    .optional()
    .describe('Restrict to a single account; omit to summarize every account.'),
  includeClosed: z
    .boolean()
    .default(true)
    .describe('Include closed accounts (default true — reconciliation must see everything).'),
});

export const financeAccountSummaryOutputSchema = z.object({
  accounts: z.array(
    z.object({
      accountId: z.string(),
      accountName: z.string(),
      status: z.string(),
      transactionCount: z.number().int().min(0),
      excludedCount: z.number().int().min(0),
      totals: z.array(z.object({ currencyCode: z.string(), sumCents: z.number().int() })),
      minPostedOn: z.string().nullable(),
      maxPostedOn: z.string().nullable(),
    }),
  ),
  count: z.number().int().min(0),
  totalCount: z
    .number()
    .int()
    .min(0)
    .describe('Total accounts before the result cap, so truncation is visible.'),
});

// -- finance_top_merchants --

const financeTopMerchantsFieldsSchema = z.object({
  ...dateRangeFields,
  accountId: accountIdField,
  tag: tagField,
  limit: mcpLimitSchema.default(10).describe('Maximum merchants to return, from 1 to 50.'),
});

export const financeTopMerchantsInputSchema =
  financeTopMerchantsFieldsSchema.superRefine(rejectInvertedRange);

export const financeTopMerchantsOutputSchema = z.object({
  merchants: z.array(
    z.object({
      name: z.string(),
      totalSpentCents: z.number().int(),
      transactionCount: z.number().int().min(0),
    }),
  ),
  count: z.number().int().min(0),
  currencyCode: z
    .string()
    .nullable()
    .describe('Null when spending spans multiple currencies; see warnings.'),
  warnings: z.array(z.string()),
});

// -- finance_tag_breakdown --

const financeTagBreakdownFieldsSchema = z.object({
  ...dateRangeFields,
  accountId: accountIdField,
  tag: tagField,
  limit: mcpLimitSchema.default(5).describe('Maximum tags to return, from 1 to 50.'),
});

export const financeTagBreakdownInputSchema =
  financeTagBreakdownFieldsSchema.superRefine(rejectInvertedRange);

export const financeTagBreakdownOutputSchema = z.object({
  breakdown: z.array(
    z.object({
      tag: z.string(),
      amountCents: z.number().int(),
      percentage: z.number(),
      transactionCount: z.number().int().min(0),
    }),
  ),
  totalSpendingCents: z.number().int(),
  averagePerDayCents: z.number().int(),
  currencyCode: z
    .string()
    .nullable()
    .describe('Null when spending spans multiple currencies; see warnings.'),
  warnings: z.array(z.string()),
});

// -- shared REST query variants --
//
// The REST tag-breakdown and top-merchants routes take these same filters as query-string
// params: `account` (not `accountId`) and a stringly-typed `limit`. Normalize those into the
// MCP tools' shape and validate with the same schema objects, so the two adapters can't drift
// apart on what counts as a valid date or account id. `limit` is the one field REST and MCP
// genuinely need to differ on: MCP caps it at 50 to protect an LLM's context budget, but REST
// pages (e.g. the finance app's tag-breakdown view) reasonably ask for up to 100 rows to render
// a full table — so REST gets its own, higher-ceiling limit schema instead of `mcpLimitSchema`.

const REST_ACCOUNT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REST_LIMIT_MAX = 100;

function normalizeReportQuery(raw: unknown): Record<string, unknown> {
  const query = z.record(z.string(), z.unknown()).catch({}).parse(raw);
  const account = typeof query.account === 'string' ? query.account : undefined;
  return {
    ...(typeof query.from === 'string' ? { from: query.from } : {}),
    ...(typeof query.to === 'string' ? { to: query.to } : {}),
    // Web clients may send a non-UUID sentinel (e.g. "all") for the account filter.
    ...(account && REST_ACCOUNT_UUID.test(account) ? { accountId: account } : {}),
    ...(typeof query.tag === 'string' ? { tag: query.tag } : {}),
    ...(typeof query.limit === 'string' ? { limit: Number(query.limit) } : {}),
  };
}

const restLimitSchema = z.number().int().min(1).max(REST_LIMIT_MAX);

export const financeTopMerchantsQuerySchema = z.preprocess(
  normalizeReportQuery,
  financeTopMerchantsFieldsSchema
    .extend({ limit: restLimitSchema.default(10) })
    .superRefine(rejectInvertedRange),
);

export const financeTagBreakdownQuerySchema = z.preprocess(
  normalizeReportQuery,
  financeTagBreakdownFieldsSchema
    .extend({ limit: restLimitSchema.default(5) })
    .superRefine(rejectInvertedRange),
);

// -- finance_monthly_stats --

export const financeMonthlyStatsInputSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected a month as YYYY-MM.')
    .optional()
    .describe('Month as YYYY-MM. Defaults to the current month.'),
});

export const financeMonthlyStatsOutputSchema = z.object({
  month: z.string(),
  incomeCents: z.number().int(),
  expensesCents: z.number().int(),
  netCents: z.number().int(),
  transactionCount: z.number().int().min(0),
  averageTransactionCents: z.number().int(),
  topTag: z.string(),
  topMerchant: z.string(),
  tagSpending: z.array(z.object({ name: z.string(), amountCents: z.number().int() })),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  currencyCode: z
    .string()
    .nullable()
    .describe('Null when spending spans multiple currencies; see warnings.'),
  warnings: z.array(z.string()),
});

// -- finance_transaction_search --

export const financeTransactionSearchInputSchema = z
  .object({
    query: z
      .string()
      .min(1)
      .optional()
      .describe('Case-insensitive text matched against descriptions and merchant names.'),
    ...dateRangeFields,
    accountId: accountIdField,
    tag: tagField,
    limit: mcpLimitSchema.default(20).describe('Maximum transactions to return, from 1 to 50.'),
    offset: z.number().int().min(0).default(0).describe('Number of matches to skip, for paging.'),
  })
  .superRefine(rejectInvertedRange);

export const financeTransactionSearchOutputSchema = z.object({
  transactions: z.array(financeTransactionSchema),
  count: z.number().int().min(0),
  filteredCount: z.number().int().min(0),
});

// -- finance_runway --

export const financeRunwayInputSchema = z.object({
  monthlyBudgets: z
    .array(
      z.object({
        category: z.string().min(1),
        amountCents: z.number().int().min(0),
        note: z.string().optional(),
      }),
    )
    .default([])
    .describe(
      'Optional monthly spending caps per category, in cents, used as the flat variable allowance.',
    ),
  projectionWeeks: z
    .number()
    .int()
    .min(1)
    .max(52)
    .default(16)
    .describe('Number of weeks to project, from 1 to 52.'),
  asOf: isoDateSchema.optional().describe('Projection start date. Defaults to today.'),
});

export const financeRunwayOutputSchema = z.object({
  asOfDate: z.string(),
  liquidAccounts: z.array(z.object({ accountName: z.string(), balanceCents: z.number().int() })),
  currencyCode: z
    .string()
    .nullable()
    .describe(
      'Currency of startingCashCents and the weekly projection. When liquid accounts span ' +
        'multiple currencies, only the dominant-currency accounts are included; see warnings.',
    ),
  warnings: z.array(z.string()),
  startingCashCents: z.number().int(),
  weeklyRecurringOutflowCents: z.number().int(),
  recurringLookbackMonths: z.number(),
  recurringTxnCount: z.number().int().min(0),
  weeklyVariableAllowanceCents: z.number().int(),
  weeks: z.array(
    z.object({
      week: z.number().int(),
      weekStart: z.string(),
      weekEnd: z.string(),
      beginningCashCents: z.number().int(),
      recurringOutflowsCents: z.number().int(),
      variableAllowanceCents: z.number().int(),
      netChangeCents: z.number().int(),
      endingCashCents: z.number().int(),
    }),
  ),
});

// -- finance_budget_breakdown --

export const financeBudgetBreakdownInputSchema = z.object({
  monthlyIncomeCents: z.number().int().min(0).describe('Monthly take-home income, in cents.'),
  savingsTargetCents: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Desired monthly savings in cents. Capped at 20% of income.'),
});

export const financeBudgetBreakdownOutputSchema = z.object({
  needsCents: z.number().int(),
  wantsCents: z.number().int(),
  savingsCents: z.number().int(),
  unallocatedCents: z.number().int(),
});

// -- finance_categories --

export const financeCategoriesInputSchema = z.object({});

export const financeCategoriesOutputSchema = z.object({
  categories: z.array(z.object({ id: z.string(), name: z.string() })),
  count: z.number().int().min(0),
});

// -- finance_transaction_upsert --

const sheetTransactionPayloadSchema = z.object({
  postedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD).'),
  account: z.string().min(1).describe('Sheet Bank label or a Hominem account id.'),
  description: z.string().min(1).describe('Merchant text.'),
  amountCents: z.number().int().describe('Signed cents; negative = outflow.'),
  currencyCode: z.string().min(3).max(3).describe('ISO-4217 code.'),
  category: z
    .string()
    .nullable()
    .optional()
    .describe('Sheet Category name; blank/unknown → Uncategorized.'),
  tags: z.array(z.string()).optional().describe('Sheet Tags; comma-separated values also split.'),
  notes: z.string().max(2000).nullable().optional().describe('Sheet Notes.'),
  orderNumber: z.string().nullable().optional().describe('Sheet Order #; appended into notes.'),
  source: z.string().nullable().optional().describe('plaid | starling | manual; unknown → manual.'),
  excluded: z.boolean().default(false),
  recurring: z.boolean().default(false).describe('Sheet Recurring? column.'),
  transactionType: z.enum(['debit', 'credit', 'transfer']).optional(),
  pending: z
    .boolean()
    .default(false)
    .describe('v1 has no pending state — pending rows are rejected loudly.'),
  counterpartId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe(
      'Other leg of an internal transfer: an owned transaction on a different account. The link is mirrored on both rows; invalid targets are rejected as invalid_counterpart.',
    ),
});

const multiCurrencyAccountsSchema = z
  .array(z.string().min(1))
  .default([])
  .describe('Sheet labels or account ids exempt from the currency sanity check.');

export const financeTransactionUpsertInputSchema = sheetTransactionPayloadSchema.extend({
  accountMap: z
    .record(z.string(), z.string())
    .optional()
    .describe('Explicit { "Sheet Label": "hominem-account-id" } overrides.'),
  multiCurrencyAccounts: multiCurrencyAccountsSchema,
});

const sheetRejectionReasonSchema = z.enum([
  'unknown_account',
  'currency_mismatch',
  'invalid_posted_on',
  'invalid_amount',
  'invalid_currency',
  'invalid_description',
  'invalid_counterpart',
  'pending_row',
]);

export const financeTransactionUpsertOutputSchema = z.object({
  id: z.string().nullable(),
  created: z.boolean(),
  accountId: z.string().nullable(),
  reason: sheetRejectionReasonSchema
    .nullable()
    .describe('Row-level rejection reason; null when the row was accepted.'),
});

// -- finance_transactions_import --

export const financeTransactionsImportInputSchema = z.object({
  transactions: z
    .array(sheetTransactionPayloadSchema)
    .min(1)
    .max(1000)
    .describe('Batch of sheet rows, in order, max 1000 per call.'),
  mode: z.enum(['append', 'replace']).default('append'),
  dryRun: z.boolean().default(false).describe('Validate and report without writing.'),
  iUnderstand: z
    .boolean()
    .default(false)
    .describe('Explicit confirmation for mode: "replace", which wipes the store first.'),
  multiCurrencyAccounts: multiCurrencyAccountsSchema,
  accountMap: z
    .record(z.string(), z.string())
    .optional()
    .describe('Explicit { "Sheet Label": "hominem-account-id" } overrides.'),
});

export const financeTransactionsImportOutputSchema = z.object({
  received: z.number().int().min(0),
  upserted: z.number().int().min(0),
  created: z.number().int().min(0),
  updated: z.number().int().min(0),
  rejected: z.array(
    z.object({ index: z.number().int().min(0), reason: sheetRejectionReasonSchema }),
  ),
  accountsAutoProvisioned: z.array(z.string()),
});

// -- finance_transaction_delete --

export const financeTransactionDeleteInputSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200).describe('Transaction ids to delete (1–200).'),
  iUnderstand: z
    .boolean()
    .default(false)
    .describe('Must be true. This flag is the confirmation contract; the server never elicits.'),
});

export const financeTransactionDeleteOutputSchema = z.object({
  deleted: z.array(
    z.object({
      id: z.string(),
      postedOn: z.string(),
      accountId: z.string(),
      description: z.string().nullable(),
      amountCents: z.number().int(),
      currencyCode: z.string(),
    }),
  ),
  notFound: z.array(z.string()),
});

// -- finance_tag_rename / finance_tag_merge --

const tagMutationReasonSchema = z
  .enum(['invalid_name', 'target_exists', 'unknown_tag'])
  .describe('Stable machine-readable reason; null when the mutation succeeded.');

const tagMutationOutputShape = {
  assignmentsMoved: z.number().int().min(0),
  tag: z.object({ id: z.string(), name: z.string() }).nullable(),
  reason: tagMutationReasonSchema.nullable(),
};

export const financeTagRenameInputSchema = z.object({
  from: z.string().min(1).describe('Existing tag name, matched case-insensitively.'),
  to: z.string().min(1).describe('New display name.'),
});

export const financeTagRenameOutputSchema = z.object(tagMutationOutputShape);

export const financeTagMergeInputSchema = z.object({
  from: z.string().min(1).describe('Tag to fold away, matched case-insensitively.'),
  into: z.string().min(1).describe('Tag to keep, matched case-insensitively.'),
});

export const financeTagMergeOutputSchema = z.object(tagMutationOutputShape);

// -- finance_category_create / finance_category_merge --

const categoryMergeReasonSchema = z
  .enum(['protected_category', 'unknown_category'])
  .describe('Stable machine-readable reason; null when the merge succeeded.');

export const financeCategoryCreateInputSchema = z.object({
  name: z.string().trim().min(1, 'invalid_name').describe('Category name.'),
  dryRun: z.boolean().default(false).describe('Report the outcome without writing.'),
});

export const financeCategoryCreateOutputSchema = z.object({
  id: z.string().nullable().describe('Category id; null on a dry run that would create.'),
  name: z.string(),
  created: z.boolean(),
});

export const financeCategoryMergeInputSchema = z.object({
  from: z.string().min(1).describe('Category to fold away, by name or id.'),
  into: z.string().min(1).describe('Category to keep, by name or id.'),
  dryRun: z.boolean().default(false).describe('Count what would move without writing.'),
});

export const financeCategoryMergeOutputSchema = z.object({
  transactionsReassigned: z.number().int().min(0),
  category: z.object({ id: z.string(), name: z.string() }).nullable(),
  reason: categoryMergeReasonSchema.nullable(),
});

// -- finance_account_update --

const accountUpdateReasonSchema = z
  .enum([
    'currency_immutable',
    'invalid_name',
    'invalid_status_transition',
    'name_conflict',
    'unknown_account',
  ])
  .describe('Stable machine-readable reason; null when the update was accepted.');

export const financeAccountUpdateInputSchema = z.object({
  accountId: z
    .string()
    .uuid()
    .describe('Stable account id — names are mutable, so updates address by id, never by name.'),
  name: z
    .string()
    .optional()
    .describe('New display name; must stay unique per owner (case-insensitive).'),
  institution: z.string().nullable().optional().describe('Institution name; null clears it.'),
  accountNumber: z.string().nullable().optional().describe('Mask / last digits; null clears it.'),
  accountType: accountTypeSchema.optional(),
  status: z
    .enum(['open', 'closed', 'historical', 'unknown'])
    .optional()
    .describe('Lifecycle status; transitions are unrestricted.'),
  currencyCode: z
    .string()
    .optional()
    .describe('Immutable through this tool — any change is refused with currency_immutable.'),
  dryRun: z.boolean().default(false).describe('Project the change set without applying it.'),
});

export const financeAccountUpdateOutputSchema = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  currencyCode: z.string().nullable(),
  status: z.string().nullable(),
  updated: z.boolean().describe('False when every value already matched (an idempotent no-op).'),
  changes: z
    .record(z.string(), z.tuple([z.string().nullable(), z.string().nullable()]))
    .describe('Each altered field mapped to [from, to] — the audit record.'),
  reason: accountUpdateReasonSchema.nullable(),
});
