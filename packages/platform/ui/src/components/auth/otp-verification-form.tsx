import { AUTH_COPY } from '@hakumi/auth/shared/ux-contract';
import { useEffect, useState } from 'react';
import { Form, useFetcher, useNavigation, useSearchParams } from 'react-router';

import { Button } from '../button';
import { TextField } from '../text-field';

interface OtpVerificationFormProps {
  action: string;
  sendAction?: string;
  email: string;
  defaultNext?: string;
  error?: string | undefined;
  onSubmit?: (input: { email: string; otp: string; next: string }) => Promise<void>;
  onResend?: (email: string) => Promise<void>;
  onChangeEmail?: () => void;
  className?: string;
}

export function OtpVerificationForm({
  action,
  sendAction = '/auth',
  email,
  defaultNext = '/finance',
  error,
  onSubmit,
  onResend,
  onChangeEmail,
  className,
}: OtpVerificationFormProps) {
  const navigation = useNavigation();
  const resendFetcher = useFetcher<{ error?: string }>();
  const [searchParams] = useSearchParams();
  const [otp, setOtp] = useState('');
  const [resendError, setResendError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isClientSubmitting, setIsClientSubmitting] = useState(false);
  const [isClientResending, setIsClientResending] = useState(false);
  const isSubmitting = onSubmit
    ? isClientSubmitting
    : navigation.state === 'submitting' && navigation.formAction === action;
  const resolvedEmail = searchParams.get('email') ?? email;
  const next = searchParams.get('next') ?? defaultNext;
  const copy = AUTH_COPY.otpVerification;
  const normalizedOtp = otp.replace(/\D/g, '').slice(0, 6);
  const isResending = onResend ? isClientResending : resendFetcher.state !== 'idle';
  const canSubmit = normalizedOtp.length === 6 && !isSubmitting && !isResending;
  const displayError = error ?? submitError ?? resendError;

  useEffect(() => {
    if (onResend || resendFetcher.state !== 'idle' || !resendFetcher.data?.error) {
      return;
    }

    setResendError(resendFetcher.data.error);
  }, [onResend, resendFetcher.data, resendFetcher.state]);

  const handleResend = () => {
    if (isResending) {
      return;
    }

    setResendError(null);
    setSubmitError(null);

    if (onResend) {
      setIsClientResending(true);
      void onResend(resolvedEmail)
        .catch((caughtError) => {
          setResendError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Failed to resend verification code.',
          );
        })
        .finally(() => {
          setIsClientResending(false);
        });
      return;
    }

    const formData = new FormData();
    formData.append('email', resolvedEmail);
    resendFetcher.submit(formData, { method: 'post', action: sendAction });
  };

  const fields = (
    <div className="space-y-3">
      <TextField
        label={copy.codeLabel}
        name="otp-display"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder={copy.codePlaceholder}
        value={otp}
        disabled={isSubmitting || isResending}
        error={displayError ?? undefined}
        onChange={(event) => {
          setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
          if (resendError) {
            setResendError(null);
          }
          if (submitError) {
            setSubmitError(null);
          }
        }}
        className="tracking-[0.35em] text-center font-mono"
      />

      <Button type="submit" variant="primary" disabled={!canSubmit} className="w-full">
        {isSubmitting ? 'Verifying…' : copy.verifyButton}
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
          {isResending ? 'Resending…' : copy.resendButton}
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
            {copy.changeEmailLink}
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (onSubmit) {
    return (
      <form
        className={className}
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
                  : 'Verification failed. Please try again.',
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
  }

  return (
    <Form method="post" action={action} className={className}>
      <input type="hidden" name="email" value={resolvedEmail} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="otp" value={normalizedOtp} />
      {fields}
    </Form>
  );
}
