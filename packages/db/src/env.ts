import 'dotenv/config';
import * as z from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.url().optional(),
  DATABASE_URL_TEST: z.url().optional(),
  DB_MAX_CONNECTIONS: z.coerce.number().optional(),
  DB_IDLE_TIMEOUT: z.coerce.number().optional(),
  DB_MAX_LIFETIME: z.coerce.number().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment variables');
}

const data = parsedEnv.data;

export const env = {
  ...data,
  DATABASE_URL:
    data.DATABASE_URL ??
    (data.NODE_ENV === 'test'
      ? (data.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@127.0.0.1:4433/app-test')
      : undefined),
};
