import { z } from 'zod';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }, 'invalid_date')
  .nullable()
  .optional();
const optionalText = z.string().nullable().optional();
const legacyId = z.string().trim().min(1).optional();

export const travelEntityDeleteInputSchema = z.object({
  id: z.string().uuid(),
  iUnderstand: z.literal(true),
  ifUpdatedAt: z.string().datetime().optional(),
  dryRun: z.boolean().default(false),
});
export const travelReorderInputSchema = z.object({
  journeyId: z.string().uuid(),
  order: z.array(z.string().uuid()).min(1),
  dryRun: z.boolean().default(false),
});
export const travelSegmentMergeInputSchema = z
  .object({
    fromSegmentId: z.string().uuid(),
    intoSegmentId: z.string().uuid(),
    iUnderstand: z.literal(true),
    dryRun: z.boolean().default(false),
  })
  .refine((value) => value.fromSegmentId !== value.intoSegmentId, 'invalid_merge');
export const travelMergeInputSchema = z
  .object({
    fromId: z.string().uuid(),
    intoId: z.string().uuid(),
    iUnderstand: z.literal(true),
    dryRun: z.boolean().default(false),
  })
  .refine((value) => value.fromId !== value.intoId, 'invalid_merge');
export const travelPlaceRefreshInputSchema = z.object({ dryRun: z.boolean().default(true) });
export const travelJourneyCloneInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).optional(),
  startDate: date,
  dryRun: z.boolean().default(false),
});

const dossierJourneySchema = z
  .object({
    legacyId,
    name: z.string().trim().min(1),
    startDate: date,
    endDate: date,
    purpose: z.enum(['leisure', 'business', 'mixed', 'move']).nullable().optional(),
    notes: optionalText,
    archived: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate)
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'invalid_journey_date_range',
      });
  });

const dossierSegmentSchema = z
  .object({
    legacyId,
    key: z.string().trim().min(1).optional(),
    seq: z.number().int().min(1),
    placeId: z.string().uuid(),
    arrivalDate: date,
    departureDate: date,
    notes: optionalText,
  })
  .superRefine((value, context) => {
    if (value.arrivalDate && value.departureDate && value.departureDate < value.arrivalDate)
      context.addIssue({
        code: 'custom',
        path: ['departureDate'],
        message: 'invalid_segment_date_range',
      });
  });

const dossierTransportSchema = z.object({
  legacyId,
  date,
  mode: z.enum(['air', 'rail']),
  origin: z.string().trim().min(1),
  destination: z.string().trim().min(1),
  carrier: optionalText,
  number: optionalText,
  bookingRef: optionalText,
  depSegmentLegacyId: z.string().trim().min(1).optional(),
  arrSegmentLegacyId: z.string().trim().min(1).optional(),
  depSegmentKey: z.string().trim().min(1).optional(),
  arrSegmentKey: z.string().trim().min(1).optional(),
  legacyTrip: optionalText,
  notes: optionalText,
});

const dossierStaySchema = z
  .object({
    legacyId,
    segmentLegacyId: z.string().trim().min(1).optional(),
    segmentKey: z.string().trim().min(1).optional(),
    checkIn: date,
    checkOut: date,
    city: z.string().trim().min(1),
    country: optionalText,
    property: optionalText,
    bookingRef: optionalText,
    evidence: z.enum(['email', 'calendar', 'thin', 'want']),
    notes: optionalText,
  })
  .superRefine((value, context) => {
    if (!value.segmentLegacyId && !value.segmentKey)
      context.addIssue({ code: 'custom', path: ['segmentKey'], message: 'unknown_segment' });
    if (value.checkIn && value.checkOut && value.checkOut < value.checkIn)
      context.addIssue({
        code: 'custom',
        path: ['checkOut'],
        message: 'invalid_stay_date_range',
      });
  });

export const travelJourneySaveInputSchema = z
  .object({
    journey: dossierJourneySchema,
    segments: z.array(dossierSegmentSchema).default([]),
    transport: z.array(dossierTransportSchema).default([]),
    stays: z.array(dossierStaySchema).default([]),
    dryRun: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    const sequences = new Set<number>();
    for (const [index, segment] of value.segments.entries()) {
      if (sequences.has(segment.seq))
        context.addIssue({
          code: 'custom',
          path: ['segments', index, 'seq'],
          message: 'duplicate_seq',
        });
      sequences.add(segment.seq);
    }
  });

export const travelMaintenanceOutputSchema = z.record(z.string(), z.unknown());
