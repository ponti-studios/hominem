import { z } from 'zod';

const pagination = {
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
};
const selector = z
  .object({ id: z.string().uuid().optional(), legacyId: z.string().optional() })
  .refine(
    (value) => Boolean(value.id) !== Boolean(value.legacyId),
    'Provide exactly one of id or legacyId.',
  );
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD).')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Expected a valid calendar date.');
const orderedRange = <T extends { from?: string; to?: string }>(schema: z.ZodType<T>) =>
  schema.superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from must be on or before to.',
        path: ['to'],
      });
    }
  });

export const travelJourneyListInputSchema = orderedRange(
  z.object({
    ...pagination,
    archived: z.boolean().default(true),
    year: z.number().int().optional(),
    purpose: z.string().optional(),
    from: date.optional(),
    to: date.optional(),
    upcoming: z.boolean().optional(),
    query: z.string().optional(),
  }),
);
export const travelJourneyGetInputSchema = selector;
export const travelSegmentListInputSchema = orderedRange(
  z.object({
    ...pagination,
    journeyId: z.string().uuid().optional(),
    journeyLegacyId: z.string().optional(),
    place: z.string().optional(),
    from: date.optional(),
    to: date.optional(),
  }),
);
export const travelSegmentGetInputSchema = selector;
export const travelPlaceListInputSchema = z.object({
  ...pagination,
  archived: z.boolean().default(true),
  status: z.string().optional(),
  country: z.string().optional(),
  type: z.string().optional(),
  query: z.string().optional(),
  hasResidence: z.boolean().optional(),
  currentlyHome: z.boolean().optional(),
});
export const travelPlaceGetInputSchema = selector;
export const travelCountriesInputSchema = z.object({});
export const travelTransportListInputSchema = z
  .object({
    ...pagination,
    mode: z.string().optional(),
    carrier: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    journeyId: z.string().uuid().optional(),
    journeyLegacyId: z.string().optional(),
    bookingRef: z.string().optional(),
    fromDate: date.optional(),
    toDate: date.optional(),
  })
  .superRefine((value, context) => {
    if (value.fromDate && value.toDate && value.fromDate > value.toDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fromDate must be on or before toDate.',
        path: ['toDate'],
      });
    }
  });
export const travelAirportListInputSchema = z.object({
  ...pagination,
  place: z.string().optional(),
  country: z.string().optional(),
});
export const travelAirportGetInputSchema = z
  .object({ id: z.string().uuid().optional(), code: z.string().optional() })
  .refine((value) => Boolean(value.id) !== Boolean(value.code));
export const travelStayListInputSchema = z.object({
  ...pagination,
  city: z.string().optional(),
  segmentId: z.string().uuid().optional(),
  segmentLegacyId: z.string().optional(),
  journeyId: z.string().uuid().optional(),
  journeyLegacyId: z.string().optional(),
  evidence: z.string().optional(),
});
export const travelBookingLookupInputSchema = z.object({
  bookingRef: z.string().min(1),
  partial: z.boolean().default(false),
  ...pagination,
});
export const travelWishlistInputSchema = z.object({ ...pagination });
export const travelIdeaListInputSchema = z.object({
  ...pagination,
  status: z.string().optional(),
  type: z.string().optional(),
});

const row = z.record(z.string(), z.unknown());
export const pageSchema = z.object({
  items: z.array(row),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  truncated: z.boolean(),
});
export const travelJourneyListOutputSchema = z.object({
  journeys: z.array(row),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  truncated: z.boolean(),
});
export const travelSegmentListOutputSchema = z.object({
  segments: z.array(row),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  truncated: z.boolean(),
});
export const travelPlaceListOutputSchema = z.object({
  places: z.array(row),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  truncated: z.boolean(),
});
export const travelTransportListOutputSchema = z.object({
  transport: z.array(row),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  truncated: z.boolean(),
});
export const travelAirportListOutputSchema = z.object({
  airports: z.array(row),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  truncated: z.boolean(),
});
export const travelStayListOutputSchema = z.object({
  stays: z.array(row),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  truncated: z.boolean(),
});
export const travelIdeaListOutputSchema = z.object({
  ideas: z.array(row),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  truncated: z.boolean(),
});
export const travelEntityOutputSchema = row.nullable();
export const travelCountriesOutputSchema = z.object({
  countries: z.array(row),
  countryCount: z.number().int(),
  placesStatusCountryCount: z.number().int(),
  excludedByMethod: z.array(z.string()),
  method: z.string(),
});
export const travelBookingLookupOutputSchema = z.object({
  transport: z.array(row),
  stays: z.array(row),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  truncated: z.boolean(),
});
export const travelWishlistOutputSchema = z.object({
  places: z.object({
    groups: z.array(row),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    truncated: z.boolean(),
  }),
  stays: z.object({
    items: z.array(row),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    truncated: z.boolean(),
  }),
  ideas: z.object({
    items: z.array(row),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    truncated: z.boolean(),
  }),
});
