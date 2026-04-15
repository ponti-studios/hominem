import * as z from 'zod';

export const VoiceTranscribeSuccessSchema = z.object({
  text: z.string(),
});

export const VoiceTranscribeErrorSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
});

export const UploadedFileSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string().min(1),
  type: z.enum(['image', 'document', 'audio', 'video', 'unknown']),
  mimetype: z.string().min(1),
  size: z.number().nonnegative(),
  content: z.string().optional(),
  textContent: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  thumbnail: z.string().optional(),
  url: z.string().min(1),
  uploadedAt: z.string(),
  vectorIds: z.array(z.string()).optional(),
});

export const UploadResponseSchema = z.object({
  success: z.literal(true),
  file: UploadedFileSchema,
  message: z.string().min(1),
});

export type VoiceTranscribeSuccessResponse = z.infer<typeof VoiceTranscribeSuccessSchema>;
export type VoiceTranscribeErrorResponse = z.infer<typeof VoiceTranscribeErrorSchema>;
export type UploadResponse = z.infer<typeof UploadResponseSchema>;
