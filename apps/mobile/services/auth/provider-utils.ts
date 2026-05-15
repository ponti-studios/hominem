import type { AuthState } from './types';

export type AuthStatusCompat = AuthState['status'];

export function resolveIsSignedIn(state: AuthState): boolean {
  return state.user !== null && state.status !== 'signed_out' && state.status !== 'signing_out';
}

export function resolveIsLoadingAuth(state: AuthState): boolean {
  return state.isLoading || state.status === 'booting';
}
