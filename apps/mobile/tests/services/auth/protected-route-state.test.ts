import { describe, expect, it } from 'vitest';

import { resolveProtectedRouteState } from '~/services/auth/protected-route-state';

describe('resolveProtectedRouteState', () => {
  it('keeps protected screens on a stable fallback while auth is still booting', () => {
    expect(
      resolveProtectedRouteState({
        authStatus: 'booting',
        isSignedIn: false,
      }),
    ).toEqual({ showFallback: true });
  });

  it('keeps protected screens on a stable fallback during a signed-out transition', () => {
    expect(
      resolveProtectedRouteState({
        authStatus: 'signed_out',
        isSignedIn: false,
      }),
    ).toEqual({ showFallback: true });
  });

  it('renders protected content once the session is restored', () => {
    expect(
      resolveProtectedRouteState({
        authStatus: 'signed_in',
        isSignedIn: true,
      }),
    ).toEqual({ showFallback: false });
  });
});
