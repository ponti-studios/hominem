import type { User } from '@hominem/auth/types';

import { resolveIsLoadingAuth, resolveIsSignedIn } from './provider-utils';
import type { AuthState } from './types';

export interface AuthContextSnapshot {
  authStatus: AuthState['status'];
  authError: Error | null;
  isLoadingAuth: boolean;
  isSignedIn: boolean;
  currentUser: User | null;
}

export function mapAuthUser(user: AuthState['user']): User | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function createAuthContextSnapshot(state: AuthState): AuthContextSnapshot {
  return {
    authStatus: state.status,
    authError: state.error,
    isLoadingAuth: resolveIsLoadingAuth(state),
    isSignedIn: resolveIsSignedIn(state),
    currentUser: mapAuthUser(state.user),
  };
}
