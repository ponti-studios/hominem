import { createApiClient } from '@hominem/rpc';

import { serverEnv } from './env.server';

export function createServerApiClient(request: Request) {
  return createApiClient({
    baseUrl: serverEnv.VITE_API_BASE_URL,
    getHeaders: async () => {
      const headers: Record<string, string> = {};
      const cookie = request.headers.get('cookie');
      if (cookie) {
        headers['cookie'] = cookie;
      }
      return headers;
    },
  });
}
