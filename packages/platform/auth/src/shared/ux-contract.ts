/**
 * Canonical cross-platform auth UX contract.
 *
 * Both web and mobile MUST source their auth copy and per-app destination
 * policy from here. Platform adapters may apply native styling but the
 * underlying string values must be identical.
 */

import { BRAND } from '@hominem/env/brand';

/** Single source of truth for the app brand name used across auth surfaces. */
export const AUTH_APP_NAME = BRAND.appName;

// ─── UX State ─────────────────────────────────────────────────────────────────

export type AuthUxState =
  | 'email-entry'
  | 'otp-verification'
  | 'passkey'
  | 'loading'
  | 'error'
  | 'signed-in';

// ─── Copy Interfaces ──────────────────────────────────────────────────────────

export interface AuthEntryCopy {
  title: string;
  helper: string;
  emailPlaceholder: string;
  emailLabel: string;
  submitButton: string;
  passkeyButton: string;
  passkeyLoadingButton: string;
  emailRequiredError: string;
  emailInvalidError: string;
  sendFailedError: string;
}

export interface AuthVerifyCopy {
  title: string;
  helper: (email: string) => string;
  codeLabel: string;
  codePlaceholder: string;
  verifyButton: string;
  resendButton: string;
  changeEmailLink: string;
  codeRequiredError: string;
  codeLengthError: string;
  verifyFailedError: string;
  resendFailedError: string;
}

export interface AuthPasskeyCopy {
  genericError: string;
}

export interface AuthCopy {
  emailEntry: AuthEntryCopy;
  otpVerification: AuthVerifyCopy;
  passkey: AuthPasskeyCopy;
}

// ─── Canonical Copy ───────────────────────────────────────────────────────────

export const AUTH_COPY: AuthCopy = {
  emailEntry: {
    title: 'Sign in',
    helper: 'We’ll send a code to your email.',
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

// ─── Per-App Auth Config ──────────────────────────────────────────────────────

export interface AppAuthConfig {
  /** Human-readable product name shown in auth UI. */
  appName: string;
  /** Platform-specific canonical post-auth destination path. */
  defaultPostAuthDestination: string;
  /** Allowed redirect prefixes for safe redirect validation (web only). */
  allowedDestinations: string[];
  /** Copy to use for this app. Defaults to AUTH_COPY. */
  copy: AuthCopy;
}

/** Web app auth config. */
export const NOTES_AUTH_CONFIG: AppAuthConfig = {
  appName: AUTH_APP_NAME,
  defaultPostAuthDestination: '/home',
  allowedDestinations: ['/', '/home', '/chat', '/notes', '/account', '/settings'],
  copy: AUTH_COPY,
};

/** Mobile app auth config. */
export const CHAT_AUTH_CONFIG: AppAuthConfig = {
  appName: AUTH_APP_NAME,
  defaultPostAuthDestination: '/(protected)/(tabs)/start',
  allowedDestinations: ['/(protected)/(tabs)/start'],
  copy: AUTH_COPY,
};
