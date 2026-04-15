'use client';

import { AUTH_COPY, maskEmail } from '@hominem/auth';
import { useAuthClient } from '@hominem/auth/client';
import { resolveSafeAuthRedirect } from '@hominem/auth/server-utils';
import { AuthScaffold, OtpVerificationForm } from '@hominem/ui';
import { redirect, useLoaderData, useLocation, useNavigate } from 'react-router';

import { AUTH_CONFIG } from './config';
import { useEmailAuth } from './use-email-auth';
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
  // Skip rendering on server
  if (typeof window === 'undefined') {
    return <div>Loading...</div>;
  }

  const authClient = useAuthClient();
  const { email: loaderEmail } = useLoaderData<{ email: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const next = getNextRedirect(location.search);

  const { error, handleVerifyOtp, handleResendOtp } = useEmailAuth(
    {
      sendOtp: async () => {},
      verifyOtp: async (email, otp) => {
        const destination = resolveSafeAuthRedirect(next, AUTH_CONFIG.defaultRedirect, [
          ...AUTH_CONFIG.allowedRedirectPrefixes,
        ]);
        const result = await authClient.signIn.emailOtp({ email, otp });
        if (result.error || !result.data?.user?.id) {
          throw new Error(
            result.error?.message ?? 'Verification failed. Please check your code and try again.',
          );
        }
        navigate(destination);
      },
      resendOtp: async (email) => {
        const result = await authClient.emailOtp.sendVerificationOtp({
          email,
          type: 'sign-in',
        });
        if (result.error) {
          throw new Error(result.error.message ?? 'Failed to send verification code');
        }
      },
    },
    { onVerified: () => {} },
  );

  return (
    <AuthScaffold
      title={AUTH_COPY.otpVerification.title}
      helper={AUTH_COPY.otpVerification.helper(maskEmail(loaderEmail))}
    >
      <OtpVerificationForm
        action={`/auth/verify${location.search}`}
        error={error ?? undefined}
        onSubmit={async ({ email, otp }) => {
          await handleVerifyOtp(email, otp);
        }}
        onResend={async (resolvedEmail) => {
          await handleResendOtp(resolvedEmail);
        }}
        email={loaderEmail}
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
