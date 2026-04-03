import { AUTH_COPY } from '@hominem/auth';
import { useEffect, useState } from 'react';
import { Form, useFetcher, useNavigation, useSearchParams } from 'react-router';

import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';

interface OtpVerificationFormProps {
  action: string;
  sendAction?: string;
  email: string;
  defaultNext?: string;
  error?: string | undefined;
  onChangeEmail?: () => void;
  className?: string;
}

export function OtpVerificationForm({
  action,
  sendAction = '/auth',
  email,
  defaultNext = '/finance',
  error,
  onChangeEmail,
  className,
}: OtpVerificationFormProps) {
  const navigation = useNavigation();
  const resendFetcher = useFetcher<{ error?: string }>();
  const [searchParams] = useSearchParams();
  const [otp, setOtp] = useState('');
  const [resendError, setResendError] = useState<string | null>(null);
  const isSubmitting = navigation.state === 'submitting' && navigation.formAction === action;
  const resolvedEmail = searchParams.get('email') ?? email;
  const next = searchParams.get('next') ?? defaultNext;
  const copy = AUTH_COPY.otpVerification;
  const normalizedOtp = otp.replace(/\D/g, '').slice(0, 6);
  const canSubmit = normalizedOtp.length === 6 && !isSubmitting && resendFetcher.state === 'idle';
  const displayError = error ?? resendError;

  useEffect(() => {
    if (resendFetcher.state !== 'idle' || !resendFetcher.data?.error) {
      return;
    }

    setResendError(resendFetcher.data.error);
  }, [resendFetcher.data, resendFetcher.state]);

  const handleResend = () => {
    if (resendFetcher.state !== 'idle') {
      return;
    }

    setResendError(null);
    const formData = new FormData();
    formData.append('email', resolvedEmail);
    resendFetcher.submit(formData, { method: 'post', action: sendAction });
  };

  return (
    <Form method="post" action={action} className={className}>
      <input type="hidden" name="email" value={resolvedEmail} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="otp" value={normalizedOtp} />

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
          disabled={isSubmitting || resendFetcher.state !== 'idle'}
          error={displayError ?? undefined}
          onChange={(event) => {
            setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
            if (resendError) {
              setResendError(null);
            }
          }}
          className="tracking-[0.35em] text-center font-mono"
        />

        <Button type="submit" disabled={!canSubmit} className="w-full">
          {isSubmitting ? 'Verifying…' : copy.verifyButton}
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={handleResend}
            disabled={resendFetcher.state !== 'idle' || isSubmitting}
            className="px-0"
          >
            {resendFetcher.state === 'submitting' ? 'Resending…' : copy.resendButton}
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
    </Form>
  );
}
