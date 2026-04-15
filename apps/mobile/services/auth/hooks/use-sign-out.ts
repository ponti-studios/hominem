import type { RefObject } from 'react';
import { useCallback } from 'react';

import { authClient } from '~/services/auth/auth-client';
import { captureAuthAnalyticsEvent, captureAuthAnalyticsFailure } from '~/services/auth/analytics';
import { clearPersistedSessionCookies } from '~/services/auth/session-cookie';
import type { AuthContext } from '~/services/auth/types';
import { LocalStore } from '~/services/storage/sqlite';

export function useSignOut(context: AuthContext, sessionCookieHeaderRef: RefObject<string | null>) {
  const { state, dispatch } = context;

  const signOut = useCallback(async () => {
    const startedAt = Date.now();

    dispatch({ type: 'SIGN_OUT_REQUESTED' });
    captureAuthAnalyticsEvent('auth_sign_out_started', {
      phase: 'sign_out',
      email: state.user?.email ?? undefined,
    });

    try {
      const result = await authClient.signOut();
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to sign out. Please try again.');
      }

      await clearPersistedSessionCookies();
      sessionCookieHeaderRef.current = null;
      await LocalStore.clearAllData();
      dispatch({ type: 'SIGN_OUT_SUCCESS' });
      captureAuthAnalyticsEvent('auth_sign_out_succeeded', {
        phase: 'sign_out',
        durationMs: Date.now() - startedAt,
        email: state.user?.email ?? undefined,
        statusCode: 200,
      });
    } catch (error) {
      const resolvedError =
        error instanceof Error ? error : new Error('Failed to sign out. Please try again.');
      dispatch({ type: 'FATAL_ERROR', error: resolvedError });
      captureAuthAnalyticsFailure('auth_sign_out_failed', {
        phase: 'sign_out',
        durationMs: Date.now() - startedAt,
        email: state.user?.email ?? undefined,
        error: resolvedError,
        failureStage: 'network',
      });
      throw resolvedError;
    }
  }, [dispatch, state.user?.email]);

  return { signOut };
}
