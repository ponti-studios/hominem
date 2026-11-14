import { z } from 'zod';

const ruleText = z.string().trim().min(1).max(300);

export const rulingRulebookSchema = z
  .object({
    categories: z.array(ruleText).min(1).max(200),
    tags: z.array(ruleText).max(500),
    merchantRules: z
      .array(
        z.object({
          merchant: ruleText,
          category: ruleText,
          tags: z.array(ruleText).max(100),
        }),
      )
      .max(5000),
    categoryRules: z.array(z.object({ pattern: ruleText, category: ruleText })).max(5000),
    tagRules: z.array(z.object({ pattern: ruleText, tags: z.array(ruleText).max(100) })).max(5000),
    coffeePatterns: z.array(ruleText).max(1000),
  })
  .strict();

export const rulingRulebookImportInputSchema = z
  .object({
    fingerprint: z.string().trim().min(1).max(128),
    rulebook: rulingRulebookSchema,
  })
  .strict();

export const rulingRowSchema = z.object({
  id: z.string(),
  externalId: z.string().nullable(),
  description: z.string(),
  postedOn: z.string(),
  amountCents: z.number().int(),
  currencyCode: z.string(),
  excluded: z.boolean(),
  before: z
    .object({
      accountId: z.string(),
      accountName: z.string(),
      categoryId: z.string().nullable(),
      categoryName: z.string().nullable(),
      tags: z.array(z.string()),
      source: z.string().nullable(),
      pending: z.boolean(),
    })
    .optional(),
});

const verdictIdentity = {
  preparationId: z.string().uuid(),
  clusterId: z.string().min(1).max(128),
  rowIds: z
    .array(z.string().min(1))
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length),
};
export const rulingVerdictInputSchema = z.discriminatedUnion('verdict', [
  z.object({ ...verdictIdentity, verdict: z.literal('kill') }).strict(),
  z.object({ ...verdictIdentity, verdict: z.literal('file') }).strict(),
  z
    .object({
      ...verdictIdentity,
      verdict: z.literal('change'),
      category: ruleText,
      tags: z.array(ruleText).max(100),
    })
    .strict(),
]);

export const rulingQueueInputSchema = z
  .object({
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

export const rulingQueueOutputSchema = z.object({
  total: z.number().int().nonnegative(),
  verdicts: z.array(
    z.object({
      id: z.string(),
      preparationId: z.string(),
      clusterId: z.string(),
      merchant: z.string(),
      verdict: z.enum(['kill', 'file', 'change']),
      category: z.string().nullable(),
      tags: z.array(z.string()),
      rows: z.array(rulingRowSchema),
      createdAt: z.string(),
      status: z.enum(['queued', 'filing', 'filed', 'failed']),
      events: z.array(
        z.object({
          eventType: z.string(),
          details: z.unknown(),
          createdAt: z.string(),
        }),
      ),
    }),
  ),
});

export const rulingSnapshotSchema = z.object({
  clusters: z.array(
    z.object({
      id: z.string(),
      merchant: z.string(),
      lane: z.enum(['live', 'archive']),
      rows: z.array(rulingRowSchema),
      totals: z.record(z.string(), z.number()),
      firstDate: z.string(),
      lastDate: z.string(),
      examples: z.array(rulingRowSchema),
      canFile: z.boolean(),
      proposal: z
        .object({
          category: z.string(),
          tags: z.array(z.string()),
          reason: z.string(),
          source: z.enum(['rulebook', 'history']),
        })
        .nullable()
        .optional(),
    }),
  ),
  rulebook: rulingRulebookSchema.nullable().optional(),
});
