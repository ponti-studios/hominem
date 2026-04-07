import { AUTH_COPY, maskEmail } from '@hominem/auth';
import { useAuthClient } from '@hominem/auth/client';
import { resolveSafeAuthRedirect } from '@hominem/auth/server-utils';
import { AuthScaffold, OtpVerificationForm } from '@hominem/ui';
import { useCallback } from 'react';
import { redirect, useLoaderData, useLocation, useNavigate } from 'react-router';

import { AUTH_CONFIG } from './config';
import { getNextRedirect } from './shared';
import { redirectAuthenticatedUser } from './shared.server';

export async function loader({ request }: { request: Request }) {
  const redirectResponse = await redirectAuthenticatedUser(request);
  if (redirectResponse) {
    return redirectResponse;
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  if (!email) {
    return redirect('/auth');
  }

  return { email };
}

export default function Component() {
  const authClient = useAuthClient();
  const { email } = useLoaderData<{ email: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const next = getNextRedirect(location.search);
  const verifyEmailOtp = useCallback(
    async (input: { email: string; otp: string; next: string }) => {
      const destination = resolveSafeAuthRedirect(input.next, AUTH_CONFIG.defaultRedirect, [
        ...AUTH_CONFIG.allowedRedirectPrefixes,
      ]);

      if (!input.email || !input.otp) {
        throw new Error('Email and verification code are required.');
      }

      const result = await authClient.signIn.emailOtp({
        email: input.email,
        otp: input.otp,
      });

      if (result.error || !result.data?.user?.id) {
        throw new Error(
          result.error?.message ?? 'Verification failed. Please check your code and try again.',
        );
      }

      navigate(destination);
    },
    [authClient, navigate],
  );
  const resendOtp = useCallback(
    async (resolvedEmail: string) => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: resolvedEmail,
        type: 'sign-in',
      });

      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to send verification code');
      }
    },
    [authClient],
  );

  return (
    <AuthScaffold
      title={AUTH_COPY.otpVerification.title}
      helper={AUTH_COPY.otpVerification.helper(maskEmail(email))}
    >
      <OtpVerificationForm
        action={`/auth/verify${location.search}`}
        onSubmit={verifyEmailOtp}
        onResend={resendOtp}
        email={email}
        defaultNext={AUTH_CONFIG.defaultRedirect}
        onChangeEmail={() => {
          const authUrl = new URL('/auth', window.location.origin);
          authUrl.searchParams.set('next', next);
          window.location.assign(`${authUrl.pathname}${authUrl.search}`);
        }}
      />
    </AuthScaffold>
  );
}
