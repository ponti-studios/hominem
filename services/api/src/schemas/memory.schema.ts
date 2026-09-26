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

// ── list_memories ────────────────────────────────────────────────────

export const listMemoriesInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum memories to return, from 1 to 50.'),
});

export const listMemoriesOutputSchema = z.object({
  memories: z.array(memorySummarySchema),
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
