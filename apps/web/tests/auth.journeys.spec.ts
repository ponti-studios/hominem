import { expect, test } from '@playwright/test';

import {
  createAuthTestEmail,
  fetchLatestSignInOtp,
  requestEmailOtp,
  resetAuthTestState,
  signInWithEmailOtp,
  startEmailOtpFlow,
  submitOtpCode,
} from './auth.flow-helpers';

test.describe('auth journeys', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await resetAuthTestState();
  });

  test('signed-out user opens a protected route, lands on /auth, completes OTP, and returns to the originally intended destination', async ({
    page,
  }) => {
    const email = createAuthTestEmail('protected-redirect');
    const targetPath = '/home';

    await page.goto(targetPath);
    await expect(page).toHaveURL(/\/auth\?next=/, { timeout: 15_000 });

    const url = new URL(page.url());
    expect(url.searchParams.get('next')).toBe(targetPath);

    await requestEmailOtp(page, email);
    const otp = await fetchLatestSignInOtp(email);
    await submitOtpCode(page, otp);
    await expect(page).toHaveURL(/\/home$/, { timeout: 30_000 });
  });

  test('signed-out user directed to /auth?next=/settings completes auth and lands on settings', async ({
    page,
  }) => {
    const email = createAuthTestEmail('settings-redirect');
    const targetPath = '/settings/security';

    await page.goto(targetPath);
    await expect(page).toHaveURL(/\/auth\?next=/, { timeout: 15_000 });

    const url = new URL(page.url());
    expect(url.searchParams.get('next')).toBe(targetPath);

    await requestEmailOtp(page, email);
    const otp = await fetchLatestSignInOtp(email);
    await submitOtpCode(page, otp);
    await expect(page).toHaveURL(/\/settings\/security$/, { timeout: 30_000 });
  });

  test('signed-in user opens /auth and is redirected away to the authenticated shell', async ({
    page,
  }) => {
    const email = createAuthTestEmail('auth-redirect-away');

    await signInWithEmailOtp(page, email, /\/home$/);
    await page.goto('/auth');
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  });

  test('signed-in user at /auth/verify is redirected to home, not back to verify', async ({
    page,
  }) => {
    const email = createAuthTestEmail('verify-redirect-away');

    await signInWithEmailOtp(page, email, /\/home$/);
    await page.goto(`/auth/verify?email=${encodeURIComponent(email)}`);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  });

  test('user enters a bad OTP, remains on verify screen, retries with the right OTP, and reaches the product shell', async ({
    page,
  }) => {
    const email = createAuthTestEmail('otp-retry');

    await startEmailOtpFlow(page, email);
    await submitOtpCode(page, '111111');

    await expect(page).toHaveURL(/\/auth\/verify\?email=/, { timeout: 15_000 });
    await expect(
      page.getByText('Verification failed. Please check your code and try again.'),
    ).toBeVisible({ timeout: 10_000 });

    const url = new URL(page.url());
    expect(url.searchParams.get('email')).toBe(email);

    const correctOtp = await fetchLatestSignInOtp(email);
    await submitOtpCode(page, correctOtp);
    await expect(page).toHaveURL(/\/home$/, { timeout: 30_000 });
  });

  test('failed OTP attempt does not leave a session cookie', async ({ page, context }) => {
    const email = createAuthTestEmail('otp-no-leak');

    await startEmailOtpFlow(page, email);
    await submitOtpCode(page, '000000');
    await expect(
      page.getByText('Verification failed. Please check your code and try again.'),
    ).toBeVisible({ timeout: 10_000 });

    const cookies = await context.cookies();
    const authCookies = cookies.filter(
      (cookie) => cookie.name.includes('auth') || cookie.name.includes('session'),
    );
    expect(authCookies).toHaveLength(0);
  });

  test('signed-in user logs out, loses the authenticated shell, and a fresh protected navigation requires auth again', async ({
    page,
    context,
  }) => {
    const email = createAuthTestEmail('logout-journey');

    await signInWithEmailOtp(page, email, /\/home$/);

    const cookiesBeforeLogout = await context.cookies();
    const authCookiesBefore = cookiesBeforeLogout.filter(
      (cookie) => cookie.name.includes('auth') || cookie.name.includes('session'),
    );
    expect(authCookiesBefore.length).toBeGreaterThan(0);

    await page.goto('/account');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 });

    const cookiesAfterLogout = await context.cookies();
    const authCookiesAfter = cookiesAfterLogout.filter(
      (cookie) => cookie.name.includes('auth') || cookie.name.includes('session'),
    );
    expect(authCookiesAfter).toHaveLength(0);

    await page.goto('/home');
    await expect(page).toHaveURL(/\/auth\?next=/, { timeout: 15_000 });
  });

  test('logout redirects to /auth and the session cannot be reused', async ({ page, context }) => {
    const email = createAuthTestEmail('logout-revocation');

    await signInWithEmailOtp(page, email, /\/home$/);
    const cookiesBefore = await context.cookies();

    await page.goto('/account');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 });

    for (const cookie of cookiesBefore) {
      if (cookie.name.includes('auth') || cookie.name.includes('session')) {
        await context.addCookies([cookie]);
      }
    }

    await page.goto('/home');
    await expect(page).toHaveURL(/\/auth\?next=/, { timeout: 15_000 });
  });
});
