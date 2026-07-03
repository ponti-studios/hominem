import 'dotenv/config';
import { z } from 'zod';

const isTest = process.env.NODE_ENV === 'test';

const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
  VITE_PUBLIC_API_URL: z.url(),
  OPENROUTER_API_KEY: isTest ? z.string().default('test-openrouter-key') : z.string(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const validatedServerEnv = serverEnvSchema.parse(process.env);

export function serverEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() can only be called on the server');
  }
  return validatedServerEnv;
}
