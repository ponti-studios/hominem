import { z } from 'zod';

const serverEnvSchema = z.object({
  VITE_DATABASE_URL: z.string().url(),
  VITE_PUBLIC_API_URL: z.string().url(),
  VITE_CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
  VITE_CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let _serverEnv: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() can only be called on the server');
  }
  if (!_serverEnv) {
    _serverEnv = serverEnvSchema.parse(
      typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : process.env,
    );
  }
  return _serverEnv;
}
