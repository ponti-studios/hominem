import { AUTH_COPY, readAuthErrorMessage } from '@hominem/auth';
import { useAuthClient, usePasskeyAuth } from '@hominem/auth/client';
import { AuthScaffold, EmailEntryForm } from '@hominem/ui';
import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { AUTH_CONFIG } from './config';
import { getNextRedirect } from './shared';
import { redirectAuthenticatedUser } from './shared.server';

export async function loader({ request }: { request: Request }) {
  return redirectAuthenticatedUser(request);
}

export default function Component() {
  const authClient = useAuthClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = getNextRedirect(location.search);

  const {
    authenticate,
    error: passkeyError,
    isSupported: isPasskeySupported,
  } = usePasskeyAuth({ redirectTo: next });
  const submitEmail = useCallback(
    async ({ email, next: nextPath }: { email: string; next: string | null }) => {
      if (!email) {
        throw new Error('Email is required');
      }

      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });

      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to send verification code');
      }

      const redirectTo = nextPath ?? AUTH_CONFIG.defaultRedirect;
      navigate(
        `/auth/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(redirectTo)}`,
      );
    },
    [authClient, navigate],
  );
  const callbackError = readAuthErrorMessage(new URLSearchParams(location.search));
  const resolvedError = callbackError ?? passkeyError ?? undefined;

  return (
    <AuthScaffold title={AUTH_CONFIG.title} helper={AUTH_COPY.emailEntry.helper}>
      <EmailEntryForm
        action="/auth"
        onSubmit={submitEmail}
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
