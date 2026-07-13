import { useEffect, useMemo, useState } from 'react';

import { resolveAuthRedirect, resolveOAuthResumeUrl } from '../shared/redirect-policy';
import { useEmailAuth, type EmailAuthOperations } from './email-auth';
import { useAuthClient } from './provider';

type EmailOtpStep = 'email' | 'otp';

interface UseEmailOtpAuthRouteOptions {
  allowedRedirectPrefixes: readonly string[];
  defaultRedirect: string;
  onNavigate: (to: string) => void;
  search: string;
  apiBaseUrl?: string;
  enableOAuthResume?: boolean;
  prefillEmailFromQuery?: boolean;
}

export function useEmailOtpAuthRoute({
  allowedRedirectPrefixes,
  apiBaseUrl,
  defaultRedirect,
  enableOAuthResume = false,
  onNavigate,
  prefillEmailFromQuery = true,
  search,
}: UseEmailOtpAuthRouteOptions) {
  const authClient = useAuthClient();
  const [step, setStep] = useState<EmailOtpStep>('email');
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const emailFromQuery = searchParams.get('email') ?? '';
  const next = searchParams.get('next');
  const postAuthRedirect = resolveAuthRedirect(
    next,
    defaultRedirect,
    allowedRedirectPrefixes,
  ).safeRedirect;
  const oauthResumeUrl =
    enableOAuthResume && apiBaseUrl ? resolveOAuthResumeUrl(search, apiBaseUrl) : null;

  const operations = useMemo<EmailAuthOperations>(
    () => ({
      sendOtp: async (resolvedEmail) => {
        const result = await authClient.emailOtp.sendVerificationOtp({
          email: resolvedEmail,
          type: 'sign-in',
        });
        if (result.error) {
          throw new Error(result.error.message ?? 'Failed to send verification code');
        }
        setStep('otp');
      },
      verifyOtp: async (resolvedEmail, submittedOtp) => {
        if (oauthResumeUrl && apiBaseUrl) {
          // Stop fetch from following Better Auth's OAuth resume redirect into a third-party callback.
          const response = await fetch(new URL('/api/auth/sign-in/email-otp', apiBaseUrl), {
            method: 'POST',
            credentials: 'include',
            redirect: 'manual',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: resolvedEmail, otp: submittedOtp }),
          });
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
        onNavigate(postAuthRedirect);
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
    }),
    [apiBaseUrl, authClient, oauthResumeUrl, onNavigate, postAuthRedirect],
  );

  const auth = useEmailAuth(operations);
  const { email, setEmail } = auth;

  useEffect(() => {
    if (!prefillEmailFromQuery || !emailFromQuery || email) {
      return;
    }
    setEmail(emailFromQuery);
  }, [email, emailFromQuery, prefillEmailFromQuery, setEmail]);

  return {
    ...auth,
    step,
    changeEmail: () => setStep('email'),
    handleEmailChange: (nextEmail: string) => {
      auth.setEmail(nextEmail);
      auth.setError(null);
    },
    handleOtpChange: (nextOtp: string) => {
      auth.setOtp(nextOtp);
      auth.setError(null);
    },
  };
}
