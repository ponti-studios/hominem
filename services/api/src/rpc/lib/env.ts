import { createServerEnv } from '@hominem/env';
import * as z from 'zod';

const envSchema = z.object({
  PORT: z.string().default('4040'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_URL: z.string().url().default('http://localhost:4040'),
  COOKIE_SECRET: z.string().default('supersecret'),
  DATABASE_URL: z.string().url(),

  NOTES_URL: z.string().url().default('http://localhost:4445'),

  GOOGLE_API_KEY: z.string().default(''),
  OPENROUTER_API_KEY: z.string(),
  AI_MODEL: z.string().default('qwen/qwen3.5-flash-02-23'),

  PLAID_CLIENT_ID: z.string().default(''),
  PLAID_API_KEY: z.string().default(''),
  PLAID_ENV: z.enum(['sandbox', 'development', 'production']).default('sandbox'),
  PLAID_WEBHOOK_SECRET: z.string().default(''),

  TWITTER_CLIENT_ID: z.string().default(''),
  TWITTER_CLIENT_SECRET: z.string().default(''),

  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default(''),
  RESEND_FROM_NAME: z.string().default(''),
  SEND_EMAILS: z
    .enum(['true', 'false'])
    .default('false')
    .describe('Whether to actually send emails via Resend'),
});

export const env = createServerEnv(envSchema, 'honoRpc');
