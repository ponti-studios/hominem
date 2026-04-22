import type { RefObject } from 'react';
import { useCallback, useRef } from 'react';

import { E2E_TESTING } from '~/constants';
import {
  captureAuthAnalyticsEvent,
  captureAuthAnalyticsFailure,
  markAuthPhaseStart,
  recordAuthEvent,
} from '~/services/auth/analytics';
import { runAuthBoot } from '~/services/auth/boot';
import { clearLegacyDataOnce } from '~/services/auth/boot-legacy-data';
import { probeAuthSession } from '~/services/auth/boot-session-probe';
import { getStoredSessionTokens } from '~/services/auth/boot-session-store';
import { upsertBootProfile } from '~/services/auth/boot-user-profile';
import type { AuthContext } from '~/services/auth/types';
import { markStartupPhase } from '~/services/performance/startup-metrics';

const AUTH_BOOT_TIMEOUT_MS = 8000;

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
        markStartupPhase('auth_boot_start');
        markStartupPhase('auth_boot_resolved');
        hasBootstrappedRef.current = true;
        isBootingRef.current = false;
        return;
      }

      const startedAt = Date.now();

      markStartupPhase('auth_boot_start');
      markAuthPhaseStart('boot');
      recordAuthEvent('auth_boot_start', 'boot');
      captureAuthAnalyticsEvent('auth_boot_started', {
        phase: 'boot',
      });

      const controller = new AbortController();
      const signal = input?.signal ?? controller.signal;
      const timeoutId = setTimeout(() => controller.abort(), AUTH_BOOT_TIMEOUT_MS);

      try {
        const result = await runAuthBoot({
          getStoredTokens: getStoredSessionTokens,
          probeSession: probeAuthSession,
          clearTokens: async () => {
            sessionCookieHeaderRef.current = null;
          },
          upsertProfile: upsertBootProfile,
          clearLegacyData: clearLegacyDataOnce,
          signal,
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

        markStartupPhase('auth_boot_resolved');
        hasBootstrappedRef.current = true;
      } catch (error) {
        const resolvedError =
          error instanceof Error ? error : new Error('Unable to recover your session right now.');
        dispatch({ type: 'SESSION_RECOVERY_FAILED', error: resolvedError });
        recordAuthEvent('auth_boot_resolved:error', 'boot');
        captureAuthAnalyticsFailure('auth_boot_failed', {
          phase: 'boot',
          durationMs: Date.now() - startedAt,
          error: resolvedError,
          failureStage: 'network',
        });
        markStartupPhase('auth_boot_resolved');
        hasBootstrappedRef.current = true;
      } finally {
        clearTimeout(timeoutId);
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
