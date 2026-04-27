/**
 * Canonical cross-platform auth UX contract.
 *
 * Both web and mobile MUST source their auth copy and per-app destination
 * policy from here. Platform adapters may apply native styling but the
 * underlying string values must be identical.
 */

export const AUTH_COPY = {
  emailEntry: {
    title: 'Remember everything.',
    helper: 'Capture anything; Retrieve everything.',
    emailPlaceholder: 'you@example.com',
    emailLabel: 'Email address',
    submitButton: 'Continue',
    passkeyButton: 'Use passkey',
    passkeyLoadingButton: 'Connecting…',
    emailRequiredError: 'Email is required.',
    emailInvalidError: 'Enter a valid email address.',
    sendFailedError: 'Unable to send verification code.',
  },
  otpVerification: {
    title: 'Verify',
    helper: (email: string) => `Code sent to ${email}.`,
    codeLabel: 'Verification code',
    codePlaceholder: '123456',
    verifyButton: 'Verify',
    resendButton: 'Resend code',
    changeEmailLink: 'Use a different email',
    codeRequiredError: 'Code is required.',
    codeLengthError: 'Code must be 6 digits.',
    verifyFailedError: 'There was a problem signing in. Our team is working on it.',
    resendFailedError: 'Unable to resend verification code.',
  },
  passkey: {
    genericError: 'Passkey sign-in failed.',
  },
};

type AppAuthConfig = {
  /** Platform-specific canonical post-auth destination path. */
  defaultPostAuthDestination: string;
  /** Allowed redirect prefixes for safe redirect validation (web only). */
  allowedDestinations: string[];
};

/** Web app auth config. */
export const NOTES_AUTH_CONFIG: AppAuthConfig = {
  defaultPostAuthDestination: '/notes',
  allowedDestinations: ['/', '/home', '/chat', '/notes', '/account', '/settings'],
};

/** Mobile app auth config. */
export const CHAT_AUTH_CONFIG: AppAuthConfig = {
  defaultPostAuthDestination: '/(protected)/(tabs)/',
  allowedDestinations: ['/(protected)/(tabs)/'],
};
