'use client';

import { usePasskeys } from '@hominem/auth/client/passkey';
import { useAuthClient } from '@hominem/auth/client/provider';
import { readAuthErrorMessage } from '@hominem/auth/shared/error-contract';
import { resolveAuthRedirect } from '@hominem/auth/shared/redirect-policy';
import { AUTH_COPY, NOTES_AUTH_CONFIG } from '@hominem/auth/shared/ux-contract';
import { AuthScaffold, EmailEntryForm } from '@hominem/ui';
import { useLocation, useNavigate } from 'react-router';

import { getNextRedirect } from './shared';
import { redirectAuthenticatedUser } from './shared.server';
import { useEmailAuth } from './use-email-auth';

export async function loader({ request }: { request: Request }) {
  return redirectAuthenticatedUser(request);
}

export default function Component() {
  // Skip rendering on server
  if (typeof window === 'undefined') {
    return <div>Loading...</div>;
  }

  const authClient = useAuthClient();
  const location = useLocation();
  const navigate = useNavigate();
  const next = getNextRedirect(location.search);

  const { authenticate, authError: passkeyError, isSupported: isPasskeySupported } = usePasskeys();

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
    <AuthScaffold title={AUTH_COPY.emailEntry.title} helper={AUTH_COPY.emailEntry.helper}>
      <EmailEntryForm
        action="/auth"
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
    </AuthScaffold>
  );
}
