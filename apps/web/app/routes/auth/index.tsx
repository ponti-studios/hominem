'use client';

import { usePasskeys } from '@hominem/auth/client/passkey';
import { useAuthClient } from '@hominem/auth/client/provider';
import { readAuthErrorMessage } from '@hominem/auth/shared/error-contract';
import { resolveAuthRedirect } from '@hominem/auth/shared/redirect-policy';
import { EmailEntryForm } from '@hominem/ui';
import { useLocation, useNavigate } from 'react-router';

import { NOTES_AUTH_CONFIG } from '~/config/auth';

import { getNextRedirect } from './shared';
import { redirectAuthenticatedUser } from './shared.server';
import { useEmailAuth } from './use-email-auth';

export async function loader({ request }: { request: Request }) {
  return redirectAuthenticatedUser(request);
}

export default function Component() {
  const authClient = useAuthClient();
  const location = useLocation();
  const navigate = useNavigate();
  const next = getNextRedirect(location.search);

  const {
    authenticate,
    authError: passkeyError,
    isSupported: isPasskeySupported,
  } = usePasskeys({ enabled: false });

  const { error: sendError, handleSendOtp } = useEmailAuth({
    sendOtp: async (email) => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to send verification code');
      }
      const redirectTo = next ?? NOTES_AUTH_CONFIG.defaultPostAuthDestination;
      navigate(
        `/auth/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(redirectTo)}`,
      );
    },
    verifyOtp: async () => {},
    resendOtp: async () => {},
  });

  const callbackError = readAuthErrorMessage(new URLSearchParams(location.search));
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
              await authenticate();
              const { safeRedirect } = resolveAuthRedirect(
                next,
                NOTES_AUTH_CONFIG.defaultPostAuthDestination,
                [...NOTES_AUTH_CONFIG.allowedDestinations],
              );
              navigate(safeRedirect);
            },
          }
        : {})}
    />
  );
}
