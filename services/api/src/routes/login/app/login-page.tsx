// @jsxImportSource react
import { useMemo, useState } from 'react';

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
};

export function LoginPage({ email: initialEmail, error, resumeQuery, step }: LoginPageProps) {
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState('');

  const isOtpStep = step === 'otp';

  const changeEmailUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('step', 'email');
    return url.toString();
  }, []);

  return (
    <AuthShell>
      <AuthContent>
        <AuthHeading>
          <AuthTitle>{isOtpStep ? 'Check your email' : 'Sign in'}</AuthTitle>
          <AuthCardCopy>
            {isOtpStep ? (
              <>
                We sent a six-digit code to{' '}
                <strong className="font-semibold text-auth-text">{email}</strong>. It's good for a
                few minutes.
              </>
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
