import { isObject } from '@hominem/utils';
import { z } from 'zod';

export const careerApplicationStatusSchema = z.enum([
  'WISHLIST',
  'APPLIED',
  'SCREENING',
  'OFFER',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
]);

const careerOfferDecisionSchema = z.enum(['PENDING', 'NEGOTIATING', 'ACCEPTED', 'DECLINED']);

export const careerProjectStatusSchema = z.enum(['BACKLOG', 'IN_PROGRESS', 'DONE', 'CANCELED']);

export const careerProfileSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  industry: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  websites: z.string().nullable(),
  twitterHandles: z.string().nullable(),
});

export const careerMcpProfileSchema = careerProfileSchema.omit({ email: true, phone: true });

export const careerProfileUpdateSchema = careerMcpProfileSchema
  .omit({ id: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

const careerEngagementKindSchema = z.enum([
  'EMPLOYMENT',
  'CONTRACT',
  'FREELANCE',
  'VOLUNTEER',
  'OTHER',
]);

const careerPageLimitSchema = z.coerce.number().int().min(1).max(50).optional().default(20);

const careerCursorSchema = z
  .string()
  .min(1)
  .max(512)
  .optional()
  .describe('The `nextCursor` from the previous page.');

export const careerEngagementsQuerySchema = z.object({
  type: z.enum(['all', 'employment']).optional().default('all'),
  limit: careerPageLimitSchema,
  cursor: careerCursorSchema,
});

export const careerEngagementSchema = z.object({
  id: z.string().uuid(),
  company: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  address: z.string().nullable(),
  url: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  isCurrent: z.boolean(),
  salaryLow: z.number().nullable(),
  salaryHigh: z.number().nullable(),
  currency: z.string().nullable(),
  contactName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  source: z.string().nullable(),
  kind: careerEngagementKindSchema,
  reasonForLeaving: z.string().nullable(),
});

export const careerEngagementUpdateDataSchema = z.object({
  company: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  location: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isCurrent: z.boolean().optional(),
  salaryLow: z.number().int().nullable().optional(),
  salaryHigh: z.number().int().nullable().optional(),
  currency: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  kind: careerEngagementKindSchema.optional(),
  reasonForLeaving: z.string().nullable().optional(),
});

export const careerEngagementUpdateSchema = z.object({
  id: z.string().uuid(),
  data: careerEngagementUpdateDataSchema,
});

export const careerEngagementCreateSchema = careerEngagementUpdateDataSchema.extend({
  company: z.string().trim().min(1),
  title: z.string().trim().min(1),
});

export const careerEngagementDeleteSchema = z.object({ id: z.string().uuid() });

export const careerEngagementsSchema = z.object({
  engagements: z.array(
    z.object({
      id: z.string().uuid(),
      company: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      location: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      isCurrent: z.boolean(),
      salaryLow: z.number().nullable(),
      salaryHigh: z.number().nullable(),
      currency: z.string().nullable(),
      kind: careerEngagementKindSchema,
      url: z.string().nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const careerApplicationsQuerySchema = z.object({
  status: careerApplicationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  before: z
    .string()
    .min(1)
    .max(512)
    .optional()
    .describe('The `next` cursor from the previous page.'),
});

export const careerApplicationsSchema = z.object({
  applications: z.array(
    z.object({
      id: z.string().uuid(),
      company: z.string(),
      title: z.string(),
      location: z.string().nullable(),
      source: z.string().nullable(),
      appliedAt: z.string().nullable(),
      currentStage: z.string().nullable(),
      status: careerApplicationStatusSchema,
      jobPostingUrl: z.string().nullable(),
      externalId: z.string().nullable(),
      postedAt: z.string().nullable(),
      postingText: z.string().nullable(),
      salaryMin: z.number().nullable(),
      salaryMax: z.number().nullable(),
      salaryCurrency: z.string().nullable(),
      salaryExpectation: z.number().nullable(),
      notes: z.string().nullable(),
      stageCount: z.number(),
      hasOffer: z.boolean(),
    }),
  ),
  next: z.string().nullable(),
});

export const careerApplicationCreateSchema = z.object({
  company: z.string().trim().min(1).describe('Company name exactly as the posting shows it.'),
  title: z.string().trim().min(1).describe('Job title exactly as the posting shows it.'),
  location: z
    .string()
    .nullable()
    .optional()
    .describe('Location as posted, e.g. "San Francisco, CA" or "Remote (US)". Omit if unknown.'),
  source: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Where the posting lives: the job board or ATS, e.g. "Ashby", "Greenhouse", "LinkedIn".',
    ),
  appliedAt: z.string().nullable().optional().describe('Date applied, YYYY-MM-DD.'),
  status: careerApplicationStatusSchema.optional(),
  jobPostingUrl: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Link to the posting. Tracking params like utm_* are ignored when checking for duplicates; keep any job-id param.',
    ),
  externalId: z
    .string()
    .nullable()
    .optional()
    .describe(
      "The job board's own id for the posting (JSON-LD identifier, Greenhouse/Lever/Ashby job id) when the page exposes one. With source, this is the strongest duplicate check.",
    ),
  postedAt: z.string().nullable().optional().describe('Date the posting went up, YYYY-MM-DD.'),
  postingText: z
    .string()
    .nullable()
    .optional()
    .describe(
      'The full posting body as plain text. Read the page yourself and paste it; do not summarize.',
    ),
  salaryMin: z
    .number()
    .int()
    .nullable()
    .optional()
    .describe(
      'Bottom of the posted pay range in whole currency units per year. Omit if not posted.',
    ),
  salaryMax: z
    .number()
    .int()
    .nullable()
    .optional()
    .describe('Top of the posted pay range in whole currency units per year. Omit if not posted.'),
  salaryCurrency: z
    .string()
    .nullable()
    .optional()
    .describe('ISO currency code for the posted range, e.g. "USD".'),
  salaryExpectation: z
    .number()
    .int()
    .nullable()
    .optional()
    .describe(
      'What the user hopes to earn, in cents per year. For the pay range in the posting use salaryMin and salaryMax instead.',
    ),
  notes: z.string().nullable().optional().describe("The user's own notes, not the posting text."),
});
export const careerApplicationUpdateSchema = z.object({
  id: z.string().uuid(),
  data: careerApplicationCreateSchema.partial(),
});
export const careerApplicationDeleteSchema = z.object({ id: z.string().uuid() });

export const careerWishlistCompanySchema = z.object({
  id: z.string().uuid(),
  company: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const careerWishlistCompaniesQuerySchema = z.object({
  limit: careerPageLimitSchema,
  cursor: careerCursorSchema,
});

export const careerWishlistCompaniesSchema = z.object({
  companies: z.array(careerWishlistCompanySchema),
  nextCursor: z.string().nullable(),
});

export const careerWishlistCompanyCreateSchema = z.object({
  company: z.string().trim().min(1).max(200),
});

export const careerWishlistCompanyUpdateSchema = careerWishlistCompanyCreateSchema.extend({
  id: z.string().uuid(),
});

export const careerWishlistCompanyDeleteSchema = z.object({ id: z.string().uuid() });

export const careerApplicationDetailSchema = z.object({
  application: z
    .object({
      id: z.string().uuid(),
      company: z.string(),
      title: z.string(),
      location: z.string().nullable(),
      source: z.string().nullable(),
      referredBy: z.string().nullable(),
      appliedAt: z.string().nullable(),
      currentStage: z.string().nullable(),
      status: careerApplicationStatusSchema.nullable(),
      resumeUrl: z.string().nullable(),
      coverLetterUrl: z.string().nullable(),
      jobPostingUrl: z.string().nullable(),
      salaryExpectation: z.number().nullable(),
      notes: z.string().nullable(),
      stages: z.array(
        z.object({
          id: z.string().uuid(),
          stage: z.string(),
          stageKind: z.enum(['APPLICATION', 'SCREEN', 'OFFER', 'OUTCOME']),
          stageOrder: z.number(),
          enteredAt: z.string().nullable(),
          exitedAt: z.string().nullable(),
          notes: z.string().nullable(),
        }),
      ),
      offers: z.array(
        z.object({
          id: z.string().uuid(),
          stageId: z.string().uuid(),
          baseSalary: z.number().nullable(),
          equity: z.string().nullable(),
          bonus: z.number().nullable(),
          signingBonus: z.number().nullable(),
          totalComp: z.number().nullable(),
          currency: z.string().nullable(),
          decision: careerOfferDecisionSchema,
          decisionAt: z.string().nullable(),
          notes: z.string().nullable(),
        }),
      ),
    })
    .nullable(),
});

export const careerEducationQuerySchema = z.object({
  limit: careerPageLimitSchema,
  cursor: careerCursorSchema,
});

export const careerEducationSchema = z.object({
  education: z.array(
    z.object({
      id: z.string().uuid(),
      school: z.string(),
      degree: z.string().nullable(),
      fieldOfStudy: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      activities: z.string().nullable(),
      notes: z.string().nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
export const careerEducationCreateSchema = z.object({
  school: z.string().trim().min(1),
  degree: z.string().nullable().optional(),
  fieldOfStudy: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  activities: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export const careerEducationUpdateSchema = z.object({
  id: z.string().uuid(),
  data: careerEducationCreateSchema.partial(),
});
export const careerEducationDeleteSchema = z.object({ id: z.string().uuid() });

// -- Skills --

export const careerSkillSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string().nullable(),
  level: z.number().nullable(),
  yearsOfExperience: z.number().nullable(),
  description: z.string().nullable(),
  proof: z.string().nullable(),
  worklogEntryIds: z.array(z.string().uuid()),
  aiDerived: z.boolean(),
  isVisible: z.boolean(),
  sortOrder: z.number(),
});

export const careerSkillsQuerySchema = z.object({
  limit: careerPageLimitSchema,
  cursor: careerCursorSchema,
});

export const careerSkillsSchema = z.object({
  skills: z.array(careerSkillSchema),
  nextCursor: z.string().nullable(),
});

export const careerSkillCreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().nullable().optional(),
  level: z.number().int().nullable().optional(),
  yearsOfExperience: z.number().int().nullable().optional(),
  description: z.string().nullable().optional(),
  proof: z.string().nullable().optional(),
  worklogEntryIds: z
    .array(z.string().uuid())
    .optional()
    .describe(
      'Worklog entries that prove this skill. Every id must be the caller’s own; sending a list replaces the current links.',
    ),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const careerSkillUpdateSchema = z.object({
  id: z.string().uuid(),
  data: careerSkillCreateSchema.partial(),
});

export const careerSkillDeleteSchema = z.object({ id: z.string().uuid() });

// -- Projects --

export const careerProjectSchema = z.object({
  id: z.string().uuid(),
  organization: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  liveUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  technologies: z.array(z.string()),
  status: careerProjectStatusSchema.nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  isFeatured: z.boolean(),
  isVisible: z.boolean(),
  sortOrder: z.number(),
  engagements: z.array(
    z.object({
      id: z.string().uuid(),
      company: z.string(),
      title: z.string(),
      kind: z.enum(['EMPLOYMENT', 'CONTRACT', 'FREELANCE', 'VOLUNTEER', 'OTHER']),
    }),
  ),
});

export const careerProjectsQuerySchema = z.object({
  limit: careerPageLimitSchema,
  cursor: careerCursorSchema,
});

export const careerProjectsSchema = z.object({
  projects: z.array(careerProjectSchema),
  nextCursor: z.string().nullable(),
});

export const careerProjectCreateSchema = z.object({
  organization: z.string().trim().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  shortDescription: z.string().nullable().optional(),
  liveUrl: z.string().nullable().optional(),
  githubUrl: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  technologies: z.array(z.string()).optional(),
  status: careerProjectStatusSchema.nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isFeatured: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  engagementIds: z.array(z.string().uuid()).optional(),
});

export const careerProjectUpdateSchema = z.object({
  id: z.string().uuid(),
  data: careerProjectCreateSchema.partial(),
});

export const careerProjectDeleteSchema = z.object({ id: z.string().uuid() });

// -- Testimonials --

export const careerTestimonialSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  content: z.string(),
  avatarUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  rating: z.number().nullable(),
  isVerified: z.boolean(),
  isVisible: z.boolean(),
  sortOrder: z.number(),
});

export const careerTestimonialsSchema = z.object({
  testimonials: z.array(careerTestimonialSchema),
});

export const careerTestimonialCreateSchema = z.object({
  name: z.string().min(1),
  title: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  content: z.string().min(1),
  avatarUrl: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  rating: z.number().int().nullable().optional(),
  isVerified: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const careerTestimonialUpdateSchema = z.object({
  id: z.string().uuid(),
  data: careerTestimonialCreateSchema.partial(),
});

export const careerTestimonialDeleteSchema = z.object({ id: z.string().uuid() });

// -- Certifications --

export const careerCertificationSchema = z.object({
  id: z.string().uuid(),
  positionId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  issuingOrganization: z.string(),
  issueDate: z.string().nullable(),
  expirationDate: z.string().nullable(),
  status: z.string().nullable(),
  category: z.string().nullable(),
  isVisible: z.boolean(),
  sortOrder: z.number(),
});

export const careerCertificationsQuerySchema = z.object({
  limit: careerPageLimitSchema,
  cursor: careerCursorSchema,
});

export const careerCertificationsSchema = z.object({
  certifications: z.array(careerCertificationSchema),
  nextCursor: z.string().nullable(),
});

export const careerCertificationCreateSchema = z.object({
  positionId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  issuingOrganization: z.string().min(1),
  issueDate: z.string().nullable().optional(),
  expirationDate: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const careerCertificationUpdateSchema = z.object({
  id: z.string().uuid(),
  data: careerCertificationCreateSchema.partial(),
});

export const careerCertificationDeleteSchema = z.object({ id: z.string().uuid() });

// -- Social links --

export const careerSocialLinksSchema = z.object({
  socialLinks: z
    .object({
      github: z.string().nullable(),
      linkedin: z.string().nullable(),
      twitter: z.string().nullable(),
      website: z.string().nullable(),
    })
    .nullable(),
});

export const careerSocialLinksSaveSchema = z.object({
  github: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  twitter: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
});

// -- Worklog --

export const careerWorklogImpactStatusSchema = z.enum(['open', 'closed']);
export const careerWorklogSensitivitySchema = z.enum(['public_safe', 'internal', 'mixed']);

function isIsoCalendarDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

const careerWorklogDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD).')
  .refine(isIsoCalendarDate, 'Invalid ISO date.');

/** A light pointer to the artifact that backs an entry; the URL may be absent for private systems. */
export const careerWorklogEvidenceSchema = z.object({
  kind: z.enum(['ticket', 'pr', 'doc', 'link', 'other']),
  label: z.string().trim().min(1),
  url: z.string().min(1).nullable().default(null),
});

export const careerWorklogEntrySchema = z.object({
  id: z.string().uuid(),
  engagementId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  occurredStart: z.string(),
  occurredEnd: z.string().nullable(),
  loggedAt: z.string(),
  updatedAt: z.string(),
  area: z.string().nullable(),
  problem: z.string().nullable(),
  action: z.string().nullable(),
  impact: z.string().nullable(),
  impactStatus: careerWorklogImpactStatusSchema,
  tags: z.array(z.string()),
  sensitivity: careerWorklogSensitivitySchema,
  publicBullet: z.string().nullable(),
  knownLimits: z.string().nullable(),
  evidence: z.array(careerWorklogEvidenceSchema),
  rawNote: z.string(),
});

export const careerWorklogEntriesSchema = z.object({
  entries: z.array(careerWorklogEntrySchema),
});

export const careerWorklogEntryDetailSchema = z.object({
  entry: careerWorklogEntrySchema.nullable(),
  linkedSkillIds: z.array(z.string().uuid()),
});

export const careerWorklogEntriesQuerySchema = z
  .object({
    engagementId: z.string().uuid().optional().describe('Only entries under this engagement.'),
    projectId: z.string().uuid().optional().describe('Only entries linked to this project.'),
    skillId: z
      .string()
      .uuid()
      .optional()
      .describe('Only entries that prove this skill, as linked from the skill’s worklogEntryIds.'),
    impactStatus: careerWorklogImpactStatusSchema
      .optional()
      .describe('`open` is the follow-up queue: the outcome is still unknown.'),
    tag: z.string().min(1).optional().describe('Only entries carrying exactly this tag.'),
    occurredAfter: careerWorklogDateSchema
      .optional()
      .describe('Inclusive lower bound on the entry’s start date (YYYY-MM-DD).'),
    occurredBefore: careerWorklogDateSchema
      .optional()
      .describe('Inclusive upper bound on the entry’s start date (YYYY-MM-DD).'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe('Maximum number of entries to return, from 1 to 100.'),
  })
  .strict();

export const careerWorklogCreateSchema = z
  .object({
    engagementId: z
      .string()
      .uuid()
      .describe('The engagement this work belongs to; it must be the caller’s own.'),
    rawNote: z
      .string()
      .min(1)
      .describe('The user’s words, verbatim. Captured once and never rewritten.'),
    projectId: z.string().uuid().nullable().optional().describe('Optional project; must be owned.'),
    occurredStart: careerWorklogDateSchema
      .optional()
      .describe('Start of the work window (YYYY-MM-DD). Defaults to the create date.'),
    occurredEnd: careerWorklogDateSchema
      .nullable()
      .optional()
      .describe(
        'End of the work window (YYYY-MM-DD). Must be on or after occurredStart; null is a single day or an ongoing window.',
      ),
    area: z.string().nullable().optional().describe('System or surface the work touched.'),
    problem: z.string().nullable().optional().describe('What was broken, risky, or missing.'),
    action: z.string().nullable().optional().describe('What the user did — the mechanism.'),
    impact: z.string().nullable().optional().describe('The outcome, with a metric when known.'),
    impactStatus: careerWorklogImpactStatusSchema
      .optional()
      .describe('`open` (default) while the outcome is unknown; `closed` once it is known.'),
    tags: z.array(z.string()).optional().describe('Free-form labels. Defaults to an empty list.'),
    sensitivity: careerWorklogSensitivitySchema
      .optional()
      .describe('Guidance for downstream consumers, not access control. Defaults to `internal`.'),
    publicBullet: z.string().nullable().optional().describe('The resume-safe one-liner.'),
    knownLimits: z.string().nullable().optional().describe('Honest caveats.'),
    evidence: z
      .array(careerWorklogEvidenceSchema)
      .optional()
      .describe('Light pointers to backing artifacts. Replaced wholesale on update.'),
  })
  .strict();

/** `rawNote` is the user's words, captured once; `loggedAt`, `id` and `updatedAt` are server-owned. */
const careerWorklogImmutableFields = ['rawNote', 'loggedAt', 'id', 'updatedAt'] as const;

export const careerWorklogUpdateDataSchema = z.preprocess(
  (value, ctx) => {
    if (isObject(value)) {
      const offending = careerWorklogImmutableFields.find((field) => field in value);
      if (offending) {
        ctx.addIssue({
          code: 'custom',
          path: [offending],
          message: `RAW_NOTE_IMMUTABLE: ${offending} cannot be changed after the entry is created.`,
        });
        return z.NEVER;
      }
    }
    return value;
  },
  z
    .object({
      engagementId: z.string().uuid().optional(),
      projectId: z.string().uuid().nullable().optional(),
      occurredStart: careerWorklogDateSchema.optional(),
      occurredEnd: careerWorklogDateSchema.nullable().optional(),
      area: z.string().nullable().optional(),
      problem: z.string().nullable().optional(),
      action: z.string().nullable().optional(),
      impact: z.string().nullable().optional(),
      impactStatus: careerWorklogImpactStatusSchema.optional(),
      tags: z.array(z.string()).optional(),
      sensitivity: careerWorklogSensitivitySchema.optional(),
      publicBullet: z.string().nullable().optional(),
      knownLimits: z.string().nullable().optional(),
      evidence: z.array(careerWorklogEvidenceSchema).optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
);

export const careerWorklogUpdateSchema = z.object({
  id: z.string().uuid(),
  data: careerWorklogUpdateDataSchema,
});

export const careerWorklogDeleteSchema = z.object({ id: z.string().uuid() });

export const careerWorklogCreateOutputSchema = z.object({ entry: careerWorklogEntrySchema });

export const careerWorklogUpdateOutputSchema = z.object({
  entry: careerWorklogEntrySchema.nullable(),
});

// -- Application notes --

export const careerApplicationNoteCreateSchema = z.object({
  content: z.string().min(1),
});

export const careerApplicationNoteDeleteSchema = z.object({ id: z.string().uuid() });
export const careerApplicationNoteAddSchema = z.object({
  applicationId: z.string().uuid(),
  content: z.string().min(1),
});
export const careerApplicationNoteRemoveSchema = z.object({
  applicationId: z.string().uuid(),
  id: z.string().uuid(),
});

// -- Application files --

export const careerApplicationFileCreateSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  fileType: z.string().nullable().optional(),
});

export const careerApplicationFileDeleteSchema = z.object({ id: z.string().uuid() });
export const careerApplicationFileAddSchema = careerApplicationFileCreateSchema.extend({
  applicationId: z.string().uuid(),
});
export const careerApplicationFileRemoveSchema = z.object({
  applicationId: z.string().uuid(),
  id: z.string().uuid(),
});

export const careerProfileUpdateOutputSchema = z.object({ profile: careerMcpProfileSchema });

export const careerEngagementCreateOutputSchema = z.object({ engagement: careerEngagementSchema });

export const careerApplicationCreateOutputSchema = z.object({
  application: careerApplicationsSchema.shape.applications.element,
  alreadyExisted: z
    .boolean()
    .describe(
      'True when the user already had this posting, so nothing was created. Check that the returned title and company match what you meant to save.',
    ),
});

export const careerApplicationUpdateOutputSchema = z.object({
  application: careerApplicationsSchema.shape.applications.element.nullable(),
});

export const careerApplicationNoteAddOutputSchema = z.object({
  note: z.object({ id: z.string().uuid(), content: z.string(), createdAt: z.string() }).nullable(),
});

export const careerApplicationFileAddOutputSchema = z.object({
  file: z
    .object({
      id: z.string().uuid(),
      fileName: z.string(),
      fileUrl: z.string(),
      fileType: z.string().nullable(),
      createdAt: z.string(),
    })
    .nullable(),
});

export const careerEducationCreateOutputSchema = z.object({
  education: careerEducationSchema.shape.education.element,
});

export const careerEducationUpdateOutputSchema = z.object({
  education: careerEducationSchema.shape.education.element.nullable(),
});

export const careerSkillCreateOutputSchema = z.object({ skill: careerSkillSchema });

export const careerSkillUpdateOutputSchema = z.object({ skill: careerSkillSchema.nullable() });

export const careerProjectCreateOutputSchema = z.object({ project: careerProjectSchema });

export const careerTestimonialCreateOutputSchema = z.object({
  testimonial: careerTestimonialSchema,
});

export const careerTestimonialUpdateOutputSchema = z.object({
  testimonial: careerTestimonialSchema.nullable(),
});

export const careerCertificationCreateOutputSchema = z.object({
  certification: careerCertificationSchema,
});

export const careerCertificationUpdateOutputSchema = z.object({
  certification: careerCertificationSchema.nullable(),
});

export const careerSocialLinksSaveOutputSchema = z.object({
  socialLinks: careerSocialLinksSchema.shape.socialLinks.unwrap(),
});

export const careerWishlistAddOutputSchema = z.object({ company: careerWishlistCompanySchema });

export const careerWishlistUpdateOutputSchema = z.object({
  company: careerWishlistCompanySchema.nullable(),
});

export const careerEngagementUpdateOutputSchema = z.object({
  engagement: careerEngagementSchema.nullable(),
});

export const careerProjectUpdateOutputSchema = z.object({
  project: careerProjectSchema.nullable(),
});

export const careerProfileOutputSchema = z.object({
  profile: careerMcpProfileSchema.nullable(),
});
