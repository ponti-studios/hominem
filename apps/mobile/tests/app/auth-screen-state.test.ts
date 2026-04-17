import { describe, expect, it } from 'vitest';

import { resolveAuthScreenState } from '~/services/auth/auth-screen-state';

describe('resolveAuthScreenState', () => {
  it('keeps the session probe silent while booting', () => {
    expect(
      resolveAuthScreenState({
        authStatus: 'booting',
        authError: null,
        passkeyError: null,
      }),
    ).toEqual({
      isProbing: true,
      displayError: null,
    });
  });

  it('keeps the session probe silent after a restore failure', () => {
    expect(
      resolveAuthScreenState({
        authStatus: 'degraded',
        authError: null,
        passkeyError: null,
      }),
    ).toEqual({
      isProbing: false,
      displayError: null,
    });
  });

  it('still surfaces user-initiated auth errors', () => {
    expect(
      resolveAuthScreenState({
        authStatus: 'signed_out',
        authError: 'Unable to send verification code.',
        passkeyError: null,
      }),
    ).toEqual({
      isProbing: false,
      displayError: 'Unable to send verification code.',
    });
  });
});
