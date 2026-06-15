'use client';

import { usePasskeys } from '@hominem/auth/client/passkey';
import { useAuthClient, useEmailAuth } from '@hominem/auth/client/provider';
import { maskEmail } from '@hominem/auth/shared/mask-email';
import { resolveAuthRedirect } from '@hominem/auth/shared/redirect-policy';
import { AuthScaffold, EmailEntryForm, OtpVerificationForm, translateUi } from '@hominem/ui';
import { useEffect, useState } from 'react';
import { redirect, useLocation, useNavigate } from 'react-router';

import { userContext } from '~/lib/middleware';

import type { Route } from './+types/login';

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (user) {
    throw redirect('/inbox');
  }
  return null;
}

type LoginStep = 'email' | 'otp';

export default function Component() {
  const authClient = useAuthClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);
  const [loginStep, setLoginStep] = useState<LoginStep>('email');

  const {
    authenticate,
    authError: passkeyError,
    isSupported: isPasskeySupported,
  } = usePasskeys({ enabled: true });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const next = new URLSearchParams(location.search).get('next');
  const postAuthRedirect = resolveAuthRedirect(next, '/inbox', [
    '/inbox',
    '/note',
    '/chat',
    '/account',
    '/settings',
  ]).safeRedirect;

  const {
    error,
    email,
    setEmail,
    otp,
    setOtp,
    setError,
    isSubmitting,
    isResending,
    handleSendOtp,
    handleVerifyOtp,
    handleResendOtp,
  } = useEmailAuth({
    sendOtp: async (resolvedEmail) => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: resolvedEmail,
        type: 'sign-in',
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to send verification code');
      }
      setLoginStep('otp');
    },
    verifyOtp: async (resolvedEmail, otp) => {
      const result = await authClient.signIn.emailOtp({ email: resolvedEmail, otp });
      if (result.error || !result.data?.user?.id) {
        throw new Error(
          result.error?.message ?? 'Verification failed. Please check your code and try again.',
        );
      }
      navigate(postAuthRedirect);
    },
    resendOtp: async (resolvedEmail) => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: resolvedEmail,
        type: 'sign-in',
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to resend verification code');
      }
    },
  });

  const callbackError = new URLSearchParams(location.search).get('error');
  const resolvedError = callbackError ?? passkeyError ?? error ?? undefined;

  if (loginStep === 'otp') {
    return (
      <AuthScaffold
        title={translateUi('auth.otpVerification.title')}
        helperText={translateUi('auth.otpVerification.helper', { email: maskEmail(email) })}
      >
        <OtpVerificationForm
          email={email}
          otp={otp}
          error={resolvedError}
          isSubmitting={isSubmitting}
          isResending={isResending}
          onOtpChange={(nextOtp) => {
            setOtp(nextOtp);
            setError(null);
          }}
          onSubmit={() => handleVerifyOtp(email, otp)}
          onResend={() => handleResendOtp(email)}
          onChangeEmail={() => setLoginStep('email')}
        />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold title={translateUi('auth.emailEntry.title')}>
      <EmailEntryForm
        email={email}
        isSubmitting={isSubmitting}
        onEmailChange={(nextEmail) => {
          setEmail(nextEmail);
          setError(null);
        }}
        onSubmit={() => handleSendOtp(email)}
        {...(resolvedError ? { error: resolvedError } : {})}
        {...(isMounted && isPasskeySupported
          ? {
              onPasskeyClick: async () => {
                try {
                  await authenticate();
                  navigate(postAuthRedirect);
                } catch {
                  // Error is already handled by usePasskeys and available via passkeyError
                }
              },
            }
          : {})}
      />
    </AuthScaffold>
  );
}
