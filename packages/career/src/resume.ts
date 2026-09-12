import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';

import {
  convertSchemaToJsonSchema,
  createChatCompletion,
  getChatCompletionText,
  getChatCompletionUsage,
  type AIUsageMetrics,
} from '@hominem/ai';
import { CareerSocialLinksRecord } from '@hominem/db/career';
import type { CareerProfileRecord } from '@hominem/db/career';
import { sql } from '@hominem/db/core';
import type { DbHandle } from '@hominem/db/transaction';
import type {
  ResumeImportDiff,
  ResumeListItemChange,
  ResumeScalarFieldChange,
} from '@hominem/queues';
import PDFParser from 'pdf2json';
import { z } from 'zod';

import { RESUME_PARSE_MODEL } from './models';
import { normalizePortfolioSlug, resumeSchema, type ConvertedResumeData } from './types';

export { normalizePortfolioSlug, resumeSchema };
export type { ConvertedResumeData };

const resumeParserJsonSchema = convertSchemaToJsonSchema(resumeSchema);

const RESUME_PARSER_PROMPT_URL = new URL('./prompts/resume-parser.md', import.meta.url);
let resumeParserSystemPromptPromise: Promise<string> | null = null;

async function loadResumeParserSystemPrompt(): Promise<string> {
  if (!resumeParserSystemPromptPromise) {
    resumeParserSystemPromptPromise = readFile(RESUME_PARSER_PROMPT_URL, 'utf8').then((content) =>
      content.trim(),
    );
  }
  return resumeParserSystemPromptPromise;
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return JSON.parse(jsonMatch?.[1] ?? trimmed);
}

export class ResumeParseError extends Error {
  kind: 'ai-parse' | 'schema-validation';
  issues?: z.ZodIssue[];
  cause?: unknown;
  // Set whenever the underlying AI completion succeeded (the failure happened
  // in the JSON/schema handling that runs after) so callers can still record
  // the AI usage/cost event that was actually incurred.
  usage: AIUsageMetrics | null;
  model: string | null;

  constructor(
    kind: 'ai-parse' | 'schema-validation',
    message: string,
    options?: {
      issues?: z.ZodIssue[];
      cause?: unknown;
      usage?: AIUsageMetrics | null;
      model?: string | null;
    },
  ) {
    super(message);
    this.name = 'ResumeParseError';
    this.kind = kind;
    this.issues = options?.issues;
    this.cause = options?.cause;
    this.usage = options?.usage ?? null;
    this.model = options?.model ?? null;
  }
}

export async function extractPdfText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return new Promise<string>((resolve, reject) => {
    const parser = new PDFParser(undefined, true);
    parser.on('pdfParser_dataError', (data) => {
      const error = data instanceof Error ? data : data.parserError;
      reject(error);
    });
    parser.on('pdfParser_dataReady', () => {
      try {
        resolve(parser.getRawTextContent());
      } catch (error) {
        reject(error);
      }
    });
    parser.parseBuffer(buffer);
  });
}

export type ParsedResume = {
  data: ConvertedResumeData;
  usage: AIUsageMetrics | null;
  model: string;
};

// Throws ResumeParseError if the AI parse or the schema validation fails. The
// underlying completion may have still succeeded (and incurred cost) even
// when this throws — see ResumeParseError.usage/model.
export async function parseResumeWithAI(pdfText: string): Promise<ParsedResume> {
  const systemPrompt = await loadResumeParserSystemPrompt();

  const result = await createChatCompletion({
    model: RESUME_PARSE_MODEL,
    responseFormat: {
      type: 'json_schema',
      jsonSchema: {
        name: 'resume_parser',
        schema: resumeParserJsonSchema,
      },
    },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Parse this resume into structured JSON. Resume text:\n${pdfText}` },
    ],
  });

  const usage = getChatCompletionUsage(result);
  const model = result.model;

  const aiContent = getChatCompletionText(result);
  if (!aiContent.trim()) {
    throw new ResumeParseError('ai-parse', 'The AI parser returned an empty response.', {
      usage,
      model,
    });
  }

  let parsedResume: unknown;
  try {
    parsedResume = parseJsonObject(aiContent);
  } catch (error) {
    throw new ResumeParseError('ai-parse', 'The AI parser returned malformed resume data.', {
      cause: error,
      usage,
      model,
    });
  }

  const { success, data, error: schemaError } = resumeSchema.safeParse(parsedResume);
  if (!success) {
    throw new ResumeParseError(
      'schema-validation',
      'The parsed resume data was incomplete or invalid.',
      { issues: schemaError.issues, usage, model },
    );
  }

  return { data, usage, model };
}

function truncateSlugBase(slug: string, suffix = ''): string {
  const maxBaseLength = 50 - suffix.length;
  return slug.slice(0, maxBaseLength).replace(/-$/g, '') || 'portfolio';
}

// Appends a numeric suffix if the slug is already taken
export async function generateUniqueSlug(
  handle: DbHandle,
  base: string,
  fallbackBase = 'portfolio',
): Promise<string> {
  const normalizedBase =
    normalizePortfolioSlug(base) || normalizePortfolioSlug(fallbackBase) || 'portfolio';
  const root = truncateSlugBase(normalizedBase);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const candidate = `${truncateSlugBase(root, suffix)}${suffix}`;
    const existing = await handle
      .selectFrom('app.careerProfile')
      .select('id')
      .where(sql`lower(slug)`, '=', candidate.toLowerCase())
      .executeTakeFirst();

    if (!existing) return candidate;
  }

  throw new Error('Could not generate a unique profile slug.');
}

const BASICS_FIELD_MAP: Array<{
  field: keyof CareerProfileRecord;
  resumeKey: keyof ConvertedResumeData['portfolio'];
  label: string;
}> = [
  { field: 'headline', resumeKey: 'job_title', label: 'Job title' },
  { field: 'summary', resumeKey: 'bio', label: 'Bio' },
  { field: 'tagline', resumeKey: 'tagline', label: 'Tagline' },
  { field: 'location', resumeKey: 'current_location', label: 'Location' },
  { field: 'email', resumeKey: 'email', label: 'Email' },
  { field: 'phone', resumeKey: 'phone', label: 'Phone' },
  { field: 'initials', resumeKey: 'initials', label: 'Initials' },
  { field: 'availabilityStatus', resumeKey: 'availability_status', label: 'Available for work' },
  { field: 'openToRemote', resumeKey: 'open_to_remote', label: 'Open to remote' },
];

type SocialLinkField = 'github' | 'linkedin' | 'twitter' | 'website';

const SOCIAL_FIELD_MAP: Array<{ field: SocialLinkField; label: string }> = [
  { field: 'github', label: 'GitHub' },
  { field: 'linkedin', label: 'LinkedIn' },
  { field: 'twitter', label: 'Twitter / X' },
  { field: 'website', label: 'Website' },
];

// Diffs freshly-parsed resume data against the current profile. Scalar
// fields only show up in the diff if they actually changed, but every
// parsed work-experience/skill/project entry is included regardless — those
// are new rows, not sub-fields you can diff against an existing one.
export function buildResumeImportDiff(
  parsed: ConvertedResumeData,
  currentProfile: CareerProfileRecord | null,
  currentSocial: CareerSocialLinksRecord | null,
): ResumeImportDiff {
  const scalarChanges: ResumeScalarFieldChange[] = [];

  for (const { field, resumeKey, label } of BASICS_FIELD_MAP) {
    const current = (currentProfile?.[field] ?? null) as string | boolean | null;
    const proposed = (parsed.portfolio[resumeKey] ?? null) as string | boolean | null;
    if (current !== proposed) {
      scalarChanges.push({ field, group: 'basics', label, current, proposed });
    }
  }

  if (parsed.social_links) {
    for (const { field, label } of SOCIAL_FIELD_MAP) {
      const current = currentSocial?.[field] ?? null;
      const proposed = parsed.social_links[field] ?? null;
      if (current !== proposed) {
        scalarChanges.push({ field, group: 'social', label, current, proposed });
      }
    }
  }

  const listChanges: ResumeListItemChange[] = [
    ...parsed.workExperience.map((item, index) => ({
      key: `work:${index}`,
      group: 'workExperience' as const,
      summary: `${item.role} at ${item.company} (${item.start_date ?? '?'}–${item.end_date ?? 'present'})`,
      payload: item,
    })),
    ...parsed.skills.map((item, index) => ({
      key: `skill:${index}`,
      group: 'skills' as const,
      summary: `${item.name} — level ${item.level}`,
      payload: item,
    })),
    ...parsed.projects.map((item, index) => ({
      key: `project:${index}`,
      group: 'projects' as const,
      summary: item.title,
      payload: item,
    })),
  ];

  return {
    scalarChanges,
    listChanges,
    portfolioSlugProposed: parsed.portfolio.slug,
  };
}
