import { z } from 'zod';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  });

export const travelUnresolvedInputSchema = z.object({});
export const travelStatsInputSchema = z.object({ year: z.number().int().optional() });
export const travelSearchInputSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export const travelValidateInputSchema = z.object({});
export const travelTimelineInputSchema = z
  .object({
    from: date.optional(),
    to: date.optional(),
    limit: z.number().int().min(1).max(200).default(100),
    offset: z.number().int().min(0).default(0),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: 'custom',
        message: 'from must be on or before to.',
        path: ['to'],
      });
    }
  });
export const travelInsightsInputSchema = z.object({ year: z.number().int().optional() });
export const travelDistanceInputSchema = z.object({
  origin: z.string().trim().min(1),
  destination: z.string().trim().min(1),
});

const row = z.record(z.string(), z.unknown());
const page = z.object({
  items: z.array(row),
  total: z.number().int(),
  truncated: z.boolean(),
});
export const travelUnresolvedOutputSchema = z.object({
  stays: page,
  ideas: page,
  validation: z.record(z.string(), z.number().int()),
});
export const travelStatsOutputSchema = z.record(z.string(), z.unknown());
export const travelSearchOutputSchema = z.object({
  query: z.string(),
  total: z.number().int(),
  truncated: z.boolean(),
  journeys: page,
  places: page,
  stays: page,
  transport: page,
  ideas: page,
});
export const travelValidateOutputSchema = z.object({
  checks: z.record(z.string(), z.object({ count: z.number().int(), offenders: z.array(row) })),
});
export const travelTimelineOutputSchema = z.object({
  events: z.array(row),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  truncated: z.boolean(),
  from: z.string().nullable(),
  to: z.string().nullable(),
});
export const travelInsightsOutputSchema = z.record(z.string(), z.unknown());
export const travelDistanceOutputSchema = z.object({
  origin: row,
  destination: row,
  distanceKm: z.number().int().nullable(),
});
