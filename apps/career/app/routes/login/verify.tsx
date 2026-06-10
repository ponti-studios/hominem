import { useAuthClient } from '@hominem/auth/client/provider';
import { OtpVerificationForm } from '@hominem/ui';
import { redirect, useNavigate } from 'react-router';

import { userContext } from '~/lib/middleware';

import { Route } from './+types/verify';

export const meta: Route.MetaFunction = () => [{ title: 'Verify - Craftd' }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (user) throw redirect('/account');

  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  if (!email) throw redirect('/login');

  return { email };
}

export default function Verify({ loaderData }: Route.ComponentProps) {
  const authClient = useAuthClient();
  const { email } = loaderData;
  const navigate = useNavigate();

  return (
    <OtpVerificationForm
      email={email}
      defaultNext="/account"
      onSubmit={async ({ email: resolvedEmail, otp }) => {
        const result = await authClient.signIn.emailOtp({ email: resolvedEmail, otp });
        if (result.error || !result.data?.user?.id) {
          throw new Error(
            result.error?.message ?? 'Verification failed. Please check your code and try again.',
          );
        }
        navigate('/account');
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
      onChangeEmail={() => navigate('/login')}
    />
  );
}
