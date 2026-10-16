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

export const travelResidenceListInputSchema = z.object({
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
  periods: z.array(period).min(1),
  notes: z.string().nullable().optional(),
});
export const travelResidenceUpdateInputSchema = z
  .object({
    id: z.string().uuid(),
    periods: z.array(period).min(1).optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((v) => v.periods !== undefined || v.notes !== undefined);
export const travelResidenceDeleteInputSchema = z.object({
  id: z.string().uuid(),
  iUnderstand: z.literal(true),
});
export const travelResidenceOutputSchema = z.object({
  id: z.string(),
  legacyId: z.string(),
  placeId: z.string(),
  place: z.string(),
  country: z.string(),
  periods: z.array(period),
  notes: z.string().nullable(),
});
