import { translateUi } from '../../translations';
import { AuthScaffold } from './auth-scaffold';
import { EmailEntryForm } from './email-entry-form';
import { OtpVerificationForm } from './otp-verification-form';

type EmailOtpAuthStep = 'email' | 'otp';

export interface EmailOtpAuthFlowProps {
  email: string;
  onChangeEmail: () => void;
  onEmailChange: (email: string) => void;
  onEmailSubmit: () => void | Promise<void>;
  onOtpChange: (otp: string) => void;
  onOtpSubmit: () => void | Promise<void>;
  onResendOtp: () => void | Promise<void>;
  otp: string;
  otpHelperText: string;
  step: EmailOtpAuthStep;
  error?: string;
  isResending?: boolean;
  isSubmitting?: boolean;
}

export function EmailOtpAuthFlow({
  email,
  error,
  isResending,
  isSubmitting,
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
  if (step === 'otp') {
    return (
      <AuthScaffold title={translateUi('auth.otpVerification.title')} helperText={otpHelperText}>
        <OtpVerificationForm
          email={email}
          otp={otp}
          error={error}
          isSubmitting={isSubmitting}
          isResending={isResending}
          onOtpChange={onOtpChange}
          onSubmit={onOtpSubmit}
          onResend={onResendOtp}
          onChangeEmail={onChangeEmail}
        />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title={translateUi('auth.emailEntry.title')}
      helperText={translateUi('auth.emailEntry.helper')}
    >
      <EmailEntryForm
        email={email}
        error={error}
        isSubmitting={isSubmitting}
        onEmailChange={onEmailChange}
        onSubmit={onEmailSubmit}
      />
    </AuthScaffold>
  );
}
