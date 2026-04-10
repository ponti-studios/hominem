import { describe, expect, it } from 'vitest';

import { getErrorMessage, parseAuthError } from './error-types';

describe('parseAuthError', () => {
  it('returns unknown type for undefined message', () => {
    const result = parseAuthError();
    expect(result.type).toBe('unknown');
    expect(result.isCritical).toBe(false);
  });

  it('detects expired codes', () => {
    expect(parseAuthError('Code has expired').type).toBe('expired');
    expect(parseAuthError('Session timeout occurred').type).toBe('expired');
  });

  it('detects rate limiting / lockout', () => {
    const result = parseAuthError('Too many attempts');
    expect(result.type).toBe('too-many');
    expect(result.isCritical).toBe(true);
  });

  it('detects wrong codes', () => {
    expect(parseAuthError('Invalid OTP code').type).toBe('wrong-code');
    expect(parseAuthError('Incorrect password').type).toBe('wrong-code');
    expect(parseAuthError('Code mismatch').type).toBe('wrong-code');
  });

  it('falls through to unknown for unrecognized messages', () => {
    const result = parseAuthError('Something completely new');
    expect(result.type).toBe('unknown');
    expect(result.message).toBe('Something completely new');
  });

  it('respects context for message wording', () => {
    const otp = parseAuthError('Code has expired', 'otp');
    expect(otp.message).toContain('request a new one');

    const password = parseAuthError('Code has expired', 'password');
    expect(password.message).toContain('session has expired');
  });
});

describe('getErrorMessage', () => {
  it('returns context-specific messages for each error type', () => {
    expect(getErrorMessage('wrong-code', 'otp')).toContain('incorrect');
    expect(getErrorMessage('wrong-code', 'passkey')).toContain('Verification failed');
    expect(getErrorMessage('expired', 'password')).toContain('log in again');
    expect(getErrorMessage('too-many', 'otp')).toContain('new code');
    expect(getErrorMessage('locked', 'password')).toContain('Contact support');
    expect(getErrorMessage('unknown', 'otp')).toContain('try again');
  });
});
