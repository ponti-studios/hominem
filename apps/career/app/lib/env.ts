import { z } from 'zod';

const serverEnvSchema = z.object({
  VITE_DATABASE_URL: z.string().url(),
  VITE_CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
  VITE_CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
});

const clientEnvSchema = z.object({
  VITE_PUBLIC_API_URL: z.string().url(),
});

const serverCombinedSchema = serverEnvSchema.merge(clientEnvSchema);

type ClientEnv = z.infer<typeof clientEnvSchema>;
type ServerEnv = z.infer<typeof serverCombinedSchema>;

let clientEnvCache: ClientEnv | null = null;

function getEnvironmentVariables(): ClientEnv | ServerEnv {
  const isClient = typeof window !== 'undefined';

  if (isClient) {
    if (clientEnvCache) {
      return clientEnvCache;
    }
    return { VITE_PUBLIC_API_URL: '' };
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    return serverCombinedSchema.parse({
      VITE_DATABASE_URL: process.env.VITE_DATABASE_URL || process.env.DATABASE_URL,
      VITE_PUBLIC_API_URL: process.env.VITE_PUBLIC_API_URL || process.env.API_URL,
      VITE_CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
      VITE_CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    });
  }

  const envSource =
    typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : process.env;

  return serverCombinedSchema.parse({
    VITE_DATABASE_URL: envSource.VITE_DATABASE_URL || envSource.DATABASE_URL,
    VITE_PUBLIC_API_URL: envSource.VITE_PUBLIC_API_URL || envSource.API_URL,
    VITE_CLOUDFLARE_ACCOUNT_ID: envSource.VITE_CLOUDFLARE_ACCOUNT_ID,
    VITE_CLOUDFLARE_API_TOKEN: envSource.VITE_CLOUDFLARE_API_TOKEN,
  });
}

export const env = getEnvironmentVariables();

export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() can only be called on the server side');
  }
  return env as ServerEnv;
}

export async function loadClientEnv(): Promise<ClientEnv> {
  if (typeof window === 'undefined') {
    throw new Error('loadClientEnv() can only be called on the client side');
  }

  if (clientEnvCache) {
    return clientEnvCache;
  }

  try {
    const response = await fetch('/api/env');
    if (!response.ok) {
      throw new Error('Failed to load environment variables');
    }
    const envData = await response.json();
    clientEnvCache = clientEnvSchema.parse(envData);
    return clientEnvCache;
  } catch (error) {
    console.error('Failed to load client environment variables:', error);
    throw error;
  }
}
