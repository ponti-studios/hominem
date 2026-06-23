import { createApiClient } from '@hominem/rpc';

import { serverEnv } from '~/lib/env';

export function createServerHonoClient(accessToken?: string, request?: Request) {
  return createApiClient({
    baseUrl: serverEnv.VITE_PUBLIC_API_URL,
    getHeaders: async () => {
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.authorization = `Bearer ${accessToken}`;
      }
      return headers;
    },
  });
}
