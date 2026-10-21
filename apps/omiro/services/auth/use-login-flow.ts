import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { setSignInHold } from '~/services/auth/sign-in-hold';
import { useEmailAuth } from '~/services/auth/use-email-auth';
import { isValidEmail, normalizeEmail, normalizeOtp } from '~/services/auth/validation';
import t from '~/translations';

export const RESEND_COOLDOWN_SECONDS = 30;
// How long the success moment (lime pebbles, the mascot's hop) plays before the route guards may move
// on to the inbox.
export const SUCCESS_HOLD_MS = 1200;
const CODE_LENGTH = 6;

type LoginStep = 'email' | 'code';
export type SendCodeResult = 'sent' | 'empty' | 'invalid' | 'failed';

interface LoginFlowOptions {
  requestEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (input: { email: string; otp: string }) => Promise<void>;
  // From an emailed link: open straight on the code step and submit the code it carries.
  linkEmail?: string;
  linkToken?: string;
  onLinkOpened?: () => void;
}

// Email, then code, on one screen. Sending the code moves to the code step; the sixth digit submits
// itself; a successful sign-in holds the route guards for `SUCCESS_HOLD_MS` so the screen can finish
// its success moment.
export function useLoginFlow({
  requestEmailOtp,
  verifyEmailOtp,
  linkEmail,
  linkToken,
  onLinkOpened,
}: LoginFlowOptions) {
  const linkInput = useMemo(() => resolveLinkInput(linkEmail, linkToken), [linkEmail, linkToken]);
  const [step, setStep] = useState<LoginStep>(linkInput ? 'code' : 'email');
  const [email, setEmailState] = useState(linkInput?.email ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  // A wrong code stays on screen until the next digit is typed.
  const [codeErrorVisible, setCodeErrorVisible] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const linkSubmitKeyRef = useRef<string | null>(null);

  const auth = useEmailAuth({
    verifyOtp: async (verifiedEmail, code) => {
      setSignInHold(true);
      try {
        await verifyEmailOtp({ email: verifiedEmail, otp: normalizeOtp(code) });
      } catch (error) {
        setSignInHold(false);
        setCodeErrorVisible(true);
        throw error;
      }
      setSucceeded(true);
    },
    resendOtp: async (resendEmail) => {
      await requestEmailOtp(resendEmail);
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
    },
  });
  const { handleVerifyOtp, setError: setCodeError, setOtp } = auth;
  const normalizedEmail = normalizeEmail(email);

  useEffect(() => {
    if (!linkInput || linkSubmitKeyRef.current === linkInput.key) {
      return;
    }
    linkSubmitKeyRef.current = linkInput.key;
    onLinkOpened?.();
    setOtp(linkInput.token);
    void handleVerifyOtp(linkInput.email, linkInput.token);
  }, [handleVerifyOtp, linkInput, onLinkOpened, setOtp]);

  useEffect(() => {
    if (!succeeded) {
      return;
    }
    const id = setTimeout(() => setSignInHold(false), SUCCESS_HOLD_MS);
    return () => clearTimeout(id);
  }, [succeeded]);

  // A screen that goes away mid-success must not leave the route guards held.
  useEffect(() => () => setSignInHold(false), []);

  useEffect(() => {
    if (resendSecondsLeft <= 0) {
      return;
    }
    const id = setTimeout(() => setResendSecondsLeft((seconds) => seconds - 1), 1000);
    return () => clearTimeout(id);
  }, [resendSecondsLeft]);

  const setEmail = useCallback((value: string) => {
    setEmailState(value);
    setEmailError(null);
  }, []);

  const sendCode = useCallback(async (): Promise<SendCodeResult> => {
    if (!normalizedEmail) {
      setEmailError(t.auth.emailEntry.emailRequiredError);
      return 'empty';
    }
    if (!isValidEmail(normalizedEmail)) {
      setEmailError(t.auth.emailEntry.emailInvalidError);
      return 'invalid';
    }

    try {
      setIsSendingCode(true);
      await requestEmailOtp(normalizedEmail);
      setCodeError(null);
      setOtp('');
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setStep('code');
      return 'sent';
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : t.auth.emailEntry.sendFailedError);
      return 'failed';
    } finally {
      setIsSendingCode(false);
    }
  }, [normalizedEmail, requestEmailOtp, setCodeError, setOtp]);

  // Typing the sixth digit submits it; fewer digits just fill the pebbles.
  const setCode = useCallback(
    (value: string) => {
      const code = normalizeOtp(value).slice(0, CODE_LENGTH);
      setOtp(code);
      setCodeErrorVisible(false);
      if (code.length === CODE_LENGTH) {
        void handleVerifyOtp(normalizedEmail, code);
      }
    },
    [handleVerifyOtp, normalizedEmail, setOtp],
  );

  const changeEmail = useCallback(() => {
    setStep('email');
    setOtp('');
    setCodeError(null);
    setCodeErrorVisible(false);
    setResendSecondsLeft(0);
  }, [setCodeError, setOtp]);

  const resend = useCallback(() => auth.handleResendOtp(normalizedEmail), [auth, normalizedEmail]);

  return {
    step,
    email,
    setEmail,
    normalizedEmail,
    isEmailReady: isValidEmail(normalizedEmail),
    emailError,
    isSendingCode,
    sendCode,
    code: auth.otp,
    setCode,
    codeError: codeErrorVisible ? auth.error : null,
    isVerifying: auth.isSubmitting,
    isResending: auth.isResending,
    succeeded,
    changeEmail,
    resend,
    resendSecondsLeft,
  };
}

function resolveLinkInput(email: string | undefined, token: string | undefined) {
  const linkEmail = normalizeEmail(email ?? '');
  const linkToken = normalizeOtp(token ?? '');
  if (!linkEmail || linkToken.length !== CODE_LENGTH) {
    return null;
  }
  return { email: linkEmail, token: linkToken, key: `${linkEmail}:${linkToken}` };
}
