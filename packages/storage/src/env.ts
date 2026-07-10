import * as z from 'zod';

const isTest = process.env.NODE_ENV === 'test';

const storageSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  R2_ENDPOINT: isTest ? z.url().optional() : z.url(),
  R2_BUCKET_NAME: isTest ? z.string().optional() : z.string().min(1),
  R2_ACCESS_KEY_ID: isTest ? z.string().optional() : z.string().min(1),
  R2_SECRET_ACCESS_KEY: isTest ? z.string().optional() : z.string().min(1),
  R2_PUBLIC_URL: z.url().optional(),
});

const parsedEnv = storageSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid storage environment variables:', parsedEnv.error.format());
  throw new Error('Invalid storage environment variables');
}

export const env = parsedEnv.data;

export type StorageEnv = typeof env;
