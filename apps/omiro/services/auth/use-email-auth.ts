import { useCallback, useRef, useState } from 'react';

import { normalizeEmail, normalizeOtp } from '~/services/auth/validation';
import t from '~/translations';

type EmailAuthOperations = {
  verifyOtp: (email: string, otp: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
};

export function useEmailAuth(ops: EmailAuthOperations) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  // Verifying and resending must not overlap: a code submitted while a new one is on its way is
  // already stale, and the resend would clear whatever was typed meanwhile. State lags a render, so
  // a ref is what makes the second call a no-op even when it fires in the same tick.
  const inFlightRef = useRef(false);
  const run = useCallback(
    async (
      action: () => Promise<void>,
      opts: { resending?: boolean; clearOtpOnError?: boolean; clearOtpOnSuccess?: boolean } = {},
    ) => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      const setBusy = opts.resending ? setIsResending : setIsSubmitting;
      try {
        setBusy(true);
        setError(null);
        await action();
        if (opts.clearOtpOnSuccess) {
          setOtp('');
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t.auth.verify.authFailedError);
        if (opts.clearOtpOnError) {
          setOtp('');
        }
      } finally {
        inFlightRef.current = false;
        setBusy(false);
      }
    },
    [],
  );
  return {
    otp,
    setOtp,
    error,
    setError,
    isSubmitting,
    isResending,
    handleVerifyOtp: (email: string, otpOverride?: string) => {
      const resolvedEmail = normalizeEmail(email);
      const resolvedOtp = normalizeOtp(otpOverride ?? otp);
      if (!resolvedEmail || !resolvedOtp) {
        setError(
          !resolvedEmail ? t.auth.verify.emailRequiredError : t.auth.verify.codeRequiredError,
        );
        return Promise.resolve();
      }
      return run(() => ops.verifyOtp(resolvedEmail, resolvedOtp), { clearOtpOnError: true });
    },
    handleResendOtp: (email: string) => {
      const resolved = normalizeEmail(email);
      return resolved
        ? run(() => ops.resendOtp(resolved), { clearOtpOnSuccess: true, resending: true })
        : (setError(t.auth.verify.emailRequiredError), Promise.resolve());
    },
  };
}
