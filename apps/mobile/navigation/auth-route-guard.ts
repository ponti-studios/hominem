import type { AuthStatusCompat } from '~/services/auth/provider-utils';

interface ResolveAuthRedirectInput {
  authStatus: AuthStatusCompat;
  isSignedIn: boolean;
  segments: string[];
}

export type AuthRedirectTarget = '/(auth)' | '/(protected)/(tabs)/';

const NO_REDIRECT_STATUSES = new Set(['booting', 'signing_out']);

export function resolveAuthRedirect(input: ResolveAuthRedirectInput): AuthRedirectTarget | null {
  if (NO_REDIRECT_STATUSES.has(input.authStatus)) {
    return null;
  }

  const inProtectedGroup = input.segments[0] === '(protected)';
  const inAuthGroup = input.segments[0] === '(auth)';

  if (!input.isSignedIn && inProtectedGroup) {
    return '/(auth)';
  }

  if (input.isSignedIn && inAuthGroup) {
    return '/(protected)/(tabs)/';
  }

  return null;
}
