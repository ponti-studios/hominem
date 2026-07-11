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

export type CalendarSearchQuery = z.infer<typeof calendarSearchQuerySchema>;
export type CalendarUpcomingQuery = z.infer<typeof calendarUpcomingQuerySchema>;
