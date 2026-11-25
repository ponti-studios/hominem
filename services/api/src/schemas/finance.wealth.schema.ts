import { starlingFeedSchema } from '@hominem/finance-services/ingest';
import { z } from 'zod';

const date = z.iso.date();
const amounts = z.record(z.string(), z.number().finite());

const billRecord = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string().nullable(),
  kind: z.string(),
  amount_model: z.string(),
  expected_amount: z.number().nullable(),
  currency: z.string(),
  cadence: z.string().nullable(),
  due_day: z.number().nullable(),
  status: z.string(),
  type: z.string(),
  next_due: date.nullable(),
  last_paid_on: date.nullable(),
  match_configured: z.boolean(),
  created_on: date.nullable(),
});

const snapshot = z.object({ bills: z.array(billRecord) });

export const financeWealthBriefInputSchema = z
  .object({
    date: date.optional(),
    run_id: z.number().int().optional(),
    bills_only: z.boolean().default(false),
    snapshot: snapshot.nullable().optional(),
  })
  .strict();

const briefFlag = z.object({
  type: z.string(),
  merchant: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  count: z.number().optional(),
  detail: z.string(),
});

const billFlag = z.object({
  type: z.string(),
  bill: z.string(),
  provider: z.string().nullable().optional(),
  previous_amount: z.number().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  due_date: z.string().optional(),
  last_paid_on: z.string().nullable().optional(),
  detail: z.string(),
});

const pacing = z.object({
  category: z.string(),
  currency: z.string(),
  budget: z.number(),
  month_to_date: z.number(),
  expected_by_now: z.number().optional(),
  projected_month_end: z.number().optional(),
  month: z.string().optional(),
  day_of_month: z.number().optional(),
  days_in_month: z.number().optional(),
  reason: z.string().optional(),
  over_budget: z.boolean().optional(),
  components: z
    .record(
      z.string(),
      z.object({
        budget: z.number(),
        month_to_date: z.number(),
        over_tag_budget: z.boolean(),
      }),
    )
    .optional(),
  mix_note: z.string().optional(),
});

const largeItem = z.object({
  merchant: z.string(),
  description: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  category: z.string().nullable(),
  postedOn: z.string(),
});

export const financeWealthBriefOutputSchema = z.object({
  ok: z.boolean(),
  date,
  sections: z.object({
    money_in_out: z
      .object({
        per_currency: z.record(
          z.string(),
          z.object({ in: z.number(), out: z.number(), net: z.number(), count: z.number() }),
        ),
        large_items: z.array(largeItem),
      })
      .optional(),
    budget_pacing: z.array(pacing).optional(),
    anomalies: z.array(briefFlag).optional(),
    bills: z
      .object({
        baseline_created: z.boolean().optional(),
        active_bills: z.number(),
        previous_bills: z.number().optional(),
        due_soon: z.array(
          z.object({
            bill: z.string(),
            provider: z.string().nullable(),
            date: z.string().nullable(),
            amount: z.number().nullable(),
            currency: z.string(),
          }),
        ),
        flags: z.array(billFlag).optional(),
      })
      .optional(),
    diagnostics: z.object({
      yesterday: date,
      yesterday_truncated: z.number().optional(),
      pacing_skipped: z.string().optional(),
      pacing_all: z.record(z.string(), pacing).optional(),
      hominem_calls: z.number(),
      source_errors: z.record(z.string(), z.string()).optional(),
    }),
  }),
  silent: z.boolean(),
  run_id: z.number().int().nullable(),
  snapshot: snapshot.nullable(),
});

const salary = z.object({
  query: z
    .string()
    .min(1)
    .describe('Case-insensitive text in a payroll merchant name or description.'),
  min_amount: z.number().finite(),
  currency: z.string().min(1),
  lookback_days: z.number().int().nonnegative(),
  label: z.string(),
});

export const financeWealthLookInputSchema = z
  .object({
    as_of: date.optional(),
    inputs: z
      .object({
        balance_floors: z.record(z.string(), z.number().finite().nullable()).optional(),
        credit_limits_usd: amounts.optional(),
        salary: salary.optional(),
      })
      .strict()
      .optional(),
    fx: z
      .object({
        rate_usd_to_gbp: z.number().finite().positive(),
        rate_date: date.nullable().optional(),
        rate_source: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const timeline = z.object({
  date,
  label: z.string(),
  amount: z.number(),
  currency: z.string(),
  source: z.string(),
  inferred: z.boolean(),
});

const pinch = z.object({
  currency: z.string(),
  starting_balance: z.number(),
  floor: z.number().nullable(),
  days_below_floor: z.array(z.object({ date, projected_balance: z.number() })),
  large_outflow_days: z.array(z.object({ date, total_outflows: z.number() })),
  min_projected: z.object({ date, balance: z.number() }),
  ending_balance: z.number(),
  daily: z.array(
    z.object({ date, in: z.number(), out: z.number(), projected_balance: z.number() }),
  ),
});

export const financeWealthLookOutputSchema = z.object({
  ok: z.boolean(),
  as_of: date,
  horizon_days: z.number(),
  horizon: z.object({ from: date, to: date }),
  sections: z.object({
    timeline_gbp: z.array(timeline),
    timeline_usd: z.array(timeline),
    pinch_points: z.record(z.string(), pinch).optional(),
    runway: z
      .object({
        tool: z.string(),
        parameters: z.object({
          asOf: date,
          projectionWeeks: z.number(),
          monthlyBudgets: z.array(z.object({ category: z.string(), amountCents: z.number() })),
          note: z.string(),
        }),
        raw: z.record(z.string(), z.unknown()),
        appears_zero_or_empty: z.boolean(),
        verdict: z.string().nullable(),
        reconciled_against: z.object({
          liquid_balances: amounts,
          liquid_accounts: z.record(
            z.string(),
            z.array(z.object({ account: z.string(), balance: z.number() })),
          ),
        }),
      })
      .optional(),
    utilisation: z
      .array(
        z.object({
          card: z.string(),
          currency: z.string(),
          balance_owed: z.number(),
          limit: z.number().nullable(),
          utilisation_pct: z.number().nullable(),
          reason: z.string().optional(),
        }),
      )
      .optional(),
    fx_runway: z
      .object({
        usd_liquid_balance: z.number(),
        rate_usd_to_gbp: z.number(),
        rate_date: z.string().nullable(),
        rate_source: z.string(),
        usd_in_gbp: z.number(),
        average_monthly_gbp_spend: z.number(),
        spend_window: z.object({ from: date, to: date }),
        months_of_gbp_cover: z.number().nullable(),
      })
      .optional(),
    diagnostics: z.object({
      hominem_calls: z.number(),
      bills: z.object({
        bill_count: z.number(),
        variable_due: z.array(
          z.object({
            bill: z.string(),
            provider: z.string().nullable(),
            date,
            currency: z.string(),
          }),
        ),
        topups: z.array(
          z.object({ bill: z.string(), provider: z.string().nullable(), payg: z.unknown() }),
        ),
        inactive: z.array(z.string()),
      }),
      inferences: z.array(z.string()),
      notes: z.array(z.string()),
      source_errors: z.record(z.string(), z.string()).optional(),
    }),
  }),
});

const anchor = z.object({
  date,
  label: z.string(),
  totals: amounts.optional(),
  blended_gbp: z.number().finite().optional(),
  basis: z.string(),
});

export const financeWealthCloseInputSchema = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
    today: date.optional(),
    anchors: z
      .object({ anchors: z.array(anchor).optional(), tax_status: z.array(z.string()).optional() })
      .optional(),
    cache: z
      .object({
        spending: z
          .object({
            categories: z
              .array(
                z.object({
                  categoryName: z.string(),
                  currencyCode: z.string(),
                  spent: z.number().finite(),
                }),
              )
              .optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .strict();

export const financeWealthCloseOutputSchema = z.object({
  md: z.string(),
  calls: z.number().int(),
  message: z.string(),
});

const plaidAccount = z.object({
  account_id: z.string(),
  mask: z.string().nullable().optional(),
  type: z.string().optional(),
  balances: z
    .object({
      current: z.number().finite().nullable().optional(),
      iso_currency_code: z.string().nullable().optional(),
    })
    .optional(),
});

export const financeWealthIntegrityInputSchema = z
  .object({
    date: date.optional(),
    run_id: z.number().int().optional(),
    sync_state: z.object({ starling_max: date.optional(), plaid_max: date.optional() }).optional(),
    manual_anchors: z.record(z.string(), z.number().finite().nonnegative()).optional(),
    cancellation_watches: z
      .array(
        z.object({
          id: z.string().optional(),
          merchant: z.string().optional(),
          status: z.string().optional(),
          escalate_if: z.string().optional(),
        }),
      )
      .optional(),
    sweep_from: date.optional(),
    plaid: z
      .object({
        accounts: z.array(plaidAccount),
        transactions: z
          .array(
            z.object({
              account_id: z.string(),
              date,
              amount: z.number().finite(),
              pending: z.boolean().optional(),
            }),
          )
          .default([]),
        transactions_since: date.optional(),
        liabilities: z
          .object({
            accounts: z.array(
              z.object({ account_id: z.string(), mask: z.string().nullable().optional() }),
            ),
            liabilities: z.object({
              credit: z.array(
                z.object({
                  account_id: z.string(),
                  last_statement_balance: z.number().finite().nullable().optional(),
                  last_statement_issue_date: date.nullable().optional(),
                  last_payment_due_date: date.nullable().optional(),
                  next_payment_due_date: date.nullable().optional(),
                }),
              ),
            }),
          })
          .optional(),
        liabilities_skipped: z
          .array(z.object({ institution: z.string().optional(), error: z.string() }))
          .optional(),
      })
      .strict()
      .optional(),
    starling: z
      .object({ feeds: z.array(starlingFeedSchema).max(100) })
      .strict()
      .optional(),
  })
  .strict();

export const financeWealthIntegrityOutputSchema = z.object({
  ok: z.boolean(),
  date,
  flags: z.array(
    z.object({
      check: z.string(),
      account: z.string().nullable(),
      detail: z.string(),
      severity: z.enum(['flag', 'info']),
    }),
  ),
  info: z.record(z.string(), z.unknown()),
  run_id: z.number().int().nullable(),
});

export type FinanceWealthBriefInput = z.output<typeof financeWealthBriefInputSchema>;
export type FinanceWealthBriefOutput = z.output<typeof financeWealthBriefOutputSchema>;
export type FinanceWealthLookInput = z.output<typeof financeWealthLookInputSchema>;
export type FinanceWealthLookOutput = z.output<typeof financeWealthLookOutputSchema>;
export type FinanceWealthCloseInput = z.output<typeof financeWealthCloseInputSchema>;
export type FinanceWealthIntegrityInput = z.output<typeof financeWealthIntegrityInputSchema>;
export type FinanceWealthIntegrityOutput = z.output<typeof financeWealthIntegrityOutputSchema>;
