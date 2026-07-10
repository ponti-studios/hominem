import * as z from 'zod';

const isoTimestampSchema = z.string().datetime({ offset: true });

export const calendarSearchQuerySchema = z.object({
  query: z.string().trim().min(2).max(200),
  startsFrom: isoTimestampSchema.optional(),
  startsBefore: isoTimestampSchema.optional(),
  includeCancelled: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const calendarUpcomingQuerySchema = z.object({
  startsFrom: isoTimestampSchema.optional(),
  startsBefore: isoTimestampSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const financeMonthlySummaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const calendarEvidenceSchema = z.object({
  sourceRecordId: z.string().uuid().nullable(),
  sourceSystem: z.string().nullable(),
  sourceFile: z.string().nullable(),
  importRunId: z.string().uuid().nullable(),
  importedAt: z.string().nullable(),
});

export const calendarOccurrenceSchema = z.object({
  occurrenceId: z.string().uuid(),
  eventId: z.string().uuid(),
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  occurrenceDate: z.string().nullable(),
  isAllDay: z.boolean(),
  location: z.string().nullable(),
  isCancelled: z.boolean(),
  evidence: calendarEvidenceSchema,
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

export const personalDataHealthSchema = z.object({
  databaseAccessible: z.literal(true),
  importSourceCount: z.number().int().nonnegative(),
  importRunCount: z.number().int().nonnegative(),
  latestImportCompletedAt: z.string().nullable(),
  artifactCount: z.number().int().nonnegative(),
  rawRecordCount: z.number().int().nonnegative(),
  canonicalCounts: z.object({
    calendarOccurrences: z.number().int().nonnegative(),
    financeTransactions: z.number().int().nonnegative(),
    notes: z.number().int().nonnegative(),
    chats: z.number().int().nonnegative(),
  }),
  sources: z.array(
    z.object({
      sourceId: z.string().uuid(),
      provider: z.string(),
      sourceKind: z.string(),
      displayName: z.string(),
      status: z.string(),
      lastSyncedAt: z.string().nullable(),
      runCount: z.number().int().nonnegative(),
      latestRunStatus: z.string().nullable(),
      latestRunCompletedAt: z.string().nullable(),
    }),
  ),
  reconciliations: z.array(
    z.object({
      entityKind: z.string(),
      status: z.string(),
      sourceCount: z.number().int().nonnegative(),
      canonicalCount: z.number().int().nonnegative(),
      createdAt: z.string(),
    }),
  ),
  warnings: z.array(z.string()),
});

export type CalendarSearchQuery = z.infer<typeof calendarSearchQuerySchema>;
export type CalendarUpcomingQuery = z.infer<typeof calendarUpcomingQuerySchema>;
export type FinanceMonthlySummaryQuery = z.infer<typeof financeMonthlySummaryQuerySchema>;
