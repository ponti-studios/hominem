import { z } from 'zod';

const rulePattern = z.string().trim().min(1).max(300);
const doctrineNote = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .describe('Provenance for dated rulings — preserved verbatim, never interpreted.');

const matchModeSchema = z
  .enum(['exact', 'contains', 'startsWith'])
  .default('contains')
  .describe('How the pattern is matched against the normalized merchant name.');

const transferMatchModeSchema = z
  .enum(['exact', 'contains', 'startsWith'])
  .default('exact')
  .describe('Match mode for row-class transfer detection; defaults to exact.');

export const syncDoctrineSchema = z
  .object({
    version: z
      .literal(1)
      .describe('Doctrine shape version — bump only on a breaking shape change.'),
    // Ordered lists: first match wins. Keep operator rules before broader ones
    // (train operators before a generic 'railway' hosting rule, for example).
    merchantRules: z
      .array(
        z.object({
          matchMode: matchModeSchema,
          pattern: rulePattern,
          category: rulePattern,
          note: doctrineNote,
        }),
      )
      .max(5000),
    // Ordered: the first matching rule sets the tag row; lenses may then add to it.
    tagRules: z
      .array(
        z.object({
          matchMode: matchModeSchema,
          pattern: rulePattern,
          tags: z.array(rulePattern).max(100),
          note: doctrineNote,
        }),
      )
      .max(5000),
    // Exact normalized merchant + exact minor-unit amounts: known subscription
    // prices auto-map, every other amount falls through to the merchant rules.
    amountRules: z
      .array(
        z.object({
          merchant: rulePattern.describe('Exact normalized merchant name.'),
          amountMinorUnits: z
            .array(z.number().int())
            .min(1)
            .max(100)
            .describe('Signed minor units (cents/pence) that trigger this rule.'),
          category: rulePattern,
          note: doctrineNote,
        }),
      )
      .max(1000),
    // Row-class detection: matched before merchant rules, filed as Transfers.
    transferMerchants: z
      .array(
        z.object({
          matchMode: transferMatchModeSchema,
          pattern: rulePattern,
          unlessAccountContains: rulePattern.optional(),
          note: doctrineNote,
        }),
      )
      .max(1000),
    // Matched on positive amounts only, filed as Income.
    incomePatterns: z
      .array(
        z.object({
          matchMode: matchModeSchema,
          pattern: rulePattern,
          note: doctrineNote,
        }),
      )
      .max(1000),
    coffeePatterns: z
      .array(rulePattern)
      .max(1000)
      .describe(
        'Coffee/tea substrings; inside the Food category these win over other component tags.',
      ),
    // Category-scoped tag lenses: merchants that historically belonged to an
    // absorbed subcategory keep it as a tag when the row lands in the survivor.
    lenses: z
      .array(
        z.object({
          category: rulePattern,
          matches: z
            .array(
              z.object({
                matchMode: matchModeSchema,
                pattern: rulePattern,
                tag: rulePattern,
              }),
            )
            .max(5000),
        }),
      )
      .max(200),
  })
  .strict();

export const doctrineGetInputSchema = z.object({}).strict();

export const doctrineGetOutputSchema = z.object({
  fingerprint: z.string().nullable(),
  updatedAt: z.string().nullable(),
  doctrine: syncDoctrineSchema.nullable(),
});

export const doctrineImportInputSchema = z
  .object({
    doctrine: syncDoctrineSchema,
    dryRun: z.boolean().default(false).describe('Report the outcome without writing.'),
  })
  .strict();

export const doctrineImportOutputSchema = z.object({
  fingerprint: z
    .string()
    .describe('SHA-256 of the canonical doctrine — computed server-side, never client-supplied.'),
  status: z
    .enum(['created', 'replaced', 'unchanged'])
    .describe(
      'created: first import; replaced: contents changed; unchanged: identical fingerprint.',
    ),
  updatedAt: z
    .string()
    .nullable()
    .describe('Stored timestamp after the write; null on a dry run that would create.'),
  dryRun: z.boolean(),
  ruleCounts: z.object({
    merchantRules: z.number().int().nonnegative(),
    tagRules: z.number().int().nonnegative(),
    amountRules: z.number().int().nonnegative(),
    transferMerchants: z.number().int().nonnegative(),
    incomePatterns: z.number().int().nonnegative(),
    coffeePatterns: z.number().int().nonnegative(),
    lenses: z.number().int().nonnegative(),
  }),
});
