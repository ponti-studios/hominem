import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';

import { userContext } from '~/lib/middleware';

export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.get(userContext);

  if (!user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  return {
    googleTokens: [],
    message: 'Google provider token passthrough is disabled in Better Auth mode.',
  };
}
