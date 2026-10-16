import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  });

const period = z
  .object({
    startDate: isoDate,
    endDate: isoDate.nullable(),
    ongoing: z.boolean(),
    precision: z.enum(['day', 'month', 'year']).default('day'),
    note: z.string().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.ongoing && value.endDate) ctx.addIssue({ code: 'custom', message: 'invalid_period' });
    if (value.endDate && value.startDate > value.endDate)
      ctx.addIssue({ code: 'custom', message: 'invalid_period' });
  });
export const travelResidencePeriodsSchema = z.array(period);
export const travelResidenceImportedPeriodsSchema = z
  .array(period)
  .min(1)
  .superRefine((periods, context) => {
    if (periods.filter((item) => item.ongoing).length > 1) {
      context.addIssue({ code: 'custom', message: 'multiple_current_homes' });
    }
  });

export const travelResidenceListInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
  placeId: z.string().uuid().optional(),
  place: z.string().optional(),
  current: z.boolean().optional(),
});
export const travelResidenceGetInputSchema = z
  .object({ id: z.string().uuid().optional(), legacyId: z.string().optional() })
  .refine((v) => Boolean(v.id || v.legacyId));
export const travelResidenceCreateInputSchema = z.object({
  placeId: z.string().uuid(),
  legacyId: z.string().optional(),
  dryRun: z.boolean().default(false),
  periods: z.array(period).min(1),
  notes: z.string().nullable().optional(),
});
export const travelResidenceUpdateInputSchema = z
  .object({
    id: z.string().uuid(),
    ifUpdatedAt: z.string().datetime().optional(),
    dryRun: z.boolean().default(false),
    periods: z.array(period).min(1).optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((v) => v.periods !== undefined || v.notes !== undefined);
export const travelResidenceDeleteInputSchema = z.object({
  id: z.string().uuid(),
  iUnderstand: z.literal(true),
  ifUpdatedAt: z.string().datetime().optional(),
  dryRun: z.boolean().default(false),
});
export const travelResidenceOutputSchema = z.object({
  id: z.string(),
  legacyId: z.string(),
  placeId: z.string(),
  place: z.string(),
  country: z.string(),
  periods: z.array(period),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const travelResidenceListOutputSchema = z.object({
  residences: z.array(travelResidenceOutputSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  truncated: z.boolean(),
});
export const travelResidenceMutationOutputSchema = z.object({
  residence: travelResidenceOutputSchema.nullable(),
  created: z.number().int().min(0).default(0),
  updated: z.number().int().min(0).default(0),
  unchanged: z.number().int().min(0).default(0),
  deleted: z.boolean().optional(),
  reason: z.string().optional(),
});
