import { redirect } from 'react-router';

import { buildAuthRedirectFromUrl } from './auth-redirect';
import { getServerAuth } from './auth.server';

/**
 * Require authentication - redirects to login if not authenticated.
 * Returns headers that MUST be included in the response.
 */
export async function requireAuth(request: Request) {
  const { user, headers } = await getServerAuth(request);

  if (!user) {
    throw redirect(buildAuthRedirectFromUrl(new URL(request.url)), { headers });
  }

  return { user, headers };
}
