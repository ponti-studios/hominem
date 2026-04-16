import { describe, expect, it } from 'vitest';

import { buildAuthCallbackErrorRedirect, readAuthErrorMessage } from './error-contract';

describe('buildAuthCallbackErrorRedirect', () => {
  it('appends error params to an allowed redirect', () => {
    expect(
      buildAuthCallbackErrorRedirect({
        next: '/notes?tab=today',
        fallback: '/auth',
        allowedPrefixes: ['/notes'],
        code: 'access_denied',
        description: 'Passkey sign-in failed.',
      }),
    ).toBe('/notes?tab=today&error=access_denied&description=Passkey+sign-in+failed.');
  });

  it('falls back when the redirect is disallowed', () => {
    expect(
      buildAuthCallbackErrorRedirect({
        next: '/admin',
        fallback: '/auth',
        allowedPrefixes: ['/notes'],
        code: 'server_error',
      }),
    ).toBe('/auth?error=server_error');
  });
});

describe('readAuthErrorMessage', () => {
  it('prefers a description over a code', () => {
    const params = new URLSearchParams({
      error: 'access_denied',
      description: 'Custom message',
    });

    expect(readAuthErrorMessage(params)).toBe('Custom message');
  });

  it('reads oauth style error descriptions', () => {
    const params = new URLSearchParams({
      error: 'access_denied',
      error_description: 'OAuth message',
    });

    expect(readAuthErrorMessage(params)).toBe('OAuth message');
  });

  it('maps known error codes to friendly messages', () => {
    expect(readAuthErrorMessage(new URLSearchParams({ error: 'server_error' }))).toBe(
      'A server error occurred. Please try again.',
    );
  });

  it('returns unknown error codes verbatim', () => {
    expect(readAuthErrorMessage(new URLSearchParams({ error: 'mystery_error' }))).toBe(
      'mystery_error',
    );
  });

  it('returns null when no error is present', () => {
    expect(readAuthErrorMessage(new URLSearchParams())).toBeNull();
  });
});
