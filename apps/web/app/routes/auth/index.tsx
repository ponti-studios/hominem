'use client';

import { AUTH_COPY, readAuthErrorMessage } from '@hominem/auth';
import { useAuthClient, usePasskeyAuth } from '@hominem/auth/client';
import { AuthScaffold, EmailEntryForm } from '@hominem/ui';
import { useLocation, useNavigate } from 'react-router';

import { AUTH_CONFIG } from './config';
import { useEmailAuth } from './use-email-auth';
import { getNextRedirect } from './shared';
import { redirectAuthenticatedUser } from './shared.server';

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

  const {
    authenticate,
    error: passkeyError,
    isSupported: isPasskeySupported,
  } = usePasskeyAuth({ redirectTo: next });

  const { error: sendError, handleSendOtp } = useEmailAuth({
    sendOtp: async (email) => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to send verification code');
      }
      const redirectTo = next ?? AUTH_CONFIG.defaultRedirect;
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
    <AuthScaffold title={AUTH_CONFIG.title} helper={AUTH_COPY.emailEntry.helper}>
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
              },
            }
          : {})}
      />
    </AuthScaffold>
  );
}
