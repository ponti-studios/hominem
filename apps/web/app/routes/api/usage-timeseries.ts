import { createApiClient } from '@hominem/rpc';

import { serverEnv } from '~/lib/env.server';
import { userContext } from '~/lib/middleware';

import type { Route } from './+types/usage-timeseries';

function unauthorizedResponse() {
  return Response.json({ error: 'Authentication required' }, { status: 401 });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  if (!context.get(userContext)) {
    return unauthorizedResponse();
  }

  const requestUrl = new URL(request.url);
  const from = requestUrl.searchParams.get('from');
  const to = requestUrl.searchParams.get('to');
  const granularity = requestUrl.searchParams.get('granularity');
  if (!from || !to || (granularity !== 'day' && granularity !== 'month')) {
    return Response.json({ error: 'Invalid usage timeseries query' }, { status: 400 });
  }

  const cookie = request.headers.get('cookie');
  const response = await createApiClient({
    baseUrl: serverEnv.HOMINEM_INTERNAL_API_URL,
    request,
    throwOnError: false,
  }).api.usage['timeseries'].$get(
    {
      query: {
        from,
        to,
        granularity,
      },
    },
    {
      headers: cookie ? { cookie } : undefined,
      init: { signal: request.signal },
    },
  );

  return new Response(response.body, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
}
