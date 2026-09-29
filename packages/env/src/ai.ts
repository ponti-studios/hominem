import { z } from 'zod';

export const aiSchema = z.object({
  OPENROUTER_API_KEY: z.string().optional(),
  AUDIO_TTS_MODEL: z.string().default('microsoft/mai-voice-2-flash'),
  AUDIO_TTS_VOICE: z.string().default('en-US-Harper:MAI-Voice-2'),
  CHAT_MODEL: z.string().default('openai/gpt-5-mini'),
  EMBEDDING_MODEL: z.string().default('google/gemini-embedding-2'),
  ENHANCE_MODEL: z.string().default('openai/gpt-5-mini'),
  FILE_ANALYSIS_MODEL: z.string().default('openai/gpt-5-mini'),
  JOB_ANALYSIS_MODEL: z.string().default('openai/gpt-5-mini'),
  JOB_EXTRACTION_MODEL: z.string().default('openai/gpt-5-mini'),
  RESUME_CUSTOMIZE_MODEL: z.string().default('openai/gpt-5-mini'),
  RESUME_PARSE_MODEL: z.string().default('openai/gpt-5-mini'),
  SKILLS_DERIVATION_MODEL: z.string().default('openai/gpt-5-mini'),
  TASK_EXTRACTION_MODEL: z.string().default('openai/gpt-5-mini'),
  TIME_BLOCK_EXTRACTION_MODEL: z.string().default('openai/gpt-5-mini'),
  VOICE_CLEANUP_MODEL: z.string().default('openai/gpt-5-mini'),
});

export type AiEnv = z.infer<typeof aiSchema>;
