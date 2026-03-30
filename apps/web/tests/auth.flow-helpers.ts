import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const AUTH_TEST_OTP_URL = 'http://localhost:4040/api/auth/test/otp/latest';
const AUTH_TEST_CLEANUP_URL = 'http://localhost:4040/api/auth/test/cleanup';
const AUTH_E2E_SECRET = 'otp-secret';

interface OtpResponse {
  otp: string;
}

function getAuthTestHeaders() {
  return {
    'x-e2e-auth-secret': AUTH_E2E_SECRET,
  };
}

export function createAuthTestEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@hominem.test`;
}

export async function resetAuthTestState() {
  const response = await fetch(AUTH_TEST_CLEANUP_URL, {
    method: 'POST',
    headers: getAuthTestHeaders(),
  });

  expect(response.ok).toBe(true);
}

export async function requestEmailOtp(page: Page, email: string) {
  const emailInput = page.getByLabel('Email address');
  await emailInput.waitFor({ state: 'visible' });
  await expect(async () => {
    await emailInput.fill(email);
    await expect(emailInput).toHaveValue(email);
  }).toPass({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/auth\/verify\?email=/, { timeout: 30_000 });
}

export async function startEmailOtpFlow(page: Page, email: string) {
  await page.goto('/auth');
  await requestEmailOtp(page, email);
}

export async function fetchLatestSignInOtp(email: string) {
  const response = await fetch(
    `${AUTH_TEST_OTP_URL}?email=${encodeURIComponent(email)}&type=sign-in`,
    {
      headers: getAuthTestHeaders(),
    },
  );

  expect(response.ok).toBe(true);
  const payload = (await response.json()) as OtpResponse;
  expect(payload.otp.length).toBeGreaterThan(3);
  return payload.otp;
}

export async function signInWithEmailOtp(page: Page, email: string, destinationPattern: RegExp) {
  await startEmailOtpFlow(page, email);
  const otp = await fetchLatestSignInOtp(email);
  await submitOtpCode(page, otp);
  await expect(page).toHaveURL(destinationPattern, { timeout: 30_000 });
}

export async function enterOtpCode(page: Page, otp: string) {
  const normalized = otp.replace(/\D/g, '').slice(0, 6);

  await page.locator('form').evaluate((form, value) => {
    if (!(form instanceof HTMLFormElement)) {
      throw new Error('OTP form missing');
    }

    const input = form.querySelector('input[name="otp"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('OTP input missing');
    }

    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, normalized);
}

export async function submitOtpCode(page: Page, otp: string) {
  const normalized = otp.replace(/\D/g, '').slice(0, 6);
  await enterOtpCode(page, normalized);

  await page.locator('form').evaluate((form) => {
    if (!(form instanceof HTMLFormElement)) {
      throw new Error('OTP form missing');
    }

    form.requestSubmit();
  });
}
