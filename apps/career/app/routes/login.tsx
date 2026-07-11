import { useAuthClient, useEmailAuth } from '@hominem/auth/client/provider';
import { maskEmail } from '@hominem/auth/shared/mask-email';
import { resolveAuthRedirect, resolveOAuthResumeUrl } from '@hominem/auth/shared/redirect-policy';
import { AuthScaffold, EmailEntryForm, OtpVerificationForm, translateUi } from '@hominem/ui';
import { useState } from 'react';
import { redirect, useLocation, useNavigate } from 'react-router';

import { serverEnv } from '~/lib/env';
import { userContext } from '~/lib/middleware';

import { Route } from './+types/login';

export const meta: Route.MetaFunction = () => [
  { title: 'Sign In - Craftd' },
  {
    name: 'description',
    content: 'Sign in to Craftd to create and manage your professional portfolio',
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const apiBaseUrl = serverEnv().VITE_PUBLIC_API_URL;
  const oauthResumeUrl = resolveOAuthResumeUrl(new URL(request.url).search, apiBaseUrl);

  if (user) {
    throw redirect(oauthResumeUrl ?? '/work');
  }

  return { apiBaseUrl };
}

type LoginStep = 'email' | 'otp';

export default function Login({ loaderData }: Route.ComponentProps) {
  const authClient = useAuthClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [loginStep, setLoginStep] = useState<LoginStep>('email');
  const next = new URLSearchParams(location.search).get('next');
  const postAuthRedirect = resolveAuthRedirect(next, '/work', [
    '/account',
    '/onboarding',
    '/applications',
    '/resume',
    '/work',
    '/skills',
    '/stats',
    '/projects',
    '/testimonials',
  ]).safeRedirect;
  const oauthResumeUrl = resolveOAuthResumeUrl(location.search, loaderData.apiBaseUrl);
  const {
    error,
    email,
    setEmail,
    otp,
    setOtp,
    setError,
    isSubmitting,
    isResending,
    handleSendOtp,
    handleVerifyOtp,
    handleResendOtp,
  } = useEmailAuth({
    sendOtp: async (resolvedEmail) => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: resolvedEmail,
        type: 'sign-in',
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to send verification code');
      }
      setLoginStep('otp');
    },
    verifyOtp: async (resolvedEmail, submittedOtp) => {
      if (oauthResumeUrl) {
        // Better Auth's own OIDC "after" hook rewrites a successful sign-in
        // response into a redirect that resumes the pending OAuth authorize
        // flow — which ends at the MCP client's local callback URL, a
        // third-party origin with no CORS headers. A normal fetch() (what
        // authClient.signIn.emailOtp uses) auto-follows redirects and blows
        // up on that hop. `redirect: 'manual'` stops the fetch from
        // following it: on success the response comes back as an opaque
        // redirect (the session cookie is still set — the browser applies
        // Set-Cookie from redirect responses regardless of JS visibility),
        // and we resume the flow ourselves via a real top-level navigation.
        const response = await fetch(
          new URL('/api/auth/sign-in/email-otp', loaderData.apiBaseUrl),
          {
            method: 'POST',
            credentials: 'include',
            redirect: 'manual',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: resolvedEmail, otp: submittedOtp }),
          },
        );
        if (response.type === 'opaqueredirect') {
          window.location.assign(oauthResumeUrl);
          return;
        }
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(
          body?.message ?? 'Verification failed. Please check your code and try again.',
        );
      }

      const result = await authClient.signIn.emailOtp({
        email: resolvedEmail,
        otp: submittedOtp,
      });
      if (result.error || !result.data?.user?.id) {
        throw new Error(
          result.error?.message ?? 'Verification failed. Please check your code and try again.',
        );
      }
      navigate(postAuthRedirect);
    },
    resendOtp: async (resolvedEmail) => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: resolvedEmail,
        type: 'sign-in',
      });
      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to resend verification code');
      }
    },
  });

  if (loginStep === 'otp') {
    return (
      <AuthScaffold
        title={translateUi('auth.otpVerification.title')}
        helperText={translateUi('auth.otpVerification.helper', { email: maskEmail(email) })}
      >
        <OtpVerificationForm
          email={email}
          otp={otp}
          error={error ?? undefined}
          isSubmitting={isSubmitting}
          isResending={isResending}
          onOtpChange={(nextOtp) => {
            setOtp(nextOtp);
            setError(null);
          }}
          onSubmit={() => handleVerifyOtp(email, otp)}
          onResend={() => handleResendOtp(email)}
          onChangeEmail={() => setLoginStep('email')}
        />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold title="Sign in">
      <EmailEntryForm
        email={email}
        error={error ?? undefined}
        isSubmitting={isSubmitting}
        onEmailChange={(nextEmail) => {
          setEmail(nextEmail);
          setError(null);
        }}
        onSubmit={() => handleSendOtp(email)}
      />
    </AuthScaffold>
  );
}
