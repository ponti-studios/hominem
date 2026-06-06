'use client';

import { usePasskeys } from '@hominem/auth/client/passkey';
import { useAuthClient } from '@hominem/auth/client/provider';
import { EmailEntryForm } from '@hominem/ui';
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

export default function Component() {
  const authClient = useAuthClient();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    authenticate,
    authError: passkeyError,
    isSupported: isPasskeySupported,
  } = usePasskeys({ enabled: true });

  const { error: sendError, handleSendOtp } = useEmailAuth({
    sendOtp: async (email) => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to send verification code');
      }
      navigate(`/auth/verify?email=${encodeURIComponent(email)}`);
    },
    verifyOtp: async () => {},
    resendOtp: async () => {},
  });

  const callbackError = new URLSearchParams(location.search).get('error');
  const resolvedError = callbackError ?? passkeyError ?? sendError ?? undefined;

  return (
    <EmailEntryForm
      onSubmit={async ({ email }) => {
        await handleSendOtp(email);
      }}
      {...(resolvedError ? { error: resolvedError } : {})}
      {...(isPasskeySupported
        ? {
            onPasskeyClick: async () => {
              try {
                await authenticate();
                navigate('/inbox');
              } catch (error) {
                // Error is already handled by usePasskeys and available via passkeyError
              }
            },
          }
        : {})}
    />
  );
}
