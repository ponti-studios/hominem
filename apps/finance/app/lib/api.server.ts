import { createApiClient } from '@hominem/rpc';
import { createFinanceClient } from '@hominem/rpc/domains/finance';

import { serverEnv } from '~/lib/env';

export function createServerHonoClient(accessToken?: string, _request?: Request) {
  const rawClient = createApiClient({
    baseUrl: serverEnv.VITE_PUBLIC_API_URL,
    getHeaders: async (): Promise<Record<string, string>> => {
      if (accessToken) return { authorization: `Bearer ${accessToken}` };
      return {};
    },
  });

  return {
    finance: createFinanceClient(rawClient as any),
  };
}
