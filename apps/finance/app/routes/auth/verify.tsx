import { redirect } from 'react-router';

import type { Route } from './+types/verify';

/**
 * Legacy verify URL — OTP now lives on /auth as a client step.
 * Preserve deep links that include ?email=.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const next = url.searchParams.get('next');
  const params = new URLSearchParams();
  if (email) params.set('email', email);
  if (next) params.set('next', next);
  const qs = params.toString();
  throw redirect(qs ? `/auth?${qs}` : '/auth');
}

export default function AuthVerifyRedirect() {
  return null;
}
