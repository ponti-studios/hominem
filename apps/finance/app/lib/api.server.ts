import type { AppType } from '@hominem/api/types';
import { hc } from 'hono/client';

import { serverEnv } from '~/lib/env';

const customFetch =
  (accessToken?: string, request?: Request): typeof fetch =>
  async (input, init) => {
    const headers = new Headers(init?.headers);

    if (request) {
      const cookie = request.headers.get('cookie');
      if (cookie) headers.set('cookie', cookie);
    }

    if (accessToken) {
      headers.set('authorization', `Bearer ${accessToken}`);
    }

    return fetch(input as RequestInfo | URL, { ...init, headers, credentials: 'include' });
  };

export function createServerHonoClient(accessToken?: string, request?: Request) {
  const client = hc<AppType>(serverEnv.VITE_PUBLIC_API_URL, {
    fetch: customFetch(accessToken, request),
  });

  return { finance: client.api.finance };
}
