import type { User } from '@hominem/auth';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useRef } from 'react';

import { authClient } from '~/services/auth/auth-client';
import { captureAuthAnalyticsEvent, captureAuthAnalyticsFailure, markAuthPhaseStart, recordAuthEvent } from '~/services/auth/analytics';
import { runAuthBoot } from '~/services/auth/boot';
import { clearPersistedSessionCookies, getPersistedSessionCookieHeader } from '~/services/auth/session-cookie';
import { E2E_TESTING } from '~/constants';
import type { AuthContext } from '~/services/auth/types';
import { LocalStore } from '~/services/storage/sqlite';
import { markStartupPhase } from '~/services/performance/startup-metrics';

const LOCAL_MIGRATION_KEY = 'hominem_mobile_local_migration_v1';
const AUTH_BOOT_TIMEOUT_MS = 8000;

async function clearLegacyLocalDataOnce() {
  const migrationFlag = await SecureStore.getItemAsync(LOCAL_MIGRATION_KEY);
  if (migrationFlag === '1') return;
  await LocalStore.clearAllData();
  await SecureStore.setItemAsync(LOCAL_MIGRATION_KEY, '1');
}

interface SignInUser {
  id: string;
  email: string;
  name?: string | null;
}

function fromSignInUser(user: SignInUser): User {
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

export function useBootSequence(context: AuthContext) {
  const { dispatch } = context;
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionCookieHeaderRef = useRef<string | null>(null);
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
          getStoredTokens: async () => {
            const sessionCookieHeader = await getPersistedSessionCookieHeader();
            return { sessionCookieHeader };
          },
          probeSession: async ({ sessionCookieHeader, signal: sig }) => {
            const result = await authClient.getSession({
              fetchOptions: {
                signal: sig,
                headers: sessionCookieHeader ? { cookie: sessionCookieHeader } : undefined,
              },
            });
            if (result.data?.user && result.data.session?.id) {
              return { user: result.data.user };
            }
            if (result.error?.status === 401) {
              return null;
            }
            throw new Error(result.error?.message ?? 'session probe failed');
          },
          clearTokens: async () => {
            await clearPersistedSessionCookies();
            sessionCookieHeaderRef.current = null;
          },
          upsertProfile: async (user) => {
            const saved = await LocalStore.upsertUserProfile(fromSignInUser(user));
            return saved;
          },
          clearLegacyData: clearLegacyLocalDataOnce,
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
    sessionCookieHeaderRef,
    hasBootstrappedRef,
    isBootingRef,
    bootSession,
    abortControllerRef,
  };
}
