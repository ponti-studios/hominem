import { createApiClient } from '@hominem/rpc';

import { serverEnv } from '~/lib/env.server';

// Server-side finance client for route loaders. Forwards the caller's session
// cookie to the API; the finance routes stay thin loaders over RPC, never
// direct database access.
export function createFinanceServerClient(request: Request) {
  return createApiClient({
    baseUrl: serverEnv.HOMINEM_INTERNAL_API_URL,
    request,
    throwOnError: false,
  }).api.finance;
}
