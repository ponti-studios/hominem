import { describe, expect, it } from 'vitest';

import { resolveAuthScreenState } from '~/services/auth/auth-screen-state';

describe('resolveAuthScreenState', () => {
  it('keeps the session probe silent while booting', () => {
    expect(
      resolveAuthScreenState({
        isPending: true,
        authError: null,
      }),
    ).toEqual({
      isProbing: true,
      displayError: null,
    });
  });

  it('stops probing once the session check resolves', () => {
    expect(
      resolveAuthScreenState({
        isPending: false,
        authError: null,
      }),
    ).toEqual({
      isProbing: false,
      displayError: null,
    });
  });

  it('still surfaces user-initiated auth errors', () => {
    expect(
      resolveAuthScreenState({
        isPending: false,
        authError: 'Unable to send verification code.',
      }),
    ).toEqual({
      isProbing: false,
      displayError: 'Unable to send verification code.',
    });
  });
});
