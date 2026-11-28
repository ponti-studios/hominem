import {
  plaidBodySchema,
  starlingFeedSchema,
  syncRowSchema,
} from '@hominem/finance-services/ingest';
import { z } from 'zod';

import { financeTransactionsImportOutputSchema } from './finance.schema';

export const financeSyncInputSchema = z
  .object({
    starling: z.array(starlingFeedSchema).max(1000).default([]),
    plaid: plaidBodySchema.optional(),
    windows: z.object({
      starling_since: z.iso.date(),
      plaid_since: z.iso.date(),
      until: z.iso.date(),
    }),
    dryRun: z.boolean().default(false),
    linkTransfers: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.starling.reduce((count, feed) => count + feed.feedItems.length, 0) +
        (value.plaid?.transactions?.length ?? 0) >
      1000
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A sync may contain at most 1000 provider transactions.',
      });
    }
    if (
      value.windows.starling_since > value.windows.until ||
      value.windows.plaid_since > value.windows.until
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Sync windows must end on or after their start.',
      });
    }
  });

export const financeSyncOutputSchema = financeTransactionsImportOutputSchema.extend({
  ok: z.boolean(),
  added: z.number().int().nonnegative(),
  by_source: z.record(z.string(), z.number().int().nonnegative()),
  held: z.array(syncRowSchema),
  new_labels: z.array(z.string()),
  unmapped: z.array(
    z.object({
      date: z.string(),
      account: z.string(),
      description: z.string(),
      amount: z.number(),
    }),
  ),
  linked: z.array(z.string()),
  windows: financeSyncInputSchema.shape.windows,
  watermarks: z.object({
    starling_max: z.string().nullable(),
    plaid_max: z.string().nullable(),
  }),
  warnings: z.array(z.string()),
});
