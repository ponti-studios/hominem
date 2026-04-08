import { QueryClient } from '@tanstack/react-query';

import {
  authStateMachine,
  initialAuthState,
  type AuthEvent,
  type AuthState,
} from '../../utils/auth/types';
import {
  resolveAuthRedirect,
  type AuthRedirectTarget,
} from '../../utils/navigation/auth-route-guard';

interface AuthRouteSnapshot {
  authStatus: AuthState['status'];
  isSignedIn: boolean;
  segments: string[];
}

interface AuthIntegrationHarness {
  getState: () => AuthState;
  dispatch: (event: AuthEvent) => AuthState;
  resolveRoute: (segments: string[]) => AuthRedirectTarget | null;
}

export function createIntegrationQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function createAuthIntegrationHarness(seed?: Partial<AuthState>): AuthIntegrationHarness {
  let state: AuthState = {
    ...initialAuthState,
    ...seed,
  };

  return {
    getState: () => state,
    dispatch: (event: AuthEvent) => {
      state = authStateMachine(state, event);
      return state;
    },
    resolveRoute: (segments: string[]) =>
      resolveAuthRedirect({
        authStatus: state.status,
        isSignedIn: state.status === 'signed_in',
        segments,
      }),
  };
}

function snapshotFromState(state: AuthState, segments: string[]): AuthRouteSnapshot {
  return {
    authStatus: state.status,
    isSignedIn: state.status === 'signed_in',
    segments,
  };
}
