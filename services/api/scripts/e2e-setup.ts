/**
 * e2e-setup.ts
 *
 * Provisions the persistent E2E test account and prints a ready-to-export
 * session cookie for use in iOS XCUITest runs.
 *
 * Usage:
 *   pnpm e2e:setup              # uses AUTH_E2E_SECRET from .env
 *   AUTH_E2E_SECRET=xxx pnpm e2e:setup
 *
 * What it does:
 *   1. Sends an OTP to e2e@test.hakumi.io  (creates the user if absent)
 *   2. Fetches the OTP from GET /api/auth/test/otp/latest
 *   3. Signs in via POST /api/auth/sign-in/email-otp  →  session cookie
 *   4. Prints export statements for E2E_SESSION_COOKIE, E2E_USER_ID, E2E_USER_EMAIL
 *
 * Prerequisites on the server:
 *   AUTH_TEST_OTP_ENABLED=true
 *   AUTH_E2E_ENABLED=true
 *   AUTH_E2E_SECRET=<secret>
 */

import 'dotenv/config';

const API_URL = (process.env.API_URL ?? 'http://localhost:4040').replace(/\/$/, '');
const E2E_SECRET = process.env.AUTH_E2E_SECRET ?? '';
const TEST_EMAIL = 'e2e@test.hakumi.io';
const MAX_OTP_POLL_ATTEMPTS = 8;
const OTP_POLL_INTERVAL_MS = 500;

// ---------------------------------------------------------------------------

function die(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  process.stdout.write(`  ${label}... `);
  try {
    const result = await fn();
    console.log('✓');
    return result;
  } catch (err) {
    console.log('✗');
    throw err;
  }
}

// ---------------------------------------------------------------------------

async function sendOTP(): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, type: 'sign-in' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}

async function fetchOTP(): Promise<string> {
  const url = `${API_URL}/api/auth/test/otp/latest?email=${encodeURIComponent(TEST_EMAIL)}&type=sign-in`;
  const headers: Record<string, string> = {};
  if (E2E_SECRET) headers['x-e2e-auth-secret'] = E2E_SECRET;

  for (let attempt = 0; attempt < MAX_OTP_POLL_ATTEMPTS; attempt++) {
    await sleep(OTP_POLL_INTERVAL_MS);
    const res = await fetch(url, { headers });
    if (res.status === 404) continue; // not recorded yet — retry
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { otp: string };
    if (data.otp) return data.otp;
  }
  throw new Error(`OTP not available after ${MAX_OTP_POLL_ATTEMPTS} attempts`);
}

interface SignInResult {
  sessionCookie: string;
  user: { id: string; email: string; name: string | null };
}

async function signIn(otp: string): Promise<SignInResult> {
  const res = await fetch(`${API_URL}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, otp }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  // Extract session cookie — Better Auth sets it in Set-Cookie
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No Set-Cookie header in sign-in response. Check that AUTH_COOKIE_DOMAIN is set correctly for the local environment.');
  }

  // Take only the name=value pair, strip attributes
  const sessionCookie = setCookie.split(';')[0]?.trim() ?? '';
  if (!sessionCookie) throw new Error('Could not parse session cookie value');

  const body = (await res.json()) as {
    user?: { id: string; email: string; name?: string | null };
  };
  const user = body.user;
  if (!user?.id || !user?.email) {
    throw new Error('Sign-in response missing user data');
  }

  return { sessionCookie, user: { id: user.id, email: user.email, name: user.name ?? null } };
}

// ---------------------------------------------------------------------------

async function main() {
  console.log('\nHakumi E2E setup\n');
  console.log(`  API:   ${API_URL}`);
  console.log(`  Email: ${TEST_EMAIL}`);
  if (!E2E_SECRET) {
    console.warn('\n  ⚠  AUTH_E2E_SECRET is not set — OTP retrieval may fail if the server requires it.\n');
  }
  console.log();

  let otp: string;
  let result: SignInResult;

  try {
    await step('Sending OTP', sendOTP);
    otp = await step('Fetching OTP from test store', fetchOTP);
    result = await step('Signing in', () => signIn(otp));
  } catch (err) {
    die((err as Error).message);
  }

  const { sessionCookie, user } = result!;

  console.log('\n──────────────────────────────────────────────────────────\n');
  console.log('E2E credentials ready.\n');
  console.log('Export these before running iOS E2E tests:\n');
  console.log(`  export E2E_SESSION_COOKIE="${sessionCookie}"`);
  console.log(`  export E2E_USER_ID="${user.id}"`);
  console.log(`  export E2E_USER_EMAIL="${user.email}"`);
  if (user.name) console.log(`  export E2E_USER_NAME="${user.name}"`);
  console.log('\n──────────────────────────────────────────────────────────');
  console.log('\nOr pipe into your shell:\n');
  console.log(`  eval "$(pnpm --silent e2e:setup 2>/dev/null | grep 'export ')"\n`);
}

main();
