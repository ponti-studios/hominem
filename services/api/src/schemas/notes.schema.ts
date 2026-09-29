import { z } from 'zod';

// ── shared note write fields ────────────────────────────────────────
//
// REST and MCP both create and update the same note through the same service method
// (NoteService.createNote/updateNote), so they validate the title and content with the same
// rules. The only real difference between the two surfaces is that REST also accepts file
// attachments (fileIds) — a capability MCP tools don't expose — and MCP embeds the note id in
// the body since there's no URL path to carry it.

const noteFileIdsField = z.array(z.uuid()).max(5).optional();

const noteCreateFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200).optional().describe('Optional short title.'),
  content: z.string().trim().min(1).max(50000).describe('The note body.'),
});

const noteUpdateFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(200).nullable().optional(),
    content: z.string().trim().min(1).max(50000).optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'Provide a title or content to update',
  });

export const CreateNoteInputSchema = noteCreateFieldsSchema.extend({
  fileIds: noteFileIdsField,
});

export const UpdateNoteInputSchema = noteUpdateFieldsSchema.and(
  z.object({ fileIds: noteFileIdsField }),
);

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

export const noteCreateToolInputSchema = noteCreateFieldsSchema;

export const noteCreateToolOutputSchema = z.object({ note: noteToolRecordSchema });

export const noteUpdateToolInputSchema = z
  .object({ id: z.uuid().describe('Stable note id returned by note_list or note_create.') })
  .and(noteUpdateFieldsSchema);

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
