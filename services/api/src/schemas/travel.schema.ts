import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD).')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return parsed.toISOString().slice(0, 10) === value;
  }, 'Expected a valid calendar date.');

export const tripHistoryInputSchema = z
  .object({
    from: isoDate.optional().describe('Inclusive start date in the user data timezone.'),
    to: isoDate.optional().describe('Inclusive end date in the user data timezone.'),
    limit: z.number().int().min(1).max(50).default(20).describe('Maximum trips to return.'),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from must be on or before to.',
        path: ['to'],
      });
    }
  });

export const tripHistoryOutputSchema = z.object({
  trips: z.array(
    z.object({
      id: z.string(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      country: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      attendeeNames: z.array(z.string()),
    }),
  ),
  count: z.number().int().min(0),
});
