import * as z from 'zod';

export const VoiceTranscribeSuccessSchema = z.object({
  text: z.string(),
});

export const VoiceTranscribeErrorSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
});

export type VoiceTranscribeSuccessResponse = z.infer<typeof VoiceTranscribeSuccessSchema>;
export type VoiceTranscribeErrorResponse = z.infer<typeof VoiceTranscribeErrorSchema>;
