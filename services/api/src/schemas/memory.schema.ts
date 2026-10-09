import { z } from 'zod';

// ── remember ─────────────────────────────────────────────────────────

export const rememberInputSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1)
    .max(4000)
    .describe('One durable fact or preference about the user.'),
  title: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe('Optional short title for the memory.'),
});

export const rememberOutputSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  excerpt: z.string().nullable(),
  createdAt: z.string(),
});

const memorySummarySchema = rememberOutputSchema;

/** Query strings arrive as text; turn a numeric string into a number and leave every other type to fail validation. */
const numericString = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

// ── list_memories ────────────────────────────────────────────────────

export const listMemoriesInputSchema = z.object({
  limit: z
    .preprocess(numericString, z.number().int().min(1).max(50).optional())
    .describe('Maximum memories to return, from 1 to 50.'),
});

export const listMemoriesOutputSchema = z.object({
  memories: z.array(memorySummarySchema),
});

// ── GET /api/memory (paged, for apps that keep their own copy) ───────

export const listMemoriesPageInputSchema = z.object({
  limit: z
    .preprocess(numericString, z.number().int().min(1).max(100).optional())
    .describe('Memories per page, from 1 to 100. Defaults to 50.'),
  before: z
    .string()
    .min(1)
    .max(512)
    .optional()
    .describe('The `next` cursor from the previous page.'),
  since: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Expected a date and time')
    .optional()
    .describe('Only memories updated at or after this time (ISO 8601).'),
});

const memoryDtoSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  content: z.string(),
  excerpt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listMemoriesPageOutputSchema = z.object({
  memories: z.array(memoryDtoSchema),
  next: z.string().nullable(),
  serverTime: z.string(),
});

export const listMemoryStampsOutputSchema = z.object({
  memories: z.array(z.object({ id: z.string(), updatedAt: z.string() })),
  serverTime: z.string(),
});

// ── search_memories ──────────────────────────────────────────────────

export const searchMemoriesInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .describe('Keywords describing the remembered fact or preference.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum matching memories to return, from 1 to 50.'),
});

export const searchMemoriesOutputSchema = listMemoriesOutputSchema;

// ── forget_memory ────────────────────────────────────────────────────

export const forgetMemoryInputSchema = z.object({
  id: z.string().uuid(),
});

export const forgetMemoryOutputSchema = z.object({
  removed: z.boolean(),
});

// ── RPC-only (web) ──────────────────────────────────────────────────

export const MemoryParamSchema = z.object({ id: z.uuid() });

export const UpdateMemoryInputSchema = z.object({
  title: z.string().trim().min(1).max(200).nullish(),
  content: z.string().trim().min(1).max(4000).optional(),
});
