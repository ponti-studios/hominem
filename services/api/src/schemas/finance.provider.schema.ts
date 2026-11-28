import {
  syncDoctrineSchema,
  doctrineImportOutputSchema,
} from '@hominem/finance-services/finance.doctrine.schema';
import { z } from 'zod';

import { financeAccountCreateInputSchema } from './finance.schema';

const starlingAccountSchema = z.object({
  accountUid: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  accountType: z.string().optional(),
  currency: financeAccountCreateInputSchema.shape.currencyCode,
});

export const financeSeedInputSchema = z
  .object({
    accounts: z.array(starlingAccountSchema).min(1).max(500),
    doctrine: syncDoctrineSchema.optional(),
  })
  .strict();

export const financeSeedOutputSchema = z.object({
  ok: z.boolean(),
  doctrine: doctrineImportOutputSchema
    .pick({ status: true, fingerprint: true, ruleCounts: true })
    .nullable(),
  doctrine_note: z.string().optional(),
  accounts: z.array(
    z.object({
      name: z.string(),
      provider_account_id: z.string(),
      created: z.boolean(),
      id: z.string(),
    }),
  ),
});

const starlingMoneySchema = z
  .object({
    minorUnits: z.union([z.number().finite(), z.string().regex(/^-?\d+(\.\d+)?$/)]),
  })
  .nullable()
  .optional();

export const financeBalancesInputSchema = z
  .object({
    at: z.iso.datetime(),
    accounts: z
      .array(
        z.object({
          account: starlingAccountSchema,
          balance: z.object({
            currency: financeAccountCreateInputSchema.shape.currencyCode.optional(),
            clearedBalance: starlingMoneySchema,
            effectiveBalance: starlingMoneySchema,
            pendingTransactions: starlingMoneySchema,
            acceptedOverdraft: starlingMoneySchema,
          }),
          savingsGoalList: z
            .array(
              z.object({
                savingsGoalUid: z.string().optional(),
                name: z.string().nullable().optional(),
                totalSaved: starlingMoneySchema,
                target: starlingMoneySchema,
              }),
            )
            .max(1000),
        }),
      )
      .max(500),
    notes: z.array(z.string().max(500)).max(500),
  })
  .strict();

export const financeBalancesOutputSchema = z.object({
  accounts: z.array(
    z.object({
      accountUid: z.string(),
      name: z.string(),
      accountType: z.string(),
      currency: z.string(),
      cleared: z.number(),
      effective: z.number(),
      pending: z.number(),
      overdraft: z.number(),
      spaces: z.array(
        z.object({ name: z.string(), saved: z.number(), target: z.number().nullable() }),
      ),
    }),
  ),
  totals: z.array(z.object({ currency: z.string(), total: z.number() })),
  notes: z.array(z.string()),
  text: z.string(),
});
