import { useAuthClient, useEmailAuth } from '@hominem/auth/client/provider';
import { maskEmail } from '@hominem/auth/shared/mask-email';
import { resolveAuthRedirect } from '@hominem/auth/shared/redirect-policy';
import { AuthScaffold, EmailEntryForm, OtpVerificationForm, translateUi } from '@hominem/ui';
import { useEffect, useState } from 'react';
import { redirect, useLocation, useNavigate } from 'react-router';

import { getServerAuth } from '~/lib/auth.server';

import type { Route } from './+types/index';
import { AUTH_CONFIG } from './config';

export const meta: Route.MetaFunction = () => [
  { title: 'Sign In — Florin' },
  {
    name: 'description',
    content: AUTH_CONFIG.description,
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await getServerAuth(request);
  if (user) {
    throw redirect(AUTH_CONFIG.defaultRedirect, { headers });
  }
  return null;
}

type LoginStep = 'email' | 'otp';

export default function AuthEntryPage() {
  const authClient = useAuthClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [loginStep, setLoginStep] = useState<LoginStep>('email');
  const searchParams = new URLSearchParams(location.search);
  const next = searchParams.get('next');
  const emailFromQuery = searchParams.get('email') ?? '';
  const postAuthRedirect = resolveAuthRedirect(next, AUTH_CONFIG.defaultRedirect, [
    ...AUTH_CONFIG.allowedRedirectPrefixes,
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
    verifyOtp: async (resolvedEmail, submittedOtp) => {
      const result = await authClient.signIn.emailOtp({
        email: resolvedEmail,
        otp: submittedOtp,
      });
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

  useEffect(() => {
    if (emailFromQuery && !email) {
      setEmail(emailFromQuery);
    }
  }, [emailFromQuery, email, setEmail]);

  if (loginStep === 'otp') {
    return (
      <AuthScaffold
        title={translateUi('auth.otpVerification.title')}
        helperText={translateUi('auth.otpVerification.helper', { email: maskEmail(email) })}
      >
        <OtpVerificationForm
          email={email}
          otp={otp}
          error={error ?? undefined}
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
    <AuthScaffold title={AUTH_CONFIG.title} helperText={AUTH_CONFIG.description}>
      <EmailEntryForm
        email={email}
        error={error ?? undefined}
        isSubmitting={isSubmitting}
        onEmailChange={(nextEmail) => {
          setEmail(nextEmail);
          setError(null);
        }}
        onSubmit={() => handleSendOtp(email)}
      />
    </AuthScaffold>
  );
}
