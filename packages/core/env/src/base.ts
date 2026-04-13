import * as z from 'zod';

export const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  AI_PROVIDER: z.string().default('openrouter'),
  AI_MODEL: z.string().default('openai/gpt-4o-mini-2024-07-18'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_FROM_NAME: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_BUCKET_NAME: z.string().default('hominem-storage'),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  REDIS_URL: z.string().url().optional().default('redis://localhost:6379'),
});

export type BaseEnv = z.infer<typeof baseSchema>;
