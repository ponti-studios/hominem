import { z } from 'zod';

export const CreateNoteInputSchema = z.object({
  title: z.string().optional(),
  content: z.string(),
  fileIds: z.array(z.uuid()).max(5).optional(),
});

export const UpdateNoteInputSchema = z.object({
  title: z.string().nullish(),
  content: z.string().optional(),
  fileIds: z.array(z.uuid()).max(5).optional(),
});

export const NoteParamSchema = z.object({ id: z.uuid() });

export const GenerateNoteFromChatInputSchema = z.object({
  transcript: z.string().min(1).max(20000),
  instruction: z.string().max(500).optional(),
});

export const NoteSearchQuerySchema = z.object({
  query: z.string().trim().min(1),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

// ── MCP tool schemas ─────────────────────────────────────────────────

const noteToolRecordSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  content: z.string(),
  excerpt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const noteToolSummarySchema = noteToolRecordSchema.omit({ content: true });

export const noteListToolInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe('Optional keyword matched against note titles and content.'),
  limit: z.number().int().min(1).max(50).default(20).describe('Maximum notes to return.'),
});

export const noteListToolOutputSchema = z.object({ notes: z.array(noteToolSummarySchema) });

export const noteGetToolOutputSchema = z.object({ note: noteToolRecordSchema.nullable() });

export const noteCreateToolInputSchema = z.object({
  title: z.string().trim().min(1).max(200).optional().describe('Optional short title.'),
  content: z.string().trim().min(1).max(50000).describe('The note body.'),
});

export const noteCreateToolOutputSchema = z.object({ note: noteToolRecordSchema });

export const noteUpdateToolInputSchema = z
  .object({
    id: z.uuid().describe('Stable note id returned by note_list or note_create.'),
    title: z.string().trim().min(1).max(200).nullable().optional(),
    content: z.string().trim().min(1).max(50000).optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'Provide a title or content to update',
  });

export const noteUpdateToolOutputSchema = z.object({ note: noteToolRecordSchema.nullable() });

export const noteDeleteToolOutputSchema = z.object({ removed: z.boolean() });

export const semanticSearchInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe('Natural-language description of what to find; matches by meaning, not keywords.'),
  limit: z.number().int().min(1).max(20).default(5).describe('Maximum matches to return.'),
});

export const semanticSearchOutputSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      title: z.string().nullable(),
      excerpt: z.string().nullable(),
      similarity: z.number(),
    }),
  ),
});
