import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { AUTH_E2E_SECRET, AUTH_TEST_OTP_URL } from './auth.shared';

const OTP_LOOKUP_TIMEOUT_MS = 1_000;
const OTP_LOOKUP_MAX_WAIT_MS = 3_000;

async function backoffDelay(attempt: number, maxMs = 2_000) {
  const ms = Math.min(250 * 2 ** attempt, maxMs);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

interface OtpResponse {
  otp: string;
}

export async function requestEmailOtp(page: Page, email: string) {
  const emailInput = page.getByLabel('Email address');
  await emailInput.waitFor({ state: 'visible' });
  await emailInput.fill(email);
  await expect(emailInput).toHaveValue(email, { timeout: 2_000 });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/auth\/verify\?email=/, { timeout: 5_000 });
}

export async function startEmailOtpFlow(page: Page, email: string) {
  await page.goto('/auth');
  await requestEmailOtp(page, email);
}

export async function fetchLatestSignInOtp(email: string) {
  const startedAt = Date.now();
  let attempt = 0;
  let lastError: unknown;

  while (Date.now() - startedAt < OTP_LOOKUP_MAX_WAIT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OTP_LOOKUP_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${AUTH_TEST_OTP_URL}?email=${encodeURIComponent(email)}&type=sign-in`,
        {
          headers: {
            'x-e2e-auth-secret': AUTH_E2E_SECRET,
          },
          signal: controller.signal,
        },
      );

      if (response.status === 200) {
        const payload = (await response.json()) as OtpResponse;
        expect(payload.otp.length).toBeGreaterThan(3);
        return payload.otp;
      }

      if (response.status !== 404) {
        const body = await response.text();
        throw new Error(`OTP lookup failed (${response.status}): ${body}`);
      }

      lastError = new Error('OTP not available yet');
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    await backoffDelay(attempt);
    attempt += 1;
  }

  throw new Error(
    `Timed out waiting for OTP${lastError instanceof Error ? `: ${lastError.message}` : ''}`,
  );
}

export async function signInWithEmailOtp(page: Page, email: string, destinationPattern: RegExp) {
  await startEmailOtpFlow(page, email);
  const otp = await fetchLatestSignInOtp(email);
  await submitOtpCode(page, otp);
  await expect(page).toHaveURL(destinationPattern, { timeout: 30_000 });
}

export async function enterOtpCode(page: Page, otp: string) {
  const normalized = otp.replace(/\D/g, '').slice(0, 6);
  const codeInput = page.getByLabel('Verification code');

  await codeInput.fill(normalized);
  await expect(codeInput).toHaveValue(normalized, { timeout: 2_000 });
}

export async function submitOtpCode(page: Page, otp: string) {
  const normalized = otp.replace(/\D/g, '').slice(0, 6);
  await enterOtpCode(page, normalized);

  const verifyButton = page.getByRole('button', { name: 'Verify' });
  await expect(verifyButton).toBeEnabled({ timeout: 1_000 });
  await verifyButton.click();
}
