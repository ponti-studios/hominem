import { useAuthClient } from '@hominem/auth/client/provider';
import { OtpVerificationForm } from '@hominem/ui';
import type { MetaFunction } from 'react-router';
import { redirect, useLoaderData, useLocation, useNavigate } from 'react-router';

import { getServerSession } from '~/lib/auth.server';

export const meta: MetaFunction = () => [{ title: 'Verify - Craftd' }];

export async function loader({ request }: { request: Request }) {
  const { user } = await getServerSession(request);
  if (user) {
    throw redirect('/account');
  }
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  if (!email) {
    throw redirect('/login');
  }
  return { email };
}

export default function Verify() {
  const authClient = useAuthClient();
  const { email } = useLoaderData<{ email: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const next = new URLSearchParams(location.search).get('next') ?? '/account';

  return (
    <OtpVerificationForm
      email={email}
      defaultNext={next}
      onSubmit={async ({ email: resolvedEmail, otp }) => {
        const result = await authClient.signIn.emailOtp({
          email: resolvedEmail,
          otp,
        });
        if (result.error || !result.data?.user?.id) {
          throw new Error(
            result.error?.message ?? 'Verification failed. Please check your code and try again.',
          );
        }
        navigate(next);
      }}
      onResend={async (resolvedEmail) => {
        const result = await authClient.emailOtp.sendVerificationOtp({
          email: resolvedEmail,
          type: 'sign-in',
        });
        if (result.error) {
          throw new Error(result.error.message ?? 'Failed to resend verification code');
        }
      }}
      onChangeEmail={() => {
        navigate(`/login?next=${encodeURIComponent(next)}`);
      }}
    />
  );
}
