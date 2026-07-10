import * as z from 'zod';

const storageSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  R2_ENDPOINT: z.url().default('http://localhost:9000'),
  R2_BUCKET_NAME: z.string().min(1).default('storage'),
  R2_ACCESS_KEY_ID: z.string().min(1).default('minioadmin'),
  R2_SECRET_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  R2_PUBLIC_URL: z.url().default('http://localhost:9000'),
});

const parsedEnv = storageSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid storage environment variables:', parsedEnv.error.format());
  throw new Error('Invalid storage environment variables');
}

export const env = parsedEnv.data;

export type StorageEnv = typeof env;
