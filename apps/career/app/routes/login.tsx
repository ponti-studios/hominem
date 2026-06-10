import { useAuthClient } from '@hominem/auth/client/provider';
import { EmailEntryForm } from '@hominem/ui';
import { redirect, useNavigate } from 'react-router';

import { userContext } from '~/lib/middleware';

import { Route } from './+types/login';

export const meta: Route.MetaFunction = () => [
  { title: 'Sign In - Craftd' },
  {
    name: 'description',
    content: 'Sign in to Craftd to create and manage your professional portfolio',
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (user) throw redirect('/account');
  return null;
}

export default function Login() {
  const authClient = useAuthClient();
  const navigate = useNavigate();

  return (
    <EmailEntryForm
      title="Sign in to Craftd"
      helperText="Enter your email to create or access your professional portfolio."
      onSubmit={async ({ email }) => {
        const result = await authClient.emailOtp.sendVerificationOtp({
          email,
          type: 'sign-in',
        });
        if (result.error) {
          throw new Error(result.error.message ?? 'Failed to send verification code');
        }
        navigate(`/login/verify?email=${encodeURIComponent(email)}`);
      }}
    />
  );
}
