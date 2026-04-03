import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const AUTH_TEST_OTP_URL = 'http://localhost:4040/api/auth/test/otp/latest'
const AUTH_E2E_SECRET = 'otp-secret'

interface OtpResponse {
  otp: string
}

export function createAuthTestEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@hominem.test`
}

export async function startEmailOtpFlow(page: Page, email: string) {
  await page.goto('/auth')

  const emailInput = page.getByLabel('Email address')
  await emailInput.waitFor({ state: 'visible' })
  await expect(async () => {
    await emailInput.fill(email)
    await expect(emailInput).toHaveValue(email)
  }).toPass({ timeout: 20_000 })

  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/auth\/verify\?email=/, { timeout: 30_000 })
}

export async function fetchLatestSignInOtp(email: string) {
  const response = await fetch(`${AUTH_TEST_OTP_URL}?email=${encodeURIComponent(email)}&type=sign-in`, {
    headers: {
      'x-e2e-auth-secret': AUTH_E2E_SECRET,
    },
  })

  expect(response.ok).toBe(true)
  const payload = (await response.json()) as OtpResponse
  expect(payload.otp.length).toBeGreaterThan(3)
  return payload.otp
}

export async function signInWithEmailOtp(page: Page, email: string, destinationPattern: RegExp) {
  await startEmailOtpFlow(page, email)
  const otp = await fetchLatestSignInOtp(email)
  await submitOtpCode(page, otp)
  await expect(page).toHaveURL(destinationPattern, { timeout: 30_000 })
}

export async function enterOtpCode(page: Page, otp: string) {
  const normalized = otp.replace(/\D/g, '').slice(0, 6)
  const codeInput = page.getByLabel('Verification code')

  await expect(async () => {
    await codeInput.fill(normalized)
    await expect(codeInput).toHaveValue(normalized)
  }).toPass({ timeout: 10_000 })
}

export async function submitOtpCode(page: Page, otp: string) {
  const normalized = otp.replace(/\D/g, '').slice(0, 6)
  await enterOtpCode(page, normalized)

  const verifyButton = page.getByRole('button', { name: 'Verify' })
  await expect(verifyButton).toBeEnabled({ timeout: 1_500 })
  await verifyButton.click()
}
