import { describe, expect, it } from 'vitest';

import { resolveProtectedRouteState } from '~/services/auth/protected-route-state';

describe('resolveProtectedRouteState', () => {
  it('keeps protected screens on a stable fallback while auth is still booting', () => {
    expect(
      resolveProtectedRouteState({
        isPending: true,
        isSignedIn: false,
      }),
    ).toEqual({ showFallback: true });
  });

  it('keeps protected screens on a stable fallback when signed out', () => {
    expect(
      resolveProtectedRouteState({
        isPending: false,
        isSignedIn: false,
      }),
    ).toEqual({ showFallback: true });
  });

  it('renders protected content once the session is restored', () => {
    expect(
      resolveProtectedRouteState({
        isPending: false,
        isSignedIn: true,
      }),
    ).toEqual({ showFallback: false });
  });
});
