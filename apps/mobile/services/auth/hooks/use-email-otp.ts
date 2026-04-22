import type { User } from '@hominem/auth/types';
import type { RefObject } from 'react';
import { useCallback } from 'react';

import { captureAuthAnalyticsEvent, captureAuthAnalyticsFailure } from '~/services/auth/analytics';
import { authClient } from '~/services/auth/auth-client';
import { getPersistedSessionCookieHeader } from '~/services/auth/session-cookie';
import type { AuthContext } from '~/services/auth/types';
import { LocalStore } from '~/services/storage/sqlite';

const OTP_REQUEST_TIMEOUT_MS = 12000;
const OTP_VERIFY_TIMEOUT_MS = 20000;

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

export function useEmailOtp(
  context: AuthContext,
  sessionCookieHeaderRef: RefObject<string | null>,
) {
  const { dispatch } = context;

  const requestEmailOtp = useCallback(
    async (email: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OTP_REQUEST_TIMEOUT_MS);
      const startedAt = Date.now();

      dispatch({ type: 'OTP_REQUEST_STARTED' });
      captureAuthAnalyticsEvent('auth_email_otp_request_started', {
        phase: 'email_otp_request',
        email,
      });

      try {
        const result = await authClient.emailOtp.sendVerificationOtp({
          email,
          type: 'sign-in',
          fetchOptions: {
            signal: controller.signal,
          },
        });

        if (result.error) {
          throw new Error(result.error.message ?? 'Unable to send verification code.');
        }
      } catch (error) {
        const resolvedError =
          error instanceof Error && error.name === 'AbortError'
            ? new Error('Request timed out. Please try again.')
            : error instanceof Error
              ? error
              : new Error('Unable to send verification code.');
        dispatch({ type: 'OTP_REQUEST_FAILED', error: resolvedError });
        captureAuthAnalyticsFailure('auth_email_otp_request_failed', {
          phase: 'email_otp_request',
          durationMs: Date.now() - startedAt,
          email,
          error: resolvedError,
          failureStage: 'network',
        });
        throw resolvedError;
      } finally {
        clearTimeout(timeoutId);
      }

      dispatch({ type: 'OTP_REQUESTED' });
      captureAuthAnalyticsEvent('auth_email_otp_request_succeeded', {
        phase: 'email_otp_request',
        durationMs: Date.now() - startedAt,
        email,
        statusCode: 200,
      });
    },
    [dispatch],
  );

  const verifyEmailOtp = useCallback(
    async (input: { email: string; otp: string; name?: string }) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OTP_VERIFY_TIMEOUT_MS);
      const startedAt = Date.now();

      dispatch({ type: 'OTP_VERIFICATION_STARTED' });
      captureAuthAnalyticsEvent('auth_email_otp_verify_started', {
        phase: 'email_otp_verify',
        email: input.email,
      });

      try {
        const result = await authClient.signIn.emailOtp({
          email: input.email,
          otp: input.otp,
          ...(input.name ? { name: input.name } : {}),
          fetchOptions: {
            signal: controller.signal,
          },
        });

        if (result.error || !result.data) {
          throw new Error(result.error?.message ?? 'Verification failed. Please try again.');
        }

        const signInData = result.data as SignInResponse;

        if (!hasValidSignInResponse(signInData)) {
          throw new Error('Invalid sign-in response from API');
        }

        const sessionCookieHeader = await getPersistedSessionCookieHeader();
        if (!sessionCookieHeader) {
          throw new Error('Verification succeeded but no session cookie was returned');
        }
        sessionCookieHeaderRef.current = sessionCookieHeader;

        dispatch({ type: 'PROFILE_SYNC_STARTED' });
        const localUser = fromSignInUser(signInData.user);
        const saved = await LocalStore.upsertUserProfile(localUser);
        const userProfile = toAuthUserProfile(saved);
        if (!userProfile) throw new Error('Failed to create user profile');

        dispatch({ type: 'SESSION_LOADED', user: userProfile });
        captureAuthAnalyticsEvent('auth_email_otp_verify_succeeded', {
          phase: 'email_otp_verify',
          durationMs: Date.now() - startedAt,
          email: input.email,
          statusCode: 200,
        });
      } catch (error) {
        const resolvedError = error instanceof Error ? error : new Error('Sign-in failed');
        dispatch({ type: 'OTP_VERIFICATION_FAILED', error: resolvedError });
        captureAuthAnalyticsFailure('auth_email_otp_verify_failed', {
          phase: 'email_otp_verify',
          durationMs: Date.now() - startedAt,
          email: input.email,
          error: resolvedError,
          failureStage: 'unknown',
        });
        throw resolvedError;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [dispatch],
  );

  return { requestEmailOtp, verifyEmailOtp };
}
