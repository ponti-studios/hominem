import type { AuthStatusCompat } from './provider-utils';

export interface ProtectedRouteStateInput {
  authStatus: AuthStatusCompat;
  isSignedIn: boolean;
}

export interface ProtectedRouteStateOutput {
  showFallback: boolean;
}

export function resolveProtectedRouteState(
  input: ProtectedRouteStateInput,
): ProtectedRouteStateOutput {
  return {
    showFallback: input.authStatus === 'booting' || !input.isSignedIn,
  };
}
