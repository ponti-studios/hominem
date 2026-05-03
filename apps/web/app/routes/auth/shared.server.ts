import { resolveAuthRedirect as resolveSafeAuthRedirect } from '@hominem/auth/shared/redirect-policy';
import { redirect } from 'react-router';

import { NOTES_AUTH_CONFIG } from '~/config/auth';
import { getServerSession } from '~/lib/auth.server';

export async function redirectAuthenticatedUser(request: Request) {
  const { user, headers } = await getServerSession(request);
  if (!user) {
    return null;
  }

  const url = new URL(request.url);
  const { safeRedirect } = resolveSafeAuthRedirect(
    url.searchParams.get('next'),
    NOTES_AUTH_CONFIG.defaultPostAuthDestination,
    [...NOTES_AUTH_CONFIG.allowedDestinations],
  );
  return redirect(safeRedirect, { headers });
}
