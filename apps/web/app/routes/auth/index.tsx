'use client';

import { usePasskeys } from '@hominem/auth/client/passkey';
import { useAuthClient } from '@hominem/auth/client/provider';
import { EmailEntryForm, OtpVerificationForm } from '@hominem/ui';
import { useEffect, useState } from 'react';
import { redirect, useLocation, useNavigate } from 'react-router';

import { userContext } from '~/lib/middleware';

import type { Route } from './+types/index';
import { useEmailAuth } from './use-email-auth';

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

  const { error, email, handleSendOtp, handleVerifyOtp, handleResendOtp } = useEmailAuth({
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
      navigate('/inbox');
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
  const next = new URLSearchParams(location.search).get('next');
  const resolvedError = callbackError ?? passkeyError ?? error ?? undefined;

  if (loginStep === 'otp') {
    return (
      <OtpVerificationForm
        email={email}
        defaultNext="/inbox"
        error={resolvedError}
        onSubmit={async ({ email: submittedEmail, otp }) => {
          await handleVerifyOtp(submittedEmail, otp);
        }}
        onResend={async (submittedEmail) => {
          await handleResendOtp(submittedEmail);
        }}
        onChangeEmail={() => setLoginStep('email')}
      />
    );
  }

  return (
    <EmailEntryForm
      next={next}
      onSubmit={async ({ email: submittedEmail }) => {
        await handleSendOtp(submittedEmail);
      }}
      {...(resolvedError ? { error: resolvedError } : {})}
      {...(isMounted && isPasskeySupported
        ? {
            onPasskeyClick: async () => {
              try {
                await authenticate();
                navigate('/inbox');
              } catch {
                // Error is already handled by usePasskeys and available via passkeyError
              }
            },
          }
        : {})}
    />
  );
}
