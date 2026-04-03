import { useMemo } from 'react';

import { useAuth } from './auth-provider';

type AuthStatus =
  | 'booting'
  | 'signed_out'
  | 'requesting_otp'
  | 'otp_requested'
  | 'verifying_otp'
  | 'syncing_profile'
  | 'authenticating_passkey'
  | 'refreshing_session'
  | 'signed_in'
  | 'signing_out'
  | 'degraded'
  | 'terminal_error';

interface AuthState {
  status: AuthStatus;
  user: {
    id: string;
    email: string;
    name?: string | undefined;
    image?: string | undefined;
    createdAt: string;
    updatedAt: string;
  } | null;
  error: Error | null;
  isLoading: boolean;
}

export function useAuthState(): AuthState {
  const { authStatus, isLoadingAuth, currentUser } = useAuth();

  const state = useMemo<AuthState>(() => {
    const status = mapToCanonicalStatus(authStatus);
    return {
      status,
      user: currentUser
        ? {
            id: currentUser.id,
            email: currentUser.email ?? '',
            name: currentUser.name ?? undefined,
            image: currentUser.image ?? undefined,
            createdAt: new Date(currentUser.createdAt as unknown as string | Date).toISOString(),
            updatedAt: new Date(currentUser.updatedAt as unknown as string | Date).toISOString(),
          }
        : null,
      error: null,
      isLoading: isLoadingAuth,
    };
  }, [authStatus, currentUser, isLoadingAuth]);

  return state;
}

function mapToCanonicalStatus(status: string): AuthStatus {
  const statusMap: Record<string, AuthStatus> = {
    booting: 'booting',
    signed_out: 'signed_out',
    requesting_otp: 'requesting_otp',
    otp_requested: 'otp_requested',
    verifying_otp: 'verifying_otp',
    authenticating_passkey: 'authenticating_passkey',
    refreshing_session: 'refreshing_session',
    signed_in: 'signed_in',
    signing_out: 'signing_out',
    degraded: 'degraded',
  };
  return statusMap[status] ?? 'signed_out';
}
