import * as z from 'zod';

export const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.url().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('openai/gpt-4o'),
  OPENROUTER_VOICE_CLEANUP_MODEL: z.string().default('openai/gpt-4o-mini'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_FROM_NAME: z.string().optional(),
  R2_ENDPOINT: z.url().optional(),
  R2_BUCKET_NAME: z.string().default('storage'),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_PUBLIC_URL: z.url().optional(),
  REDIS_URL: z.url().optional().default('redis://localhost:6379'),
});

export type BaseEnv = z.infer<typeof baseSchema>;
