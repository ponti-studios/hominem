import type { User } from '@hominem/auth';
import { useCallback } from 'react';

import { authClient } from '~/services/auth/auth-client';
import { captureAuthAnalyticsEvent, captureAuthAnalyticsFailure } from '~/services/auth/analytics';
import { getPersistedSessionCookieHeader } from '~/services/auth/session-cookie';
import type { AuthContext } from '~/services/auth/types';
import { LocalStore } from '~/services/storage/sqlite';

interface SignInResponse {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

function hasValidSignInResponse(input: SignInResponse) {
  return input.user.id.length > 0 && input.user.email.length > 0;
}

function fromSignInUser(user: { id: string; email: string; name?: string | null }): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? '',
    image: null,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function toAuthUserProfile(localProfile: User | null): AuthContext['state']['user'] {
  if (!localProfile) return null;
  return {
    id: localProfile.id,
    email: localProfile.email,
    name: localProfile.name,
    image: localProfile.image,
    emailVerified: localProfile.emailVerified,
    createdAt: localProfile.createdAt,
    updatedAt: localProfile.updatedAt,
  };
}

export function usePasskeyAuth(context: AuthContext) {
  const { dispatch } = context;

  const completePasskeySignIn = useCallback(
    async (input: SignInResponse) => {
      const startedAt = Date.now();

      dispatch({ type: 'PASSKEY_AUTH_STARTED' });
      captureAuthAnalyticsEvent('auth_passkey_sign_in_started', {
        phase: 'passkey_sign_in',
        email: input.user.email,
      });

      try {
        if (!hasValidSignInResponse(input)) {
          throw new Error('Invalid passkey sign-in response from API');
        }

        const sessionCookieHeader = await getPersistedSessionCookieHeader();
        if (!sessionCookieHeader) {
          throw new Error('Missing Better Auth session cookie after passkey sign-in');
        }

        dispatch({ type: 'PROFILE_SYNC_STARTED' });
        const localUser = fromSignInUser(input.user);
        const saved = await LocalStore.upsertUserProfile(localUser);
        const userProfile = toAuthUserProfile(saved);
        if (!userProfile) throw new Error('Failed to create passkey user profile');

        dispatch({ type: 'SESSION_LOADED', user: userProfile });
        captureAuthAnalyticsEvent('auth_passkey_sign_in_succeeded', {
          phase: 'passkey_sign_in',
          durationMs: Date.now() - startedAt,
          email: input.user.email,
        });
      } catch (error) {
        const resolvedError = error instanceof Error ? error : new Error('Passkey sign-in failed');
        dispatch({ type: 'PASSKEY_AUTH_FAILED', error: resolvedError });
        captureAuthAnalyticsFailure('auth_passkey_sign_in_failed', {
          phase: 'passkey_sign_in',
          durationMs: Date.now() - startedAt,
          email: input.user.email,
          error: resolvedError,
          failureStage: 'storage',
        });
        throw resolvedError;
      }
    },
    [dispatch],
  );

  return { completePasskeySignIn };
}