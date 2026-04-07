import { resolveSafeAuthRedirect } from '@hominem/auth/server-utils';
import { redirect } from 'react-router';

import { getServerAuth } from '~/lib/auth.server';

import { AUTH_CONFIG } from './config';

export async function redirectAuthenticatedUser(request: Request) {
  const { user, headers } = await getServerAuth(request);
  if (!user) {
    return null;
  }

  const url = new URL(request.url);
  return redirect(
    resolveSafeAuthRedirect(url.searchParams.get('next'), AUTH_CONFIG.defaultRedirect, [
      ...AUTH_CONFIG.allowedRedirectPrefixes,
    ]),
    { headers },
  );
}

export function getNextRedirect(search: string) {
  return new URLSearchParams(search).get('next') ?? AUTH_CONFIG.defaultRedirect;
}
