import { TextField } from '@ponti-studios/ui/forms';
import { Button } from '@ponti-studios/ui/primitives';
import { cn } from '@ponti-studios/ui/utilities';
import { useEffect, useRef, type ChangeEvent, type ClipboardEvent } from 'react';

const OTP_LENGTH = 6;

export interface EmailOtpAuthCopy {
  changeEmail: string;
  codeLabel: string;
  emailHelper: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailTitle: string;
  resend: string;
  resendLoading: string;
  submitEmail: string;
  submitEmailLoading: string;
  verify: string;
  verifyLoading: string;
  otpTitle: string;
}

export interface EmailOtpAuthFlowProps {
  copy: EmailOtpAuthCopy;
  email: string;
  onChangeEmail: () => void;
  onEmailChange: (email: string) => void;
  onEmailSubmit: () => void | Promise<void>;
  onOtpChange: (otp: string) => void;
  onOtpSubmit: () => void | Promise<void>;
  onResendOtp: () => void | Promise<void>;
  otp: string;
  otpHelperText: string;
  step: 'email' | 'otp';
  error?: string;
  isResending?: boolean;
  isSubmitting?: boolean;
}

function normalizeOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

function AuthScaffold({
  children,
  helperText,
  title,
}: {
  children: React.ReactNode;
  helperText: string;
  title: string;
}) {
  return (
    <div className="bg-base flex items-center justify-center px-4 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
        <div className="space-y-2">
          <h1 className="heading-2 text-primary">{title}</h1>
          <p className="callout text-secondary">{helperText}</p>
        </div>
        <div className="mt-6 w-full text-left">{children}</div>
      </div>
    </div>
  );
}

function OtpInput({
  disabled,
  error,
  onChange,
  value,
}: {
  disabled: boolean;
  error?: string;
  onChange: (otp: string) => void;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    onChange(normalizeOtp(event.target.value));
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    onChange(normalizeOtp(event.clipboardData.getData('text')));
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={OTP_LENGTH}
      value={normalizeOtp(value)}
      disabled={disabled}
      onChange={handleChange}
      onPaste={handlePaste}
      placeholder="------"
      aria-label="One-time verification code"
      aria-invalid={Boolean(error)}
      className={cn(
        'border-subtle bg-panel text-primary h-12 w-full rounded-md border px-3 text-base font-semibold tracking-[0.5em]',
        error && 'border-destructive',
      )}
    />
  );
}

export function EmailOtpAuthFlow({
  copy,
  email,
  error,
  isResending = false,
  isSubmitting = false,
  onChangeEmail,
  onEmailChange,
  onEmailSubmit,
  onOtpChange,
  onOtpSubmit,
  onResendOtp,
  otp,
  otpHelperText,
  step,
}: EmailOtpAuthFlowProps) {
  if (step === 'email') {
    return (
      <AuthScaffold title={copy.emailTitle} helperText={copy.emailHelper}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onEmailSubmit();
          }}
          className="space-y-3"
        >
          <TextField
            label={copy.emailLabel}
            name="email"
            type="email"
            value={email}
            autoComplete="email"
            required
            placeholder={copy.emailPlaceholder}
            disabled={isSubmitting}
            error={error}
            onChange={(event) => onEmailChange(event.target.value)}
          />
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
            isLoading={isSubmitting}
            loadingLabel={copy.submitEmailLoading}
          >
            {copy.submitEmail}
          </Button>
        </form>
      </AuthScaffold>
    );
  }

  const normalizedOtp = normalizeOtp(otp);
  const canSubmit = normalizedOtp.length === OTP_LENGTH && !isSubmitting && !isResending;

  return (
    <AuthScaffold title={copy.otpTitle} helperText={otpHelperText}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onOtpSubmit();
        }}
        className="space-y-3"
      >
        <input type="hidden" name="email" value={email} />
        <div className="flex flex-col gap-1.5">
          <label className="body-3 text-primary font-medium" htmlFor="otp-verification-code">
            {copy.codeLabel}
          </label>
          <OtpInput
            disabled={isSubmitting || isResending}
            error={error}
            onChange={onOtpChange}
            value={otp}
          />
          {error ? (
            <p className="body-4 text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full"
          isLoading={isSubmitting}
          loadingLabel={copy.verifyLoading}
        >
          {copy.verify}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          <Button
            type="button"
            variant="link"
            className="px-0"
            onClick={() => void onResendOtp()}
            disabled={isResending || isSubmitting}
            isLoading={isResending}
            loadingLabel={copy.resendLoading}
          >
            {copy.resend}
          </Button>
          <Button
            type="button"
            variant="link"
            className="px-0"
            onClick={onChangeEmail}
            disabled={isSubmitting}
          >
            {copy.changeEmail}
          </Button>
        </div>
      </form>
    </AuthScaffold>
  );
}
