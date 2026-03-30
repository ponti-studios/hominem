import { expect, test } from '@playwright/test';

import {
  createAuthTestEmail,
  fetchLatestSignInOtp,
  signInWithEmailOtp,
  startEmailOtpFlow,
  submitOtpCode,
} from './auth.flow-helpers';

/**
 * P0 auth journey tests for the web app.
 *
 * These tests prove real browser cookie, redirect, and auth-gate behavior
 * by exercising complete user-facing flows from unauthenticated entry
 * through to the authenticated shell or back to unauthenticated ground.
 *
 * Each test is self-contained: fresh cookie state, fresh email, clean exit.
 */

test.describe('auth journeys', () => {
  // -------------------------------------------------------------------------
  // Protected-route redirect journey
  // -------------------------------------------------------------------------
  test('signed-out user opens a protected route, lands on /auth, completes OTP, returns to the originally intended destination', async ({
    page,
    context,
  }) => {
    /**
     * Journey: unauthenticated → protected route → redirected to /auth with ?next=
     * → OTP flow → lands on the original protected destination.
     *
     * Real failure modes:
     * - Protected route does not redirect to /auth (auth gate broken)
     * - ?next= param is lost during the OTP flow
     * - Redirect after verify goes to default instead of ?next=
     * - User ends up in a redirect loop
     */
    await context.clearCookies();
    const email = createAuthTestEmail('protected-redirect');
    const targetPath = '/home';

    // Start at a protected route while signed out
    await page.goto(targetPath);

    // Should land on /auth with the original destination preserved in ?next=
    await expect(page).toHaveURL(/\/auth\?next=/, { timeout: 15_000 });

    // Verify the next param points to our protected route
    const url = new URL(page.url());
    expect(url.searchParams.get('next')).toBe(targetPath);

    // Complete OTP flow — should land on the protected destination, not the default
    const otp = await fetchLatestSignInOtp(email);
    await submitOtpCode(page, otp);
    await expect(page).toHaveURL(targetPath, { timeout: 30_000 });
  });

  test('signed-out user directed to /auth?next=/settings completes auth and lands on settings', async ({
    page,
    context,
  }) => {
    /**
     * Journey: unauthenticated → protected route → /auth?next=/settings
     * → OTP → /settings.
     *
     * Proves ?next= works for a non-default allowed destination.
     * /settings is in NOTES_AUTH_CONFIG.allowedDestinations; /settings/security
     * is not (only the prefix /settings is), so we use /settings here.
     */
    await context.clearCookies();
    const email = createAuthTestEmail('settings-redirect');
    const targetPath = '/settings';

    await page.goto(targetPath);
    await expect(page).toHaveURL(/\/auth\?next=/, { timeout: 15_000 });

    const otp = await fetchLatestSignInOtp(email);
    await submitOtpCode(page, otp);
    await expect(page).toHaveURL(targetPath, { timeout: 30_000 });
  });

  // -------------------------------------------------------------------------
  // Existing-session redirect journey
  // -------------------------------------------------------------------------
  test('signed-in user opens /auth and is redirected away to the authenticated shell', async ({
    page,
    context,
  }) => {
    /**
     * Journey: signed-in → navigates to /auth → immediately redirected to /home.
     *
     * Real failure mode: authenticated user gets stuck on /auth, having to
     * manually navigate home or close the tab.
     */
    await context.clearCookies();
    const email = createAuthTestEmail('auth-redirect-away');

    // Establish a session first
    await signInWithEmailOtp(page, email, /\/home$/);
    await expect(page).toHaveURL(/\/home$/, { timeout: 30_000 });

    // Navigate explicitly to /auth while authenticated
    await page.goto('/auth');
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  });

  test('signed-in user at /auth/verify is redirected to home, not back to verify', async ({
    page,
    context,
  }) => {
    /**
     * Journey: signed-in → lands on /auth/verify → redirected to /home.
     * Prevents an authenticated user from accidentally re-entering OTP flow.
     */
    await context.clearCookies();
    const email = createAuthTestEmail('verify-redirect-away');

    await signInWithEmailOtp(page, email, /\/home$/);

    await page.goto(`/auth/verify?email=${encodeURIComponent(email)}`);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  });

  // -------------------------------------------------------------------------
  // Invalid-then-valid OTP recovery journey
  // -------------------------------------------------------------------------
  test('user enters a bad OTP, remains on verify screen, retries with the right OTP, and reaches the product shell', async ({
    page,
    context,
  }) => {
    /**
     * Journey: OTP flow starts → wrong code submitted → error shown, stays on verify
     * → retry with correct code → /home.
     *
     * Real failure modes:
     * - Wrong OTP somehow creates a session (fail-open)
     * - Error state is not clearable and blocks retry
     * - Page redirects to /auth on error (losing email context)
     * - Session cookie from failed OTP attempt pollutes the next attempt
     */
    await context.clearCookies();
    const email = createAuthTestEmail('otp-retry');

    await startEmailOtpFlow(page, email);

    // Submit a wrong code
    await submitOtpCode(page, '111111');

    // Error is shown but user stays on the verify page
    await expect(page).toHaveURL(/\/auth\/verify\?email=/, { timeout: 15_000 });
    await expect(
      page.getByText('Verification failed. Please check your code and try again.'),
    ).toBeVisible({
      timeout: 10_000,
    });

    // The email is still in the URL params so retry works
    const url = new URL(page.url());
    expect(url.searchParams.get('email')).toBe(email);

    // Retry with the correct code
    const correctOtp = await fetchLatestSignInOtp(email);
    await submitOtpCode(page, correctOtp);
    await expect(page).toHaveURL(/\/home$/, { timeout: 30_000 });
  });

  test('failed OTP attempt does not leave a session cookie', async ({ page, context }) => {
    /**
     * Journey: OTP flow → wrong code → check cookies → no auth cookie present.
     *
     * Real failure mode: a failed OTP attempt sets a session cookie that
     * partially authenticates the browser, causing erratic behavior.
     */
    await context.clearCookies();
    const email = createAuthTestEmail('otp-no-leak');

    await startEmailOtpFlow(page, email);
    await submitOtpCode(page, '000000');

    // Error shown, still on verify page
    await expect(page)
      .getByText('Verification failed. Please check your code and try again.')
      .toBeVisible({
        timeout: 10_000,
      });

    // No auth session cookie should be present
    const cookies = await context.cookies();
    const authCookies = cookies.filter(
      (c) => c.name.includes('auth') || c.name.includes('session'),
    );
    expect(authCookies).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Logout journey
  // -------------------------------------------------------------------------
  test('signed-in user logs out, loses the authenticated shell, and a fresh protected navigation requires auth again', async ({
    page,
    context,
  }) => {
    /**
     * Journey: signed-in → logout → /auth → attempt to visit protected route
     * → redirected to /auth again.
     *
     * Real failure modes:
     * - Logout API succeeds but cookie is not cleared (phantom session)
     * - Cookie is cleared but in-memory state survives (logout incomplete)
     * - Subsequent protected route access still succeeds (auth gate broken)
     */
    await context.clearCookies();
    const email = createAuthTestEmail('logout-journey');

    // Establish session
    await signInWithEmailOtp(page, email, /\/home$/);
    await expect(page).toHaveURL(/\/home$/, { timeout: 30_000 });

    // Record the auth cookie state before logout
    const cookiesBeforeLogout = await context.cookies();
    const authCookiesBefore = cookiesBeforeLogout.filter(
      (c) => c.name.includes('auth') || c.name.includes('session'),
    );
    expect(authCookiesBefore.length).toBeGreaterThan(0);

    // Trigger logout — click sign-out button on account page
    await page.goto('/account');
    await page.getByRole('button', { name: /sign out/i }).click();

    // Should land on /auth with no auth cookies
    await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 });

    const cookiesAfterLogout = await context.cookies();
    const authCookiesAfter = cookiesAfterLogout.filter(
      (c) => c.name.includes('auth') || c.name.includes('session'),
    );
    expect(authCookiesAfter).toHaveLength(0);

    // Attempting to visit a protected route still requires auth
    await page.goto('/home');
    await expect(page).toHaveURL(/\/auth\?next=/, { timeout: 15_000 });
  });

  test('logout redirects to /auth and the session cannot be reused', async ({ page, context }) => {
    /**
     * Journey: logout → /auth → captured cookies from before logout are invalid.
     *
     * Proves that session revocation is effective server-side, not just
     * client-side cookie deletion.
     */
    await context.clearCookies();
    const email = createAuthTestEmail('logout-revocation');

    await signInWithEmailOtp(page, email, /\/home$/);

    // Capture cookies before logout
    const cookiesBefore = await context.cookies();

    // Perform logout
    await page.goto('/account');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 });

    // Manually restore old cookies — they should be invalid
    for (const cookie of cookiesBefore) {
      if (cookie.name.includes('auth') || cookie.name.includes('session')) {
        await context.addCookies([cookie]);
      }
    }

    // The restored cookies should not restore the session
    await page.goto('/home');
    await expect(page).toHaveURL(/\/auth\?next=/, { timeout: 15_000 });
  });
});
