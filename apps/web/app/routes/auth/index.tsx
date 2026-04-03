import { AUTH_COPY, readAuthErrorMessage } from '@hominem/auth';
import { useAuthClient, usePasskeyAuth } from '@hominem/auth/client';
import { resolveSafeAuthRedirect } from '@hominem/auth/server-utils';
import { AuthScaffold, EmailEntryForm } from '@hominem/ui';
import { redirect, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useCallback } from 'react';

import { getServerAuth } from '~/lib/auth.server';

import { AUTH_CONFIG } from './config';

export async function loader({ request }: { request: Request }) {
  const { user, headers } = await getServerAuth(request);
  if (user) {
    const url = new URL(request.url);
    return redirect(
      resolveSafeAuthRedirect(url.searchParams.get('next'), AUTH_CONFIG.defaultRedirect, [
        ...AUTH_CONFIG.allowedRedirectPrefixes,
      ]),
      { headers },
    );
  }
  return null;
}

export default function Component() {
  const authClient = useAuthClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') ?? AUTH_CONFIG.defaultRedirect;

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
      navigate(`/auth/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(redirectTo)}`);
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
