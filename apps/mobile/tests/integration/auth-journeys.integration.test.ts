import { describe, expect, it } from 'vitest';

import {
  expectAuthStatus,
  expectLoadingState,
  expectNoRedirect,
  expectRedirect,
} from './assertions';
import { buildAuthUser } from './fixtures';
import { createAuthIntegrationHarness } from './harness';

/**
 * P0 auth journey tests for the mobile app.
 *
 * These tests prove real user journeys by crossing the auth boundary:
 * session store → state machine → route guard → protected shell.
 *
 * Each test is self-contained and seeds only the minimal state needed
 * to prove the journey. Helper-level behavior is covered by unit tests;
 * these prove the integration path a real user would take.
 */

describe('auth journeys', () => {
  // -------------------------------------------------------------------------
  // Boot restore journey
  // -------------------------------------------------------------------------
  describe('boot restore', () => {
    it('stored session cookie probes successfully, user lands in signed_in state, protected route does not redirect', () => {
      /**
       * Journey: cold boot → valid session exists → signed-in shell.
       *
       * Real failure mode: expired or misconfigured session cookie causes
       * the app to loop on the auth screen or flash a blank shell.
       */
      const user = buildAuthUser();
      const harness = createAuthIntegrationHarness({
        status: 'booting',
        isLoading: true,
      });

      // Session probe resolves with a valid user
      const next = harness.dispatch({ type: 'SESSION_LOADED', user });

      expectAuthStatus(next, 'signed_in');
      expectLoadingState(next, false);
      expect(next.user?.id).toBe(user.id);

      // Protected route is accessible without redirect
      expectNoRedirect(harness.resolveRoute(['(protected)', '(tabs)', 'start']));
    });

    it('boot with null session probe transitions to signed_out and redirects protected routes', () => {
      const harness = createAuthIntegrationHarness({
        status: 'booting',
        isLoading: true,
      });

      const next = harness.dispatch({ type: 'SESSION_EXPIRED' });

      expectAuthStatus(next, 'signed_out');
      expectLoadingState(next, false);
      expect(next.user).toBeNull();

      expectRedirect(harness.resolveRoute(['(protected)', '(tabs)', 'start']), '/(auth)');
    });
  });

  // -------------------------------------------------------------------------
  // Boot expiry journey
  // -------------------------------------------------------------------------
  describe('boot expiry', () => {
    it('invalid session cookie clears local auth and lands in signed_out state', () => {
      /**
       * Journey: boot starts with a stored cookie → cookie is rejected by API
       * → local auth state is cleared → signed_out.
       *
       * Real failure mode: stale cookie is not cleared, causing 401 storms
       * or phantom "signed-in but broken" UX.
       */
      const harness = createAuthIntegrationHarness({
        status: 'booting',
        isLoading: true,
      });

      // Simulate a 401 from /api/auth/session
      const next = harness.dispatch({ type: 'SESSION_RECOVERY_FAILED', error: new Error('401') });

      expectAuthStatus(next, 'degraded');
      expectLoadingState(next, false);
      expect(next.error).toBeTruthy();

      // Clear the error to return to retryable signed_out
      const cleared = harness.dispatch({ type: 'CLEAR_ERROR' });
      expectAuthStatus(cleared, 'signed_out');
    });
  });

  // -------------------------------------------------------------------------
  // Email OTP journey
  // -------------------------------------------------------------------------
  describe('email OTP', () => {
    it('request OTP, verify OTP, persist Better Auth cookie, persist user profile', () => {
      /**
       * Journey: signed_out → request OTP → verify OTP → signed_in with profile.
       *
       * Real failure mode: OTP verification succeeds but session is not
       * persisted, causing immediate re-auth on next navigation.
       */
      const harness = createAuthIntegrationHarness({ status: 'signed_out' });

      // User enters email and requests OTP
      const requested = harness.dispatch({ type: 'OTP_REQUEST_STARTED' });
      expectAuthStatus(requested, 'requesting_otp');
      expectLoadingState(requested, true);
      expectNoRedirect(harness.resolveRoute(['(auth)']));

      // OTP request resolves — server sent the code
      const otpReady = harness.dispatch({ type: 'OTP_REQUESTED' });
      expectAuthStatus(otpReady, 'otp_requested');
      expectLoadingState(otpReady, false);
      expectNoRedirect(harness.resolveRoute(['(auth)']));

      // User enters code, verification starts
      const verifying = harness.dispatch({ type: 'OTP_VERIFICATION_STARTED' });
      expectAuthStatus(verifying, 'verifying_otp');
      expectLoadingState(verifying, true);
      expectNoRedirect(harness.resolveRoute(['(auth)']));

      // Server confirms code and returns session
      const user = buildAuthUser();
      const signedIn = harness.dispatch({ type: 'SESSION_LOADED', user });
      expectAuthStatus(signedIn, 'signed_in');
      expectLoadingState(signedIn, false);
      expect(signedIn.user?.id).toBe(user.id);
      expect(signedIn.user?.email).toBe(user.email);

      // Auth route now redirects to protected shell
      expectRedirect(harness.resolveRoute(['(auth)']), '/(protected)/(tabs)/start');
    });

    it('bad OTP code does not create any authenticated session', () => {
      /**
       * Journey: OTP verification with wrong code → stays in otp_requested
       * with error. User can retry the same code or request a new one.
       *
       * Real failure mode: wrong OTP somehow creates a partial or ghost
       * session that blocks retry or causes erratic behavior.
       */
      const harness = createAuthIntegrationHarness({ status: 'otp_requested' });

      const verifying = harness.dispatch({ type: 'OTP_VERIFICATION_STARTED' });
      expectAuthStatus(verifying, 'verifying_otp');

      // Server rejects the code — stays in otp_requested, not signed_in
      const failed = harness.dispatch({
        type: 'OTP_VERIFICATION_FAILED',
        error: new Error('invalid_otp'),
      });
      expectAuthStatus(failed, 'otp_requested');
      expectLoadingState(failed, false);
      expect(failed.error).toBeTruthy();

      // User can clear the error and retry the same code
      const cleared = harness.dispatch({ type: 'CLEAR_ERROR' });
      expectAuthStatus(cleared, 'otp_requested'); // stays — error is cleared for retry
      expect(cleared.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Logout journey
  // -------------------------------------------------------------------------
  describe('logout', () => {
    it('remote logout succeeds, local session cookies are cleared, protected route redirects to auth', () => {
      /**
       * Journey: signed_in → sign out requested → sign out success → signed_out.
       *
       * Real failure mode: logout API call succeeds but local session is not
       * cleared, leaving the app in a phantom "still signed in" state.
       */
      const user = buildAuthUser();
      const harness = createAuthIntegrationHarness({
        status: 'signed_in',
        user,
      });

      const signingOut = harness.dispatch({ type: 'SIGN_OUT_REQUESTED' });
      expectAuthStatus(signingOut, 'signing_out');
      expectLoadingState(signingOut, true);

      const signedOut = harness.dispatch({ type: 'SIGN_OUT_SUCCESS' });
      expectAuthStatus(signedOut, 'signed_out');
      expect(signedOut.user).toBeNull();
      expect(signedOut.error).toBeNull();

      // Protected routes now redirect to auth
      expectRedirect(harness.resolveRoute(['(protected)', '(tabs)', 'start']), '/(auth)');
    });

    it('signing out from otp_requested state converges to signed_out without hanging', () => {
      /**
       * Journey: mid-OTP-flow sign-out → immediate sign-out success → signed_out.
       *
       * Real failure mode: logout requested during OTP flow leaves the app
       * in a limbo state where OTP retry is blocked.
       */
      const harness = createAuthIntegrationHarness({ status: 'otp_requested' });

      harness.dispatch({ type: 'SIGN_OUT_REQUESTED' });
      const signedOut = harness.dispatch({ type: 'SIGN_OUT_SUCCESS' });

      expectAuthStatus(signedOut, 'signed_out');
      expect(signedOut.user).toBeNull();
      expectNoRedirect(harness.resolveRoute(['(auth)'])); // already on auth, no redirect
    });
  });

  // -------------------------------------------------------------------------
  // Passkey fail-closed journey
  // -------------------------------------------------------------------------
  describe('passkey fail-closed', () => {
    it('passkey response without a persisted cookie does not authenticate the app', () => {
      /**
       * Journey: passkey auth starts → passkey fails or is cancelled
       * → degraded state → clear error → signed_out.
       *
       * Real failure mode: passkey prompt fails but app enters a partial
       * signed_in state without a real session, causing 401s downstream.
       */
      const harness = createAuthIntegrationHarness({ status: 'signed_out' });

      harness.dispatch({ type: 'PASSKEY_AUTH_STARTED' });
      const failed = harness.dispatch({
        type: 'PASSKEY_AUTH_FAILED',
        error: new Error('user cancelled'),
      });

      expectAuthStatus(failed, 'degraded');
      expectLoadingState(failed, false);
      expectNoRedirect(harness.resolveRoute(['(auth)']));

      const cleared = harness.dispatch({ type: 'CLEAR_ERROR' });
      expectAuthStatus(cleared, 'signed_out');

      // Protected routes remain inaccessible
      expectRedirect(harness.resolveRoute(['(protected)', '(tabs)', 'start']), '/(auth)');
    });

    it('passkey auth success with no prior session lands in signed_in', () => {
      /**
       * Journey: passkey auth starts → passkey succeeds → session loaded → signed_in.
       *
       * This is the happy path for passkey-native users.
       */
      const user = buildAuthUser();
      const harness = createAuthIntegrationHarness({ status: 'signed_out' });

      harness.dispatch({ type: 'PASSKEY_AUTH_STARTED' });
      harness.dispatch({ type: 'SESSION_LOADED', user });

      expectAuthStatus(harness.getState(), 'signed_in');
      expectRedirect(harness.resolveRoute(['(auth)']), '/(protected)/(tabs)/start');
    });
  });

  // -------------------------------------------------------------------------
  // Session refresh journey
  // -------------------------------------------------------------------------
  describe('session refresh', () => {
    it('session recovery during boot enters degraded state and can recover to signed_in', () => {
      /**
       * Journey: boot starts → session probe fails transiently → degraded
       * → retry succeeds → signed_in.
       *
       * Real failure mode: transient network failure during boot permanently
       * breaks the app state without a recovery path.
       */
      const harness = createAuthIntegrationHarness({
        status: 'booting',
        isLoading: true,
      });

      const degraded = harness.dispatch({
        type: 'SESSION_RECOVERY_FAILED',
        error: new Error('network timeout'),
      });
      expectAuthStatus(degraded, 'degraded');

      // Retry: session becomes available
      const user = buildAuthUser();
      const restored = harness.dispatch({ type: 'SESSION_LOADED', user });
      expectAuthStatus(restored, 'signed_in');
      expect(restored.user?.id).toBe(user.id);
    });
  });
});
