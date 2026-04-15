import * as z from 'zod';

import { baseSchema } from './base';

const isTest = process.env.NODE_ENV === 'test';
const defaultWebUrl = process.env.WEB_URL ?? process.env.NOTES_URL ?? 'http://localhost:4445';

export const apiSchema = baseSchema.extend({
  PORT: z.string().default('3000'),
  API_URL: z.string().url().default('http://localhost:4040'),
  WEB_URL: z.string().url().default(defaultWebUrl),
  DATABASE_URL: isTest
    ? z.string().url().default('postgresql://postgres:postgres@localhost:5432/hominem_test')
    : z.string().url(),
  NOTES_URL: z.string().url().default(defaultWebUrl),
  BETTER_AUTH_SECRET: z.string().default('dev-better-auth-secret-change-me'),
  AUTH_PASSKEY_RP_ID: z.string().default('api.ponti.io'),
  AUTH_PASSKEY_ORIGIN: z.string().url().default('https://api.ponti.io'),
  AUTH_COOKIE_DOMAIN: z.string().default(''),
  AUTH_E2E_ENABLED: z.coerce.boolean().default(false),
  AUTH_E2E_SECRET: z.string().default(''),
  AUTH_TEST_OTP_ENABLED: isTest ? z.coerce.boolean().default(true) : z.coerce.boolean().default(false),
  AUTH_TEST_OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  AUTH_EMAIL_OTP_EXPIRES_SECONDS: z.coerce.number().int().positive().default(300),
  RESEND_API_KEY: z.string(),
  RESEND_FROM_EMAIL: z.string(),
  RESEND_FROM_NAME: z.string(),
  SEND_EMAILS: z
    .enum(['true', 'false'])
    .default('false')
    .describe('Whether to actually send emails via Resend'),
  OPENROUTER_API_KEY: isTest ? z.string().default('test-openrouter-key') : z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SAVE_VOICE_AUDIO: z.coerce.boolean().default(false),
});

export type ApiEnv = z.infer<typeof apiSchema>;
