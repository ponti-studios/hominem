import { aiSchema } from '@hominem/env/ai';
import { databaseSchema } from '@hominem/env/database';
import { emailSchema } from '@hominem/env/email';
import { redisSchema } from '@hominem/env/redis';
import { runtimeSchema } from '@hominem/env/runtime';
import { storageSchema } from '@hominem/env/storage';
import { z } from 'zod';

export const apiSchema = runtimeSchema.extend({
  ...databaseSchema.shape,
  ...aiSchema.shape,
  ...emailSchema.shape,
  ...storageSchema.shape,
  ...redisSchema.shape,
  PORT: z.coerce.number().int().positive().optional(),
  WORKER_PORT: z.coerce.number().int().positive().optional(),
  API_URL: z.url().default('https://api.lvh.me'),
  MAESTRO_API_ORIGIN: z.url().optional(),
  CAREER_URL: z.url().default('https://career.lvh.me'),
  WEB_URL: z.url().default('https://web.lvh.me'),
  FINANCE_URL: z.url().default('https://finance.lvh.me'),
  LABS_URL: z.url().default('https://labyrinth.lvh.me'),
  LABS_APEX_URL: z.url().optional(),
  NEWSBOY_URL: z.url().default('https://newsboy.lvh.me'),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  AUTH_COOKIE_DOMAIN: z.string().default(''),
  // Shared with a Cloudflare Transform Rule that adds X-Origin-Secret to every proxied request.
  // When set, requests that don't carry it (like direct hits on fly.dev) get a 403. Empty = guard off.
  ORIGIN_SECRET: z.string().default(''),
  HOMINEM_SCRIPTED_MAILBOX: z.string().default(''),
  AUTH_EMAIL_OTP_EXPIRES_SECONDS: z.coerce.number().int().positive().default(300),
  // App Review sign-in: one address, a 6-digit fixed code and an expiry, all empty when off (src/auth/review-account.ts).
  APP_REVIEW_EMAIL: z.string().default(''),
  APP_REVIEW_CODE: z
    .string()
    .default('')
    .refine((code) => code === '' || /^\d{6}$/.test(code), 'APP_REVIEW_CODE must be 6 digits'),
  // The fixed code stops working at this instant (ISO 8601), so it cannot be left on by mistake.
  APP_REVIEW_UNTIL: z.string().default(''),
  RESEND_API_KEY: z.string(),
  RESEND_FROM_EMAIL: z.string(),
  RESEND_FROM_NAME: z.string(),
  OPENROUTER_API_KEY: z.string(),
  // Creates, reads and disables the per-person keys handed to Thames. Never leaves the API.
  OPENROUTER_MANAGEMENT_KEY: z.string().optional(),
  // The TestFlight public link, kept off the website: only emailed (as a QR code) to an allowed domain.
  THAMES_TESTFLIGHT_URL: z.url().optional(),
  // Origin of the Thames website, allowed to call the invite endpoint from the browser.
  THAMES_SITE_URL: z.url().optional(),
  THAMES_MONTHLY_CAP_USD: z.coerce.number().positive().default(5),
  // Thames credit (docs/prd/top-up.md in the Thames repo). `off` changes nothing for anyone; `test`
  // turns it on for CREDIT_TESTERS only and needs Stripe test keys; `live` needs live keys.
  CREDIT_MODE: z.enum(['off', 'test', 'live']).default('off'),
  // Comma-separated emails, or whole domains (work.com or @work.com), who are in credit mode in `test`.
  CREDIT_TESTERS: z.string().default(''),
  // PostHog project token (Project settings -> Project token) and host, read only to ask whether the `thames-top-up` flag is on for a
  // person in `test`. Unset means the flag is never consulted and CREDIT_TESTERS alone decides.
  POSTHOG_PROJECT_TOKEN: z.string().optional(),
  POSTHOG_HOST: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url().default('https://us.i.posthog.com'),
  ),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Dollars per pound, already lowered by a small buffer so a falling pound does not cost Thames.
  CREDIT_USD_PER_POUND: z.coerce.number().positive().default(1.28),
  // The free credit on joining, in pence, and the most that may be given in a UTC day.
  CREDIT_GRANT_PENCE: z.coerce.number().int().nonnegative().default(100),
  CREDIT_GRANTS_PER_DAY: z.coerce.number().int().nonnegative().default(50),
  // Local fakes for development only (ignored in production): where to reach OpenRouter's key
  // API and Stripe's API instead of the real ones. See scripts/dev-fakes.ts.
  OPENROUTER_KEYS_BASE_URL: z.url().optional(),
  STRIPE_API_BASE_URL: z.url().optional(),
  OPENAI_APPS_CHALLENGE: z.string().optional(),
  SAVE_VOICE_AUDIO: z.stringbool().default(false),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_BOT_USERNAME: z.string().default(''),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(''),
  // The Hominem account allowed to link to and use this bot. Empty disables linking.
  TELEGRAM_OWNER_USER_ID: z.string().default(''),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  OTEL_EXPORTER_OTLP_PROTOCOL: z.string().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url().optional(),
  ),
  OTEL_EXPORTER_OTLP_LOGS_HEADERS: z.string().optional(),
  OTEL_TRACES_SAMPLER_ARG: z.coerce.number().default(0.1),
});

export type ApiEnv = z.infer<typeof apiSchema>;
