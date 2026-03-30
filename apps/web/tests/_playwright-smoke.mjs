import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const BASE = 'http://localhost:4445';
const API = 'http://localhost:4040';
const AUTH_E2E_SECRET = 'otp-secret';

function createAuthEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@hominem.test`;
}

async function resetAuthState() {
  const response = await fetch(`${API}/api/auth/test/cleanup`, {
    method: 'POST',
    headers: {
      'x-e2e-auth-secret': AUTH_E2E_SECRET,
    },
  });

  if (!response.ok) {
    throw new Error(`cleanup failed with ${response.status}`);
  }
}

async function fetchOtp(email) {
  const response = await fetch(
    `${API}/api/auth/test/otp/latest?email=${encodeURIComponent(email)}&type=sign-in`,
    {
      headers: { 'x-e2e-auth-secret': AUTH_E2E_SECRET },
    },
  );

  if (!response.ok) {
    throw new Error(`otp fetch failed with ${response.status} for ${email}`);
  }

  return (await response.json()).otp;
}

async function requestOtp(email) {
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/auth\/verify\?email=/, { timeout: 30000 });
}

async function fillOtp(otp) {
  const normalized = otp.replace(/\D/g, '').slice(0, 6);
  const inputs = page.locator('input[inputmode="numeric"]');

  for (let i = 0; i < 6; i++) {
    await inputs.nth(i).fill(normalized[i] ?? '');
  }
}

async function resetBrowserState() {
  await context.clearCookies();
  await resetAuthState();
}

console.log('Test 1: protected route redirect with ?next= ...');
await resetBrowserState();
await page.goto(`${BASE}/home`);
await page.waitForURL(/\/auth\?next=/, { timeout: 20000 });
const redirectUrl = new URL(page.url());
if (!redirectUrl.searchParams.get('next')) throw new Error('missing next param');
console.log('  next =', redirectUrl.searchParams.get('next'));
console.log('  PASS');

console.log('Test 2: complete OTP flow ...');
await resetBrowserState();
const signInEmail = createAuthEmail('playwright');
await page.goto(`${BASE}/auth`);
await requestOtp(signInEmail);
await fillOtp(await fetchOtp(signInEmail));
await page.getByRole('button', { name: 'Verify' }).click();
await page.waitForURL(/\/home$/, { timeout: 30000 });
console.log('  PASS');

console.log('Test 3: invalid OTP stays on verify page ...');
await resetBrowserState();
await page.goto(`${BASE}/auth`);
await requestOtp(createAuthEmail('invalid'));
await fillOtp('000000');
await page.getByRole('button', { name: 'Verify' }).click();
await page.waitForURL(/\/auth\/verify\?email=/, { timeout: 15000 });
if (!(await page.getByText('Verification failed').isVisible())) {
  throw new Error('error not shown');
}
console.log('  PASS');

console.log('Test 4: signed-in user redirected from /auth ...');
await resetBrowserState();
const redirectEmail = createAuthEmail('redirect');
await page.goto(`${BASE}/auth`);
await requestOtp(redirectEmail);
await fillOtp(await fetchOtp(redirectEmail));
await page.getByRole('button', { name: 'Verify' }).click();
await page.waitForURL(/\/home$/, { timeout: 30000 });
await page.goto(`${BASE}/auth`);
await page.waitForURL(/\/home$/, { timeout: 15000 });
console.log('  PASS');

await browser.close();
console.log('\nAll 4 smoke tests passed');
