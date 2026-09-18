// @jsxImportSource react
import { useMemo, useRef, useState } from 'react';

import {
  AuthAlert,
  AuthCardCopy,
  AuthContent,
  AuthField,
  AuthHeading,
  AuthSecondaryButton,
  AuthSecondaryLink,
  AuthShell,
  AuthTextInput,
  AuthTitle,
} from './auth-shell';
import { OtpField } from './otp-field';
import { AnimatedProgressButton } from './progress-button';

type LoginPageProps = {
  email: string;
  error?: string;
  resumeQuery: string;
  step: 'email' | 'otp';
};

// Structural checks give a specific, actionable message while the user is
// still typing. The final "looks done" gate defers to the browser's own
// type="email" validator (checkValidity) instead of hand-rolling a regex.
const emailProgress = (email: string, isValid: boolean): [number, string] => {
  if (!email) return [0, 'Enter your email'];
  if (/\s/.test(email)) return [0.2, 'Remove the spaces'];
  if (!email.includes('@')) return [0.2, 'Add the @ symbol'];
  const domain = email.split('@')[1] ?? '';
  if (!domain) return [0.4, 'Almost there! Add the domain'];
  if (!domain.includes('.')) return [0.6, "Don't forget the domain extension"];
  const extension = domain.split('.')[1] ?? '';
  if (extension.length < 2) return [0.8, 'Complete the domain extension'];
  return isValid ? [1, 'Ready to go!'] : [0.8, 'Check the email address'];
};

const otpProgress = (digits: string): [number, string] => {
  const filled = digits.replace(/\D/g, '').length;
  return [filled / 6, filled === 0 ? 'Enter your 6-digit code' : `${6 - filled} more to go`];
};

export function LoginPage({ email: initialEmail, error, resumeQuery, step }: LoginPageProps) {
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState('');
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const isOtpStep = step === 'otp';

  const changeEmailUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('step', 'email');
    return url.toString();
  }, []);

  const emailState = emailProgress(email, emailInputRef.current?.checkValidity() ?? false);
  const otpState = otpProgress(digits);
  const isEmailComplete = emailState[0] === 1;
  const isOtpComplete = otpState[0] === 1;

  return (
    <AuthShell>
      <AuthContent>
        <AuthHeading>
          <AuthTitle>{isOtpStep ? 'Check your email' : 'Sign in to Hominem'}</AuthTitle>
          <AuthCardCopy>
            {isOtpStep
              ? `We sent a verification code to ${email}.`
              : "Enter your email and we'll send you a one-time code — no password to remember."}
          </AuthCardCopy>
        </AuthHeading>
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        <form
          action={isOtpStep ? '/login/verify' : '/login/send'}
          data-error={error ? true : undefined}
          method="post"
        >
          <input name="resume" type="hidden" value={resumeQuery} />
          {isOtpStep ? (
            <>
              <input name="email" type="hidden" value={email} />
              <input name="otp" type="hidden" value={digits} />
              <OtpField onDigitsChange={setDigits} />
            </>
          ) : (
            <AuthField label="Email address">
              <AuthTextInput
                autoComplete="email"
                autoFocus
                id="email"
                name="email"
                onChange={setEmail}
                ref={emailInputRef}
                required
                type="email"
                value={email}
              />
            </AuthField>
          )}
          <AnimatedProgressButton
            complete={isOtpStep ? isOtpComplete : isEmailComplete}
            message={isOtpStep ? otpState[1] : emailState[1]}
            progress={isOtpStep ? otpState[0] : emailState[0]}
          >
            <button
              className="absolute inset-0 m-0 min-h-0 cursor-pointer rounded-md border-0 bg-auth-primary font-semibold text-auth-primary-text"
              type="submit"
            >
              {isOtpStep ? 'Verify' : 'Continue'}
            </button>
          </AnimatedProgressButton>
        </form>
        {isOtpStep ? (
          <div className="flex items-center justify-center gap-4">
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
