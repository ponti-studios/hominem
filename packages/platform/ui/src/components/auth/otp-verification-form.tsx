import { maskEmail } from '@hominem/auth/shared/mask-email';
import { normalizeOtp } from '@hominem/auth/shared/validation';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { translateUi } from '../../translations';
import { Button } from '../button';
import { OtpCodeInput } from './otp-code-input';
import { AuthScaffold } from './auth-scaffold';

interface OtpVerificationFormProps {
  email: string;
  defaultNext?: string;
  error?: string | undefined;
  onSubmit: (input: { email: string; otp: string; next: string }) => Promise<void>;
  onResend: (email: string) => Promise<void>;
  onChangeEmail?: () => void;
}

export function OtpVerificationForm({
  email,
  defaultNext = '/finance',
  error,
  onSubmit,
  onResend,
  onChangeEmail,
}: OtpVerificationFormProps) {
  const [searchParams] = useSearchParams();
  const [otp, setOtp] = useState('');
  const [resendError, setResendError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isClientSubmitting, setIsClientSubmitting] = useState(false);
  const [isClientResending, setIsClientResending] = useState(false);
  const isSubmitting = isClientSubmitting;
  const resolvedEmail = searchParams.get('email') ?? email;
  const next = searchParams.get('next') ?? defaultNext;
  const normalizedOtp = normalizeOtp(otp);
  const isResending = isClientResending;
  const canSubmit = normalizedOtp.length === 6 && !isSubmitting && !isResending;
  const displayError = error ?? submitError ?? resendError;

  const handleResend = () => {
    if (isResending) {
      return;
    }

    setResendError(null);
    setSubmitError(null);
    setIsClientResending(true);
    void onResend(resolvedEmail)
      .catch((caughtError) => {
        setResendError(
          caughtError instanceof Error
            ? caughtError.message
            : translateUi('auth.otpVerification.resendFailedError'),
        );
      })
      .finally(() => {
        setIsClientResending(false);
      });
  };

  const fields = (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label className="body-3 font-medium text-text-primary" htmlFor="otp-verification-code">
          {translateUi('auth.otpVerification.codeLabel')}
        </label>
        <OtpCodeInput
          id="otp-verification-code"
          value={otp}
          disabled={isSubmitting || isResending}
          error={displayError ?? undefined}
          autoFocus
          onChange={(nextOtp) => {
            setOtp(nextOtp);
            if (resendError) {
              setResendError(null);
            }
            if (submitError) {
              setSubmitError(null);
            }
          }}
        />
        {displayError ? (
          <p className="body-4 text-destructive" role="alert">
            {displayError}
          </p>
        ) : (
          <p className="body-4 text-text-tertiary">
            {translateUi('auth.otpVerification.codePlaceholder')}
          </p>
        )}
      </div>

      <Button type="submit" variant="primary" disabled={!canSubmit} fullWidth>
        {isSubmitting
          ? translateUi('auth.otpVerification.verifyButtonLoading')
          : translateUi('auth.otpVerification.verifyButton')}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <Button
          type="button"
          variant="link"
          size="xs"
          onClick={handleResend}
          disabled={isResending || isSubmitting}
          className="px-0"
        >
          {isResending
            ? translateUi('auth.otpVerification.resendButtonLoading')
            : translateUi('auth.otpVerification.resendButton')}
        </Button>

        {onChangeEmail ? (
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={onChangeEmail}
            disabled={isSubmitting}
            className="px-0"
          >
            {translateUi('auth.otpVerification.changeEmailLink')}
          </Button>
        ) : null}
      </div>
    </div>
  );

  const form = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitError(null);
        setResendError(null);
        setIsClientSubmitting(true);

        void onSubmit({
          email: resolvedEmail,
          otp: normalizedOtp,
          next,
        })
          .catch((caughtError) => {
            setSubmitError(
              caughtError instanceof Error
                ? caughtError.message
                : translateUi('auth.otpVerification.verifyFailedError'),
            );
          })
          .finally(() => {
            setIsClientSubmitting(false);
          });
      }}
    >
      <input type="hidden" name="email" value={resolvedEmail} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="otp" value={normalizedOtp} />
      {fields}
    </form>
  );

  return (
    <AuthScaffold
      title={translateUi('auth.otpVerification.title')}
      helperText={translateUi('auth.otpVerification.helper', { email: maskEmail(resolvedEmail) })}
    >
      {form}
    </AuthScaffold>
  );
}
