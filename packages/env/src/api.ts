import * as z from 'zod';

import { baseSchema } from './base';

// z.coerce.boolean() is `Boolean(value)` under the hood — since env vars are
// always strings, Boolean("false") is `true` (any non-empty string is
// truthy). That silently defeats an explicitly-set "false" env var. Parse
// the literal strings instead, and fail loudly on anything else rather than
// guessing.
function booleanEnvVar(defaultValue: boolean) {
  return z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true');
}

export const apiSchema = baseSchema.extend({
  PORT: z.string().default('3000'),
  API_URL: z.url().default('http://localhost:4040'),
  CAREER_URL: z.url().default('http://localhost:4451'),
  WEB_URL: z.url().default('http://localhost:4445'),
  FINANCE_URL: z.url().default('http://localhost:4444'),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().default('dev-better-auth-secret-change-me'),
  AUTH_PASSKEY_RP_ID: z.string().default('api.ponti.io'),
  AUTH_PASSKEY_ORIGIN: z.url().default('https://api.ponti.io'),
  AUTH_COOKIE_DOMAIN: z.string().default(''),
  AUTH_E2E_ENABLED: booleanEnvVar(false),
  AUTH_E2E_SECRET: z.string().default(''),
  AUTH_TEST_OTP_ENABLED: booleanEnvVar(process.env.NODE_ENV === 'test'),
  AUTH_TEST_OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  AUTH_EMAIL_OTP_EXPIRES_SECONDS: z.coerce.number().int().positive().default(300),
  RESEND_API_KEY: z.string(),
  RESEND_FROM_EMAIL: z.string(),
  RESEND_FROM_NAME: z.string(),
  SEND_EMAILS: z
    .enum(['true', 'false'])
    .default('false')
    .describe('Whether to actually send emails via Resend'),
  OPENROUTER_API_KEY: z.string(),
  OPENROUTER_VOICE_CLEANUP_MODEL: z.string().default('qwen/qwen3.5-flash-02-23'),
  SENTRY_DSN: z.string().optional(),
  SAVE_VOICE_AUDIO: booleanEnvVar(false),
});

export type ApiEnv = z.infer<typeof apiSchema>;
