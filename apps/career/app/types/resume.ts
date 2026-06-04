import { z } from 'zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const presentDateValues = new Set(['present', 'current', 'now']);

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizePortfolioSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .replace(/-$/g, '');
}

function normalizeResumeDate(value: unknown): string | null {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) return null;
  if (presentDateValues.has(trimmed.toLowerCase())) return null;

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(trimmed);
  const normalized = monthMatch ? `${trimmed}-01` : trimmed;
  return normalized;
}

function isValidResumeDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const nonBlankString = z.string().trim().min(1);
const optionalString = z.preprocess(normalizeOptionalString, z.string().nullable());
const resumeDate = z.preprocess(
  normalizeResumeDate,
  z
    .string()
    .refine(isValidResumeDate, 'Expected a valid date in YYYY-MM-DD or YYYY-MM format.')
    .nullable(),
);

export const resumeSchema = z.object({
  portfolio: z.object({
    slug: z
      .string()
      .transform(normalizePortfolioSlug)
      .pipe(z.string().min(3).max(50).regex(slugPattern)),
    title: nonBlankString,
    name: nonBlankString,
    initials: optionalString,
    job_title: nonBlankString,
    bio: nonBlankString,
    tagline: nonBlankString,
    current_location: nonBlankString,
    location_tagline: optionalString,
    email: z.string().trim().email(),
    phone: optionalString,
    availability_status: z.boolean(),
    availability_message: optionalString,
    is_public: z.boolean(),
    is_active: z.boolean(),
  }),
  social_links: z
    .object({
      github: optionalString,
      linkedin: optionalString,
      twitter: optionalString,
      website: optionalString,
    })
    .nullable(),
  workExperience: z.array(
    z.object({
      company: nonBlankString,
      description: nonBlankString,
      role: nonBlankString,
      start_date: resumeDate,
      end_date: resumeDate,
    }),
  ).default([]),
  skills: z.array(
    z.object({
      name: nonBlankString,
      level: z.number().finite().min(1).max(100),
      category: optionalString,
      description: optionalString,
      years_of_experience: z.number().finite().min(0).optional().nullable(),
      certifications: z.array(nonBlankString).default([]),
    }),
  ).default([]),
  projects: z.array(
    z.object({
      title: nonBlankString,
      description: nonBlankString,
      short_description: optionalString,
      technologies: z.array(nonBlankString).default([]),
      live_url: optionalString,
      github_url: optionalString,
      status: z.enum(['in-progress', 'completed', 'archived']),
    }),
  ).default([]),
  stats: z.array(
    z.object({
      label: nonBlankString,
      value: nonBlankString,
    }),
  ).default([]),
});

export type ConvertedResumeData = z.infer<typeof resumeSchema>;

export type ResumeConvertStage =
  | 'auth'
  | 'request'
  | 'file-validation'
  | 'rate-limit'
  | 'pdf-extraction'
  | 'ai-parse'
  | 'schema-validation'
  | 'storage'
  | 'database'
  | 'complete';

export type UploadResumeResponse = {
  message?: string;
  data?: ConvertedResumeData;
  saved?: boolean;
  portfolio_id?: string;
  portfolioSlug?: string;
  portfolioUrl?: string;
  fileUrl?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
  error?: string;
  stage?: ResumeConvertStage;
  retryable?: boolean;
};
