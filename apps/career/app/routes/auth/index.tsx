import { useEmailOtpAuthRoute } from '@hominem/auth/client/email-otp-route';
import { maskEmail } from '@hominem/auth/shared/mask-email';
import { resolveOAuthResumeUrl } from '@hominem/auth/shared/redirect-policy';
import { EmailOtpAuthFlow, translateUi } from '@hominem/ui';
import { redirect, useLocation, useNavigate } from 'react-router';

import { serverEnv } from '~/lib/env';
import { userContext } from '~/lib/middleware';

import { Route } from './+types/index';
import { AUTH_CONFIG } from './config';

export const meta: Route.MetaFunction = () => [
  { title: translateUi('auth.emailEntry.title') },
  {
    name: 'description',
    content: translateUi('auth.emailEntry.helper'),
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const apiBaseUrl = serverEnv().VITE_PUBLIC_API_URL;
  const oauthResumeUrl = resolveOAuthResumeUrl(new URL(request.url).search, apiBaseUrl);

  if (user) {
    throw redirect(oauthResumeUrl ?? AUTH_CONFIG.defaultRedirect);
  }

  return { apiBaseUrl };
}

export default function AuthEntryPage({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useEmailOtpAuthRoute({
    allowedRedirectPrefixes: AUTH_CONFIG.allowedRedirectPrefixes,
    apiBaseUrl: loaderData.apiBaseUrl,
    defaultRedirect: AUTH_CONFIG.defaultRedirect,
    enableOAuthResume: true,
    search: location.search,
    onNavigate: (to) => navigate(to),
  });

  return (
    <EmailOtpAuthFlow
      email={auth.email}
      error={auth.error ?? undefined}
      isResending={auth.isResending}
      isSubmitting={auth.isSubmitting}
      otp={auth.otp}
      otpHelperText={translateUi('auth.otpVerification.helper', { email: maskEmail(auth.email) })}
      step={auth.step}
      onChangeEmail={auth.changeEmail}
      onEmailChange={auth.handleEmailChange}
      onEmailSubmit={() => auth.handleSendOtp(auth.email)}
      onOtpChange={auth.handleOtpChange}
      onOtpSubmit={() => auth.handleVerifyOtp(auth.email, auth.otp)}
      onResendOtp={() => auth.handleResendOtp(auth.email)}
    />
  );
}
