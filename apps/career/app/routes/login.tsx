import { useAuthClient } from '@hominem/auth/client/provider';
import { EmailEntryForm } from '@hominem/ui';
import type { MetaFunction } from 'react-router';
import { redirect, useLocation, useNavigate } from 'react-router';

import { getServerSession } from '~/lib/auth.server';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sign In - Craftd' },
    {
      name: 'description',
      content: 'Sign in to Craftd to create and manage your professional portfolio',
    },
  ];
};

export async function loader({ request }: { request: Request }) {
  const { user } = await getServerSession(request);
  if (user) {
    throw redirect('/account');
  }
  return null;
}

export default function Login() {
  const authClient = useAuthClient();
  const location = useLocation();
  const navigate = useNavigate();
  const next = new URLSearchParams(location.search).get('next') ?? '/account';

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
        navigate(
          `/login/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
        );
      }}
    />
  );
}
