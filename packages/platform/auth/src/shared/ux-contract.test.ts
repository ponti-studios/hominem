import { describe, expect, it } from 'vitest';

import { maskEmail } from './mask-email';
import { AUTH_COPY } from './ux-contract';

describe('AUTH_COPY', () => {
  it('keeps the auth copy minimal and shared', () => {
    expect(AUTH_COPY.emailEntry.title).toBe('Sign in');
    expect(AUTH_COPY.emailEntry.helper).toBe('We’ll send a code to your email.');
    expect(AUTH_COPY.emailEntry.emailLabel).toBe('Email address');
    expect(AUTH_COPY.otpVerification.title).toBe('Verify');
    expect(AUTH_COPY.otpVerification.codeLabel).toBe('Verification code');
    expect(AUTH_COPY.otpVerification.helper('mo***@example.com')).toBe(
      'Code sent to mo***@example.com.',
    );
    expect(maskEmail('monday@example.com')).toBe('mo***@example.com');
  });
});
