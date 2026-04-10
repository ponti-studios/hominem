import { describe, expect, it } from 'vitest';

import { resolveAuthRedirect } from '~/navigation/auth-route-guard';

describe('resolveAuthRedirect', () => {
  it('redirects signed-out users away from protected routes', () => {
    expect(
      resolveAuthRedirect({
        authStatus: 'signed_out',
        isSignedIn: false,
        segments: ['(protected)', '(tabs)'],
      }),
    ).toBe('/(auth)');
  });

  it('redirects signed-in users away from auth routes', () => {
    expect(
      resolveAuthRedirect({
        authStatus: 'signed_in',
        isSignedIn: true,
        segments: ['(auth)'],
      }),
    ).toBe('/(protected)/(tabs)/');
  });

  it('does not redirect while booting or signing out', () => {
    expect(
      resolveAuthRedirect({
        authStatus: 'booting',
        isSignedIn: false,
        segments: ['(auth)'],
      }),
    ).toBeNull();

    expect(
      resolveAuthRedirect({
        authStatus: 'signing_out',
        isSignedIn: false,
        segments: ['(protected)'],
      }),
    ).toBeNull();
  });
});
