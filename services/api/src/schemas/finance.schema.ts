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

const financeTransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  postedOn: z.string(),
  description: z.string().nullable(),
  amountCents: z.number().int(),
  currencyCode: z.string(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  excluded: z.boolean(),
  transactionType: z.string(),
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
});

// -- finance_top_merchants --

export const financeTopMerchantsInputSchema = z
  .object({
    ...dateRangeFields,
    accountId: accountIdField,
    tag: tagField,
    limit: mcpLimitSchema.default(10).describe('Maximum merchants to return, from 1 to 50.'),
  })
  .superRefine(rejectInvertedRange);

export const financeTopMerchantsOutputSchema = z.object({
  merchants: z.array(
    z.object({
      name: z.string(),
      totalSpentCents: z.number().int(),
      transactionCount: z.number().int().min(0),
    }),
  ),
  count: z.number().int().min(0),
});

// -- finance_tag_breakdown --

export const financeTagBreakdownInputSchema = z
  .object({
    ...dateRangeFields,
    accountId: accountIdField,
    tag: tagField,
    limit: mcpLimitSchema.default(5).describe('Maximum tags to return, from 1 to 50.'),
  })
  .superRefine(rejectInvertedRange);

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
});

// -- finance_monthly_stats --

export const financeMonthlyStatsInputSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Expected a month as YYYY-MM.')
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
  transactions: z.array(
    z.object({
      id: z.string(),
      accountId: z.string(),
      postedOn: z.string(),
      description: z.string().nullable(),
      merchantName: z.string().nullable(),
      amountCents: z.number().int(),
      pending: z.boolean(),
      excluded: z.boolean(),
    }),
  ),
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
