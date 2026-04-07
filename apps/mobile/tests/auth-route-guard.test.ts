
import type { AuthStatusCompat } from '../utils/auth/provider-utils'

import { resolveAuthRedirect } from '../utils/navigation/auth-route-guard'

describe('resolveAuthRedirect', () => {
  it('should not redirect while booting', () => {
    expect(
      resolveAuthRedirect({
        authStatus: 'booting',
        isSignedIn: false,
        segments: ['(protected)'],
      }),
    ).toBeNull()
  })

  it('should redirect signed-out users away from protected group', () => {
    expect(
      resolveAuthRedirect({
        authStatus: 'signed_out',
        isSignedIn: false,
        segments: ['(protected)', '(tabs)', 'start'],
      }),
    ).toBe('/(auth)')
  })

  it('should redirect signed-in users away from auth group', () => {
    expect(
      resolveAuthRedirect({
        authStatus: 'signed_in',
        isSignedIn: true,
        segments: ['(auth)'],
      }),
    ).toBe('/(protected)/(tabs)/')
  })

  it('should not redirect signed-out users already in auth group', () => {
    expect(
      resolveAuthRedirect({
        authStatus: 'signed_out',
        isSignedIn: false,
        segments: ['(auth)'],
      }),
    ).toBeNull()
  })

  it('should not redirect signed-in users already in protected group', () => {
    expect(
      resolveAuthRedirect({
        authStatus: 'signed_in',
        isSignedIn: true,
        segments: ['(protected)', '(tabs)', 'start'],
      }),
    ).toBeNull()
  })

  it('should not redirect while signing out — user stays in place until complete', () => {
    expect(
      resolveAuthRedirect({
        authStatus: 'signing_out',
        isSignedIn: false,
        segments: ['(protected)', '(tabs)', 'start'],
      }),
    ).toBeNull()
  })

  it.each([
    'verifying_otp',
    'minting_api_token',
    'syncing_profile',
    'requesting_otp',
  ] as const)(
    'should redirect %s status from protected group to auth',
    (authStatus: AuthStatusCompat) => {
      expect(
        resolveAuthRedirect({ authStatus, isSignedIn: false, segments: ['(protected)'] }),
      ).toBe('/(auth)')
    },
  )

  it.each(['degraded', 'terminal_error'] as const)(
    'should redirect %s status from protected group to auth',
    (authStatus) => {
      expect(
        resolveAuthRedirect({ authStatus, isSignedIn: false, segments: ['(protected)'] }),
      ).toBe('/(auth)')
    },
  )

  it('should not redirect degraded status on auth group', () => {
    expect(
      resolveAuthRedirect({
        authStatus: 'degraded',
        isSignedIn: false,
        segments: ['(auth)'],
      }),
    ).toBeNull()
  })

  it('should not redirect terminal_error status on auth group', () => {
    expect(
      resolveAuthRedirect({
        authStatus: 'terminal_error',
        isSignedIn: false,
        segments: ['(auth)'],
      }),
    ).toBeNull()
  })
})
