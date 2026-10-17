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
const nullableText = z.string().nullable().optional();
const common = { dryRun: z.boolean().default(false) };
const selector = z.object({ id: z.string().uuid(), ifUpdatedAt: z.string().datetime().optional() });

export const travelJourneyCreateInputSchema = z
  .object({
    ...common,
    name: z.string().min(1),
    startDate: date,
    endDate: date,
    purpose: z.enum(['leisure', 'business', 'mixed', 'move']).nullable().optional(),
    notes: nullableText,
    archived: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate)
      context.addIssue({ code: 'custom', path: ['endDate'], message: 'invalid_date_range' });
  });
export const travelJourneyUpdateInputSchema = selector
  .extend({
    name: z.string().min(1).optional(),
    startDate: date,
    endDate: date,
    purpose: z.enum(['leisure', 'business', 'mixed', 'move']).nullable().optional(),
    notes: nullableText,
    archived: z.boolean().optional(),
    dryRun: z.boolean().default(false),
  })
  .refine((value) =>
    Object.keys(value).some((key) => !['id', 'ifUpdatedAt', 'dryRun'].includes(key)),
  )
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate)
      context.addIssue({ code: 'custom', path: ['endDate'], message: 'invalid_date_range' });
  });
export const travelSegmentCreateInputSchema = z.object({
  ...common,
  journeyId: z.string().uuid(),
  seq: z.number().int().min(1),
  placeId: z.string().uuid(),
  arrivalDate: date,
  departureDate: date,
  notes: nullableText,
});
export const travelSegmentUpdateInputSchema = selector
  .extend({
    journeyId: z.string().uuid().optional(),
    seq: z.number().int().min(1).optional(),
    placeId: z.string().uuid().optional(),
    arrivalDate: date,
    departureDate: date,
    notes: nullableText,
    dryRun: z.boolean().default(false),
  })
  .refine((value) =>
    Object.keys(value).some((key) => !['id', 'ifUpdatedAt', 'dryRun'].includes(key)),
  )
  .superRefine((value, context) => {
    if (value.journeyId && value.seq === undefined)
      context.addIssue({ code: 'custom', path: ['seq'], message: 'journey_reparent_requires_seq' });
    if (value.arrivalDate && value.departureDate && value.departureDate < value.arrivalDate)
      context.addIssue({ code: 'custom', path: ['departureDate'], message: 'invalid_date_range' });
  });
export const travelTransportCreateInputSchema = z.object({
  ...common,
  date,
  mode: z.enum(['air', 'rail']),
  origin: z.string().min(1),
  destination: z.string().min(1),
  originReferenceId: z.string().uuid().optional(),
  destinationReferenceId: z.string().uuid().optional(),
  carrier: nullableText,
  number: nullableText,
  bookingRef: nullableText,
  depSegmentId: z.string().uuid().nullable().optional(),
  arrSegmentId: z.string().uuid().nullable().optional(),
  journeyId: z.string().uuid(),
  legacyTrip: nullableText,
  notes: nullableText,
});
export const travelTransportUpdateInputSchema = selector
  .extend({
    date,
    mode: z.enum(['air', 'rail']).optional(),
    origin: z.string().optional(),
    destination: z.string().optional(),
    originReferenceId: z.string().uuid().optional(),
    destinationReferenceId: z.string().uuid().optional(),
    carrier: nullableText,
    number: nullableText,
    bookingRef: nullableText,
    depSegmentId: z.string().uuid().nullable().optional(),
    arrSegmentId: z.string().uuid().nullable().optional(),
    journeyId: z.string().uuid().optional(),
    legacyTrip: nullableText,
    notes: nullableText,
    dryRun: z.boolean().default(false),
  })
  .refine((value) =>
    Object.keys(value).some((key) => !['id', 'ifUpdatedAt', 'dryRun'].includes(key)),
  )
  .superRefine((value, context) => {
    const linksChanged =
      value.journeyId !== undefined ||
      value.depSegmentId !== undefined ||
      value.arrSegmentId !== undefined;
    if (
      linksChanged &&
      (value.journeyId === undefined ||
        value.depSegmentId === undefined ||
        value.arrSegmentId === undefined)
    )
      context.addIssue({ code: 'custom', message: 'transport_reparent_requires_all_links' });
  });
export const travelStayCreateInputSchema = z
  .object({
    ...common,
    segmentId: z.string().uuid().nullable().optional(),
    journeyId: z.string().uuid().nullable().optional(),
    checkIn: date,
    checkOut: date,
    city: z.string().min(1),
    country: nullableText,
    property: nullableText,
    bookingRef: nullableText,
    evidence: z.enum(['email', 'calendar', 'thin', 'want']),
    notes: nullableText,
  })
  .superRefine((value, context) => {
    if (value.evidence === 'want' && (value.segmentId == null) !== (value.journeyId == null))
      context.addIssue({ code: 'custom', message: 'segment_journey_mismatch' });
    if (value.evidence !== 'want' && (!value.segmentId || !value.journeyId))
      context.addIssue({ code: 'custom', message: 'unknown_segment' });
    if (value.checkIn && value.checkOut && value.checkOut < value.checkIn)
      context.addIssue({ code: 'custom', path: ['checkOut'], message: 'invalid_date_range' });
  });
export const travelStayUpdateInputSchema = selector
  .extend({
    segmentId: z.string().uuid().optional(),
    journeyId: z.string().uuid().optional(),
    checkIn: date,
    checkOut: date,
    city: z.string().optional(),
    country: nullableText,
    property: nullableText,
    bookingRef: nullableText,
    evidence: z.enum(['email', 'calendar', 'thin', 'want']).optional(),
    notes: nullableText,
    dryRun: z.boolean().default(false),
  })
  .refine((value) =>
    Object.keys(value).some((key) => !['id', 'ifUpdatedAt', 'dryRun'].includes(key)),
  )
  .superRefine((value, context) => {
    if (value.checkIn && value.checkOut && value.checkOut < value.checkIn)
      context.addIssue({ code: 'custom', path: ['checkOut'], message: 'invalid_date_range' });
    if (value.journeyId !== undefined && value.segmentId === undefined)
      context.addIssue({
        code: 'custom',
        path: ['segmentId'],
        message: 'segment_journey_mismatch',
      });
  });
export const travelPlaceCreateInputSchema = z.object({
  ...common,
  place: z.string().min(1),
  country: z.string().min(1),
  type: z.string().min(1),
  wantToGo: z.boolean().default(false),
  firstVisited: date,
  lastVisited: date,
  notes: nullableText,
  archived: z.boolean().optional(),
});
export const travelPlaceUpdateInputSchema = selector
  .extend({
    place: z.string().optional(),
    country: z.string().optional(),
    type: z.string().optional(),
    wantToGo: z.boolean().optional(),
    firstVisited: date,
    lastVisited: date,
    notes: nullableText,
    archived: z.boolean().optional(),
    dryRun: z.boolean().default(false),
  })
  .refine((value) =>
    Object.keys(value).some((key) => !['id', 'ifUpdatedAt', 'dryRun'].includes(key)),
  );
export const travelAirportCurationUpdateInputSchema = z
  .object({
    code: z.string().trim().min(1).max(20),
    servesPlace: z.string().trim().min(1).nullable().optional(),
    notes: nullableText,
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    unpin: z.array(z.enum(['latitude', 'longitude'])).default([]),
    name: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    country: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      value.servesPlace !== undefined ||
      value.notes !== undefined ||
      value.latitude !== undefined ||
      value.longitude !== undefined ||
      value.unpin.length > 0 ||
      value.name !== undefined ||
      value.city !== undefined ||
      value.country !== undefined,
  );
export const travelIdeaCreateInputSchema = z.object({
  ...common,
  idea: z.string().min(1),
  type: z.enum(['experience', 'admin', 'housing']),
  status: z.enum(['open', 'done']).default('open'),
  notes: nullableText,
});
export const travelIdeaUpdateInputSchema = selector
  .extend({
    idea: z.string().optional(),
    type: z.enum(['experience', 'admin', 'housing']).optional(),
    status: z.enum(['open', 'done']).optional(),
    notes: nullableText,
    dryRun: z.boolean().default(false),
  })
  .refine((value) =>
    Object.keys(value).some((key) => !['id', 'ifUpdatedAt', 'dryRun'].includes(key)),
  );
export const travelDeleteInputSchema = selector.extend({
  iUnderstand: z.literal(true),
  dryRun: z.boolean().default(false),
  cascade: z.boolean().optional(),
});
export const travelEntityWriteOutputSchema = z.record(z.string(), z.unknown());
