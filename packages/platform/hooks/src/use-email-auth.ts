import { useCallback, useState } from 'react';

export interface EmailAuthOperations {
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
}

export interface UseEmailAuthOptions {
  onOtpSent?: (email: string) => void;
  onVerified?: () => void;
}

export interface UseEmailAuthOutput {
  email: string;
  setEmail: (email: string) => void;
  otp: string;
  setOtp: (otp: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
  isSubmitting: boolean;
  isResending: boolean;
  handleSendOtp: (emailOverride?: string) => Promise<void>;
  handleVerifyOtp: (emailOverride?: string, otpOverride?: string) => Promise<void>;
  handleResendOtp: (emailOverride?: string) => Promise<void>;
}

export function useEmailAuth(
  ops: EmailAuthOperations,
  options: UseEmailAuthOptions = {},
): UseEmailAuthOutput {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSendOtp = useCallback(
    async (emailOverride?: string) => {
      const resolved = (emailOverride ?? email).trim();
      if (!resolved) {
        setError('Email is required');
        return;
      }
      if (emailOverride) setEmail(emailOverride);
      try {
        setIsSubmitting(true);
        setError(null);
        await ops.sendOtp(resolved);
        options.onOtpSent?.(resolved);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to send verification code');
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, ops, options],
  );

  const handleVerifyOtp = useCallback(
    async (emailOverride?: string, otpOverride?: string) => {
      const resolvedEmail = (emailOverride ?? email).trim();
      const resolvedOtp = (otpOverride ?? otp).trim();
      if (!resolvedEmail) {
        setError('Email is required');
        return;
      }
      if (!resolvedOtp) {
        setError('Verification code is required');
        return;
      }
      try {
        setIsSubmitting(true);
        setError(null);
        await ops.verifyOtp(resolvedEmail, resolvedOtp);
        options.onVerified?.();
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'Verification failed. Please check your code and try again.',
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, otp, ops, options],
  );

  const handleResendOtp = useCallback(
    async (emailOverride?: string) => {
      const resolved = (emailOverride ?? email).trim();
      if (!resolved) {
        setError('Email is required');
        return;
      }
      try {
        setIsResending(true);
        setError(null);
        await ops.resendOtp(resolved);
        setOtp('');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to resend verification code');
      } finally {
        setIsResending(false);
      }
    },
    [email, ops],
  );

  return {
    email,
    setEmail,
    otp,
    setOtp,
    error,
    setError,
    isSubmitting,
    isResending,
    handleSendOtp,
    handleVerifyOtp,
    handleResendOtp,
  };
}
