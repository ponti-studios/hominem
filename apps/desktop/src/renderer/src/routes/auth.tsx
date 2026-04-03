import { AUTH_COPY, readAuthErrorMessage } from '@hominem/auth';
import { usePasskeyAuth } from '@hominem/auth/client';
import { AuthScaffold, EmailEntryForm } from '@hominem/ui';
import { redirect, useSearchParams } from 'react-router';

import { AUTH_CONFIG, getAuthApiBaseUrl } from './auth-config';

export async function action({ request }: { request: Request }) {
  const formData = (await request.formData()) as unknown as { get(key: string): string | null };
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const next = String(formData.get('next') ?? AUTH_CONFIG.defaultRedirect);

  if (!email) {
    return { error: 'Email is required' };
  }

  try {
    const response = await fetch(new URL('/api/auth/email-otp/send', getAuthApiBaseUrl()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, type: 'sign-in' }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      return { error: error.message || 'Failed to send verification code' };
    }

    return redirect(
      `/auth/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
    );
  } catch {
    return { error: 'Failed to send verification code' };
  }
}

export default function Component() {
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') ?? AUTH_CONFIG.defaultRedirect;

  const {
    authenticate,
    error: passkeyError,
    isSupported: isPasskeySupported,
  } = usePasskeyAuth({ redirectTo: next });

  const callbackError = readAuthErrorMessage(searchParams);
  const resolvedError = callbackError ?? passkeyError ?? undefined;

  return (
    <AuthScaffold title={AUTH_CONFIG.title} helper={AUTH_COPY.emailEntry.helper}>
      <EmailEntryForm
        action="/auth"
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
