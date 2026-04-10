import type { User } from '@hominem/auth';

import type { AuthState } from './types';
import { resolveIsLoadingAuth } from './provider-utils';

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
    isSignedIn: state.status === 'signed_in',
    currentUser: mapAuthUser(state.user),
  };
}
