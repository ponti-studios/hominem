import type { RefObject } from 'react';
import { useCallback, useRef } from 'react';

import { E2E_TESTING } from '~/constants';
import {
  captureAuthAnalyticsEvent,
  captureAuthAnalyticsFailure,
  markAuthPhaseStart,
  recordAuthEvent,
} from '~/services/auth/analytics';
import { restoreStoredSessionSnapshot, runAuthBoot } from '~/services/auth/boot';
import { createAuthBootAbortController } from '~/services/auth/boot-abort';
import { clearLegacyDataOnce } from '~/services/auth/boot-legacy-data';
import { probeAuthSession } from '~/services/auth/boot-session-probe';
import { getStoredSessionTokens } from '~/services/auth/boot-session-store';
import { getBootProfile, upsertBootProfile } from '~/services/auth/boot-user-profile';
import { clearPersistedSessionCookies } from '~/services/auth/session-cookie';
import type { AuthContext } from '~/services/auth/types';

export function useBootSequence(
  context: AuthContext,
  sessionCookieHeaderRef: RefObject<string | null>,
) {
  const { dispatch } = context;
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasBootstrappedRef = useRef(false);
  const isBootingRef = useRef(false);

  const bootSession = useCallback(
    async (input?: { signal?: AbortSignal }) => {
      if (hasBootstrappedRef.current || isBootingRef.current) return;
      isBootingRef.current = true;

      if (E2E_TESTING) {
        dispatch({ type: 'SESSION_EXPIRED' });
        hasBootstrappedRef.current = true;
        isBootingRef.current = false;
        return;
      }

      const startedAt = Date.now();
      let restoredFromLocal = false;

      markAuthPhaseStart('boot');
      recordAuthEvent('auth_boot_start', 'boot');
      captureAuthAnalyticsEvent('auth_boot_started', {
        phase: 'boot',
      });

      const bootAbort = createAuthBootAbortController(input?.signal);

      try {
        const storedSession = await restoreStoredSessionSnapshot({
          getStoredTokens: getStoredSessionTokens,
          getStoredProfile: getBootProfile,
          clearLegacyData: clearLegacyDataOnce,
        });

        if (storedSession) {
          restoredFromLocal = true;
          sessionCookieHeaderRef.current = storedSession.sessionCookieHeader;
          dispatch({ type: 'SESSION_LOADED', user: storedSession.user });
          dispatch({ type: 'SYNC_STARTED' });
        }

        const result = await runAuthBoot({
          getStoredTokens: getStoredSessionTokens,
          getStoredProfile: getBootProfile,
          probeSession: probeAuthSession,
          clearTokens: async () => {
            sessionCookieHeaderRef.current = null;
            await clearPersistedSessionCookies();
          },
          upsertProfile: upsertBootProfile,
          clearLegacyData: clearLegacyDataOnce,
          signal: bootAbort.signal,
        });

        if (result.type === 'SESSION_LOADED') {
          sessionCookieHeaderRef.current = result.tokens.sessionCookieHeader;
          dispatch({ type: 'SESSION_LOADED', user: result.user });
          recordAuthEvent('auth_boot_resolved:session_loaded', 'boot');
          captureAuthAnalyticsEvent('auth_boot_succeeded', {
            phase: 'boot',
            durationMs: Date.now() - startedAt,
            email: result.user.email,
          });
        } else {
          dispatch({ type: 'SESSION_EXPIRED' });
          recordAuthEvent('auth_boot_resolved:session_expired', 'boot');
          captureAuthAnalyticsEvent('auth_boot_signed_out', {
            phase: 'boot',
            durationMs: Date.now() - startedAt,
          });
        }

        hasBootstrappedRef.current = true;
      } catch (error) {
        const resolvedError =
          error instanceof Error ? error : new Error('Unable to recover your session right now.');

        recordAuthEvent('auth_boot_resolved:error', 'boot');
        captureAuthAnalyticsFailure('auth_boot_failed', {
          phase: 'boot',
          durationMs: Date.now() - startedAt,
          error: resolvedError,
          failureStage: 'network',
        });

        if (restoredFromLocal) {
          dispatch({ type: 'SYNC_COMPLETED' });
          hasBootstrappedRef.current = true;
          return;
        }

        dispatch({ type: 'SESSION_RECOVERY_FAILED', error: resolvedError });
        hasBootstrappedRef.current = true;
      } finally {
        bootAbort.cleanup();
        isBootingRef.current = false;
      }
    },
    [dispatch],
  );

  return {
    hasBootstrappedRef,
    isBootingRef,
    bootSession,
    abortControllerRef,
  };
}
