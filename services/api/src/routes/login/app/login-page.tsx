// @jsxImportSource react
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  AuthAlert,
  AuthCardCopy,
  AuthContent,
  AuthHeading,
  AuthPrimaryButton,
  AuthSecondaryButton,
  AuthSecondaryLink,
  AuthShell,
  AuthTitle,
} from './auth-shell';
import { EmailSendForm } from './email-send-form';
import { OtpField } from './otp-field';

type LoginPageProps = {
  email: string;
  error?: string;
  resumeQuery: string;
  step: 'email' | 'otp';
  app?: string;
  signedOut?: boolean;
};

export function LoginPage({
  email: initialEmail,
  error,
  resumeQuery,
  step,
  app,
  signedOut = false,
}: LoginPageProps) {
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState('');

  const isOtpStep = step === 'otp';
  const otpFormRef = useRef<HTMLFormElement | null>(null);

  // Sixth digit typed or pasted: send it, no Verify click needed.
  useEffect(() => {
    if (isOtpStep && digits.length === 6) otpFormRef.current?.requestSubmit();
  }, [digits, isOtpStep]);

  const changeEmailUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('step', 'email');
    return url.toString();
  }, []);

  return (
    <AuthShell>
      <AuthContent>
        {signedOut && !isOtpStep ? (
          <p
            className="m-0 rounded-[10px] bg-[color-mix(in_srgb,var(--auth-primary)_14%,transparent)] px-4 py-3.5 text-sm leading-normal text-auth-text"
            role="status"
          >
            <strong className="block font-semibold">
              You're signed out{app ? ` of ${app}` : ''}
            </strong>
            Your session on this browser has been cleared.
          </p>
        ) : null}
        {app && !signedOut && !isOtpStep ? (
          <p className="m-0 self-start rounded-full bg-[color-mix(in_srgb,var(--auth-primary)_14%,transparent)] px-3 py-1.5 text-[13px] font-medium text-auth-text">
            Continuing to {app}
          </p>
        ) : null}
        <AuthHeading>
          <AuthTitle>
            {isOtpStep ? 'Check your email' : signedOut ? 'Sign back in' : 'Sign in'}
          </AuthTitle>
          <AuthCardCopy>
            {isOtpStep ? (
              <>
                We sent a six-digit code to{' '}
                <strong className="font-semibold text-auth-text">{email}</strong>. It's good for a
                few minutes.
              </>
            ) : signedOut ? (
              'Switching accounts? Enter the email you want to use.'
            ) : app ? (
              `We'll send a six-digit code, then take you straight back to ${app}.`
            ) : (
              "Enter your email and we'll send you a six-digit code. No password to remember."
            )}
          </AuthCardCopy>
        </AuthHeading>
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        {isOtpStep ? (
          <form
            action="/login/verify"
            className="flex flex-col gap-5"
            data-error={error ? true : undefined}
            method="post"
            ref={otpFormRef}
          >
            <input name="resume" type="hidden" value={resumeQuery} />
            <input name="email" type="hidden" value={email} />
            <input name="otp" type="hidden" value={digits} />
            <OtpField onDigitsChange={setDigits} />
            <AuthPrimaryButton>Verify</AuthPrimaryButton>
          </form>
        ) : (
          <EmailSendForm
            email={email}
            error={error}
            onEmailChange={setEmail}
            resumeQuery={resumeQuery}
          />
        )}
        {isOtpStep ? (
          <div className="flex items-center gap-5">
            <form action="/login/send" method="post">
              <input name="resume" type="hidden" value={resumeQuery} />
              <input name="email" type="hidden" value={email} />
              <AuthSecondaryButton type="submit">Resend code</AuthSecondaryButton>
            </form>
            <AuthSecondaryLink href={changeEmailUrl}>Use a different email</AuthSecondaryLink>
          </div>
        ) : null}
      </AuthContent>
    </AuthShell>
  );
}
