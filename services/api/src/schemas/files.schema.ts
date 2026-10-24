import { z } from 'zod';

export const UploadMetadataSchema = z.object({
  originalName: z.string().min(1),
  mimetype: z.string().min(1),
});

export const UploadIntentSchema = z.object({
  originalName: z.string().trim().min(1).max(255),
  mimetype: z.string().min(1),
  size: z.number().int().positive(),
});

export const listFilesInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z
    .string()
    .min(1)
    .max(512)
    .optional()
    .describe('The `nextCursor` from the previous page.'),
});

const fileSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  type: z.enum(['image', 'audio', 'video', 'document', 'unknown']),
  mimetype: z.string(),
  size: z.number().int().nonnegative(),
  content: z.string().optional(),
  textContent: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  url: z.string(),
  uploadedAt: z.string(),
  vectorIds: z.array(z.string()),
});

export const listFilesOutputSchema = z.object({
  files: z.array(fileSchema),
  count: z.number().int().min(0),
  nextCursor: z.string().nullable(),
});
