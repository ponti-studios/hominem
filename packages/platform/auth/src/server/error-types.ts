export type ErrorType = 'wrong-code' | 'expired' | 'too-many' | 'locked' | 'unknown';

export interface ParsedError {
  type: ErrorType;
  message: string;
  isCritical: boolean;
  icon?: 'error' | 'alert' | 'lock';
}

export function parseAuthError(
  errorMessage?: string,
  context: 'otp' | 'password' | 'passkey' = 'otp',
): ParsedError {
  if (!errorMessage) {
    return {
      type: 'unknown',
      message: 'An error occurred. Please try again.',
      isCritical: false,
      icon: 'error',
    };
  }

  const lower = errorMessage.toLowerCase();

  if (lower.includes('expired') || lower.includes('timeout')) {
    return {
      type: 'expired',
      message:
        context === 'otp'
          ? 'Your code has expired. Please request a new one.'
          : 'Your session has expired. Please try again.',
      isCritical: false,
      icon: 'alert',
    };
  }

  if (lower.includes('locked') || lower.includes('too many') || lower.includes('attempt limit')) {
    return {
      type: 'too-many',
      message:
        context === 'otp'
          ? 'Too many failed attempts. Please request a new code.'
          : 'Too many failed attempts. Please try again later.',
      isCritical: true,
      icon: 'lock',
    };
  }

  if (
    lower.includes('invalid') ||
    lower.includes('incorrect') ||
    lower.includes('wrong') ||
    lower.includes('mismatch')
  ) {
    return {
      type: 'wrong-code',
      message:
        context === 'otp'
          ? 'The code you entered is incorrect.'
          : 'Invalid credentials. Please try again.',
      isCritical: false,
      icon: 'error',
    };
  }

  return {
    type: 'unknown',
    message: errorMessage,
    isCritical: false,
    icon: 'error',
  };
}

export function getErrorMessage(
  type: ErrorType,
  context: 'otp' | 'password' | 'passkey' = 'otp',
): string {
  const messages: Record<ErrorType, Record<'otp' | 'password' | 'passkey', string>> = {
    'wrong-code': {
      otp: 'The code you entered is incorrect.',
      password: 'Invalid credentials. Please try again.',
      passkey: 'Verification failed. Please try again.',
    },
    expired: {
      otp: 'Your code has expired. Please request a new one.',
      password: 'Your session has expired. Please log in again.',
      passkey: 'Your session has expired. Please try again.',
    },
    'too-many': {
      otp: 'Too many failed attempts. Please request a new code.',
      password: 'Too many failed attempts. Please try again later.',
      passkey: 'Account temporarily locked. Please try again later.',
    },
    locked: {
      otp: 'Account temporarily locked. Please request a new code.',
      password: 'Account temporarily locked. Contact support if this persists.',
      passkey: 'Account temporarily locked. Contact support if this persists.',
    },
    unknown: {
      otp: 'An error occurred. Please try again.',
      password: 'An error occurred. Please try again.',
      passkey: 'An error occurred. Please try again.',
    },
  };

  return messages[type][context];
}
