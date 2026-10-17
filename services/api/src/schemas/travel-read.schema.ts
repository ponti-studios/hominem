import { z } from 'zod';

const pagination = {
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
};
const selector = z.object({ id: z.string().uuid() });
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
  query: z.string().optional(),
  country: z.string().optional(),
});
export const travelAirportGetInputSchema = z.object({ code: z.string().trim().min(1).max(20) });
const row = z.record(z.string(), z.unknown());
export const travelStayListInputSchema = z.object({
  ...pagination,
  city: z.string().optional(),
  segmentId: z.string().uuid().optional(),
  journeyId: z.string().uuid().optional(),
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
const travelPresenceEvidence = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stop'),
    id: z.string().uuid(),
    journeyId: z.string().uuid(),
    journeyName: z.string(),
    arrivalDate: z.string().nullable(),
    departureDate: z.string().nullable(),
  }),
  z.object({
    type: z.literal('visit'),
    id: z.string().uuid(),
    visitedAt: z.string().nullable(),
    purpose: z.string().nullable(),
    source: z.string().nullable(),
  }),
  z.object({
    type: z.literal('residence'),
    residenceId: z.string().uuid(),
    periodId: z.string().uuid(),
    startDate: z.string(),
    endDate: z.string().nullable(),
    ongoing: z.boolean(),
    precision: z.string(),
  }),
  z.object({
    type: z.literal('layover'),
    airportCode: z.string(),
    airportName: z.string().nullable(),
    journeyId: z.string().uuid(),
    journeyName: z.string(),
    arrivalTransportId: z.string().uuid(),
    departureTransportId: z.string().uuid(),
    date: z.string().nullable(),
  }),
]);
export const travelCountriesOutputSchema = z.object({
  countries: z.array(
    z.object({
      country: z.string(),
      countryCode: z.string().nullable(),
      places: z.array(
        z.object({
          placeId: z.string().uuid().nullable(),
          name: z.string(),
          locationType: z.enum(['place', 'airport']),
          evidence: z.array(travelPresenceEvidence),
        }),
      ),
      evidenceTypes: z.array(z.enum(['stop', 'visit', 'residence', 'layover'])),
    }),
  ),
  evidenceTypes: z.array(z.enum(['stop', 'visit', 'residence', 'layover'])),
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
