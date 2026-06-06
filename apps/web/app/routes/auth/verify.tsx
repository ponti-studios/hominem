'use client';

import { useAuthClient } from '@hominem/auth/client/provider';
import { OtpVerificationForm } from '@hominem/ui';
import { redirect, useLoaderData, useNavigate } from 'react-router';

import { userContext } from '~/lib/middleware';

import type { Route } from './+types/verify';
import { useEmailAuth } from './use-email-auth';

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (user) {
    throw redirect('/inbox');
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
  const { email: loaderEmail } = useLoaderData<{ email: string }>();
  const navigate = useNavigate();

  const { error, handleVerifyOtp, handleResendOtp } = useEmailAuth(
    {
      sendOtp: async () => {},
      verifyOtp: async (email, otp) => {
        const result = await authClient.signIn.emailOtp({ email, otp });
        if (result.error || !result.data?.user?.id) {
          throw new Error(
            result.error?.message ?? 'Verification failed. Please check your code and try again.',
          );
        }
        navigate('/inbox');
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
    <OtpVerificationForm
      error={error ?? undefined}
      onSubmit={async ({ email, otp }) => {
        await handleVerifyOtp(email, otp);
      }}
      onResend={async (resolvedEmail) => {
        await handleResendOtp(resolvedEmail);
      }}
      email={loaderEmail}
      defaultNext="/inbox"
      onChangeEmail={() => {
        navigate('/auth');
      }}
    />
  );
}
