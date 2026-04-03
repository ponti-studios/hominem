import { AUTH_COPY, maskEmail } from '@hominem/auth';
import { AuthScaffold, OtpVerificationForm } from '@hominem/ui';
import { redirect, useLoaderData, useLocation, useSearchParams } from 'react-router';

import { AUTH_CONFIG, getAuthApiBaseUrl } from './auth-config';

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  if (!email) {
    return redirect('/auth');
  }

  return { email };
}

export async function action({ request }: { request: Request }) {
  const formData = (await request.formData()) as unknown as { get(key: string): string | null };
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const otp = String(formData.get('otp') ?? '').replace(/\D/g, '');
  const next = String(formData.get('next') ?? AUTH_CONFIG.defaultRedirect);

  if (!email || !otp) {
    return { error: 'Email and verification code are required.' };
  }

  const response = await fetch(new URL('/api/auth/email-otp/verify', getAuthApiBaseUrl()), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });

  if (!response.ok) {
    return { error: 'Verification failed. Please check your code and try again.' };
  }

  const result = (await response.json()) as { user?: { id: string } };
  if (!result.user?.id) {
    return { error: 'Verification failed. Missing auth token from server.' };
  }

  return redirect(next);
}

export default function Component() {
  const { email } = useLoaderData<{ email: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') ?? AUTH_CONFIG.defaultRedirect;

  return (
    <AuthScaffold
      title={AUTH_COPY.otpVerification.title}
      helper={AUTH_COPY.otpVerification.helper(maskEmail(email))}
    >
      <OtpVerificationForm
        action={`/auth/verify${location.search}`}
        email={email}
        defaultNext={AUTH_CONFIG.defaultRedirect}
        onChangeEmail={() => {
          const authUrl = new URL('/auth', window.location.origin);
          authUrl.searchParams.set('next', next);
          window.location.assign(`${authUrl.pathname}${authUrl.search}`);
        }}
      />
    </AuthScaffold>
  );
}
