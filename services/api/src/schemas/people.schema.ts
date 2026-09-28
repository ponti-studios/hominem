import { z } from 'zod';

const limitSchema = z.number().int().min(1).max(50);

// ── people_lookup ────────────────────────────────────────────────────

const personEmailSchema = z.object({
  email: z.string(),
  isPrimary: z.boolean(),
  source: z.string().nullable(),
});

const personPhoneSchema = z.object({
  phoneNumber: z.string(),
  isPrimary: z.boolean(),
});

const personOrganizationSchema = z.object({
  organization: z.string(),
  isPrimary: z.boolean(),
  source: z.string().nullable(),
});

export const personSummarySchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  personType: z.string().nullable(),
  notes: z.string().nullable(),
  emails: z.array(personEmailSchema),
  phones: z.array(personPhoneSchema),
  organizations: z.array(personOrganizationSchema),
  tags: z.array(z.string()),
});

export const peopleLookupInputSchema = z.object({
  query: z.string().trim().min(1).max(200).describe('Person name, alias, or identifying phrase.'),
  limit: limitSchema.default(10).describe('Maximum people to return.'),
});

export const peopleLookupOutputSchema = z.object({
  people: z.array(personSummarySchema),
  count: z.number().int().min(0),
});

export const peopleSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const personPickerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
});

export const peopleSearchOutputSchema = z.object({
  people: z.array(personPickerSchema),
  count: z.number().int().min(0),
});

export const personCreateSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  email: z.email().trim().nullable().optional(),
});

export const personCreateToolInputSchema = personCreateSchema.describe(
  'A person to add to the address book.',
);

export const personCreateToolOutputSchema = z.object({ person: personPickerSchema });

export const personUpdateToolInputSchema = z
  .object({
    personId: z.uuid().describe('Stable person id returned by people_lookup or person_create.'),
    displayName: z.string().trim().min(1).max(200).optional(),
    email: z
      .email()
      .trim()
      .nullable()
      .optional()
      .describe("Sets the person's primary email; null removes it."),
  })
  .refine((data) => data.displayName !== undefined || data.email !== undefined, {
    message: 'Provide a displayName or email to update',
  });

export const personUpdateToolOutputSchema = z.object({ person: personPickerSchema.nullable() });

// ── person_timeline ──────────────────────────────────────────────────

export const personTimelineInputSchema = z.object({
  personId: z.string().describe('Stable person id returned by people_lookup.'),
});

const personTimelineTripSchema = z.object({
  id: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  role: z.string().nullable(),
});

const personTimelineRelationSchema = z.object({
  relatedPersonId: z.string(),
  relatedDisplayName: z.string().nullable(),
  relation: z.string(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
});

const personTimelineSocialContactSchema = z.object({
  platform: z.string(),
  displayName: z.string().nullable(),
  kind: z.string().nullable(),
  isMutual: z.boolean(),
});

export const personTimelineOutputSchema = z.object({
  person: personSummarySchema.nullable(),
  trips: z.array(personTimelineTripSchema),
  relations: z.array(personTimelineRelationSchema),
  socialContacts: z.array(personTimelineSocialContactSchema),
});
