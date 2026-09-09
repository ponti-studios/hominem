import { readLatestScriptedOtp, resolveScriptedMailboxPath } from '@hominem/utils/email';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// Playwright helpers for the API-hosted email-OTP login
// (services/api/src/routes/login), shared by every consuming app (career,
// finance, web, and any future one — see docs/authentication.md). The
// hosted login's own behavior — form fields, hydration timing, the OTP
// digit inputs, the invalid-code error state — only needs covering once,
// here, rather than reimplemented per app. Only the post-login landing URL
// differs between apps, so every flow here takes it as a parameter instead
// of hardcoding one app's redirect.

const OTP_FETCH_TIMEOUT_MS = 15_000;
const OTP_FETCH_RETRY_DELAY_MS = 500;

export function createOtpTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@hominem.test`;
}

/**
 * Fills the email step and submits it, landing on the hosted login's OTP
 * step. The hosted login is a plain HTML form: email step ("Continue"),
 * then a six-digit OTP step ("Verify").
 */
export async function startEmailOtpFlow(page: Page, email: string): Promise<void> {
  await page.goto('/auth');

  // Wait for full React hydration: in Vite dev mode, React may still be
  // reconciling the SSR HTML when the page appears ready. A fill before
  // hydration is complete will be wiped when React takes over the DOM.
  // Retry until the fill value sticks — this is the reliable hydration signal.
  const emailInput = page.getByLabel('Email address');
  await emailInput.waitFor({ state: 'visible' });
  await expect(async () => {
    await emailInput.fill(email);
    await expect(emailInput).toHaveValue(email);
  }).toPass({ timeout: 20_000 });

  const continueButton = page.getByRole('button', { name: 'Continue' });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  await expect(page).toHaveURL(/\/login\?.*step=otp.*email=/, { timeout: 30_000 });
}

/**
 * Polls the scripted mailbox for the most recent OTP sent to `email`. OTPs
 * are never exposed over the API: the scripted email provider appends them
 * to a same-host mailbox file (see @hominem/utils/email), which
 * this polls — the send runs as a server background task, so the capture
 * lands after the request responds.
 */
export async function fetchLatestSignInOtp(email: string): Promise<string> {
  const mailboxFile = resolveScriptedMailboxPath();
  const deadline = Date.now() + OTP_FETCH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const record = readLatestScriptedOtp(mailboxFile, email);

    if (record?.otp) {
      expect(record.otp.length).toBeGreaterThan(3);
      return record.otp;
    }

    await new Promise((resolve) => setTimeout(resolve, OTP_FETCH_RETRY_DELAY_MS));
  }

  throw new Error(`Timed out waiting for sign-in OTP for ${email} in ${mailboxFile}`);
}

/** Fills the six-digit OTP step and submits it, without asserting the outcome. */
export async function submitOtpCode(page: Page, otp: string): Promise<void> {
  const normalized = otp.replace(/\D/g, '').slice(0, 6);

  // The hosted login's visible digit inputs are marked with data-otp-digit
  // (see services/api/src/routes/login/pages.tsx) — not inputmode="numeric".
  const digits = page.locator('input[data-otp-digit]');
  await expect(digits).toHaveCount(6, { timeout: 15_000 });
  for (let i = 0; i < 6; i++) {
    await digits.nth(i).fill(normalized[i] ?? '');
  }
  await expect(digits.first()).toHaveValue(normalized[0] ?? '');

  // The hosted login keeps the submitted OTP in a hidden form field; its
  // own JS syncs it from the digit inputs. Set it via evaluate (Playwright
  // fill() refuses hidden inputs) so the value is correct even if the
  // client-side sync lags.
  const otpField = page.locator('input[name="otp"]');
  await otpField.evaluate((input, value) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, normalized);

  await page.getByRole('button', { name: 'Verify' }).click();
}

/**
 * Full sign-in flow: email step, fetch the real OTP from the scripted
 * mailbox, submit it, and wait for the app's own post-login landing URL.
 */
export async function signInWithOtp(
  page: Page,
  email: string,
  landingUrlPattern: RegExp,
): Promise<void> {
  await startEmailOtpFlow(page, email);
  const otp = await fetchLatestSignInOtp(email);
  await submitOtpCode(page, otp);
  await expect(page).toHaveURL(landingUrlPattern, { timeout: 30_000 });
}
