import { useCallback } from 'react';

import type { HominemAuthUser } from '~/modules/hominem-auth-bridge';
import { captureAuthAnalyticsEvent, captureAuthAnalyticsFailure } from '~/services/auth/analytics';
import { authClient } from '~/services/auth/auth-client';

export function useEmailOtp(onAuthenticated: (user: HominemAuthUser) => void = () => {}) {
  const requestEmailOtp = useCallback(async (email: string) => {
    const startedAt = Date.now();

    captureAuthAnalyticsEvent('auth_email_otp_request_started', {
      phase: 'email_otp_request',
      email,
    });

    try {
      await authClient.requestEmailOtp(email);
    } catch (error) {
      const resolvedError =
        error instanceof Error && error.name === 'AbortError'
          ? new Error('Request timed out. Please try again.')
          : error instanceof Error
            ? error
            : new Error('Unable to send verification code.');
      captureAuthAnalyticsFailure('auth_email_otp_request_failed', {
        phase: 'email_otp_request',
        durationMs: Date.now() - startedAt,
        email,
        error: resolvedError,
      });
      throw resolvedError;
    }

    captureAuthAnalyticsEvent('auth_email_otp_request_succeeded', {
      phase: 'email_otp_request',
      durationMs: Date.now() - startedAt,
      email,
    });
  }, []);

  const verifyEmailOtp = useCallback(
    async (input: { email: string; otp: string; name?: string }) => {
      const startedAt = Date.now();
      let statusCode: number | undefined;

      captureAuthAnalyticsEvent('auth_email_otp_verify_started', {
        phase: 'email_otp_verify',
        email: input.email,
      });

      try {
        let user = await authClient.verifyEmailOtp({ email: input.email, otp: input.otp });
        if (input.name) {
          user = await authClient.updateUser({ name: input.name });
        }
        statusCode = 200;
        onAuthenticated(user);

        captureAuthAnalyticsEvent('auth_email_otp_verify_succeeded', {
          phase: 'email_otp_verify',
          durationMs: Date.now() - startedAt,
          email: input.email,
          statusCode,
        });
      } catch (error) {
        const resolvedError = error instanceof Error ? error : new Error('Sign-in failed');
        captureAuthAnalyticsFailure('auth_email_otp_verify_failed', {
          phase: 'email_otp_verify',
          durationMs: Date.now() - startedAt,
          email: input.email,
          error: resolvedError,
          statusCode,
        });
        throw resolvedError;
      }
    },
    [onAuthenticated],
  );

  return { requestEmailOtp, verifyEmailOtp };
}
