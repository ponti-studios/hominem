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
