import { createApiClient } from '@hominem/rpc';
import { createFinanceClient } from '@hominem/rpc/domains/finance';

import { serverEnv } from '~/lib/env';

export function createServerHonoClient(accessToken?: string, request?: Request) {
  const rawClient = createApiClient({
    baseUrl: serverEnv.VITE_PUBLIC_API_URL,
    getHeaders: async (): Promise<Record<string, string>> => {
      const headers: Record<string, string> = {}

      // Forward the incoming request's cookie (browser session cookie)
      // so the API can authenticate the SSR user.
      if (request) {
        const cookie = request.headers.get('cookie')
        if (cookie) {
          headers.cookie = cookie
        }
      }

      if (accessToken) {
        headers.authorization = `Bearer ${accessToken}`
      }

      return headers
    },
  })

  return {
    finance: createFinanceClient(rawClient as any),
  }
}
