/**
 * The I/O both Stripe verification scripts share: failing loudly, recreating the disposable
 * account, signing in over the real OTP flow, reading what the app reports for the account,
 * and waiting for the billing webhook to write the store. Judgement stays in the tested pure
 * modules; this is the relay.
 */
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { BillingSubscriptionRecord } from '@hominem/db/billing';
import { readLatestScriptedOtp, resolveScriptedMailboxPath } from '@hominem/utils/email';

import type { StripeSetupFinding } from '../src/application/stripe-setup-doctor';
import type { StripeTestFinding } from '../src/application/stripe-test-verify';

const run = promisify(execFile);
const POLL_INTERVAL_MS = 500;

export function die(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One finding list, in the shape every verification script prints. */
export function printFindings(
  header: string,
  findings: StripeSetupFinding[] | StripeTestFinding[],
): void {
  console.log(header);
  for (const finding of findings) {
    console.log(
      `  ${finding.ok ? '✓' : '✗'} ${finding.label}${finding.ok ? '' : ` — ${finding.fix}`}`,
    );
  }
}

/** Recreates the disposable test account so a run always starts from a clean slate. */
export async function resetDisposableAccount(email: string): Promise<void> {
  await run('pnpm', ['test-user', 'reset', '--email', email], {
    cwd: join(import.meta.dirname, '..'),
  });
}

/** Signs in over the real OTP flow and returns the session cookie header value. */
export async function signIn(
  origin: string,
  email: string,
): Promise<{ userId: string; cookie: string }> {
  const send = await fetch(`${origin}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    // The API's origin check rejects browser-shaped requests without an Origin header.
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  if (!send.ok) die(`OTP send failed (${send.status}) — is the API running at ${origin}?`);

  const mailbox = resolveScriptedMailboxPath();
  const deadline = Date.now() + 15_000;
  let otp = '';
  for (;;) {
    otp = readLatestScriptedOtp(mailbox, email)?.otp ?? '';
    if (otp) break;
    if (Date.now() >= deadline) die(`No OTP captured for ${email} in ${mailbox}`);
    await sleep(POLL_INTERVAL_MS);
  }

  const verify = await fetch(`${origin}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email, otp }),
  });
  const body: unknown = await verify.json().catch(() => null);
  const cookie = verify.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ');
  const userId = userIdFromSignInResponse(body);
  if (!verify.ok || !userId || !cookie) {
    die(`sign-in failed (${verify.status}) for ${email} — ${JSON.stringify(body)}`);
  }
  return { userId, cookie };
}

/** Reads the user id out of a sign-in response without trusting its shape. */
function userIdFromSignInResponse(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('user' in body)) return null;
  const { user } = body;
  if (typeof user !== 'object' || user === null || !('id' in user)) return null;
  const { id } = user;
  return typeof id === 'string' && id ? id : null;
}

/** Reads the allowance the app itself renders for the signed-in account, or null. The paid
 * plan card shows "3.9M AI tokens/month"; the Taster card shows "up to 1M AI tokens, …".
 * The subscribe-list cards say "AI tokens each month" and never match. */
export async function readReportedAiTokens(origin: string, cookie: string): Promise<number | null> {
  const response = await fetch(`${origin}/account/billing`, { headers: { cookie, origin } });
  const html = await response.text();
  const match = /([\d,.]+)\s*([KM])?\s*AI tokens(?:\/month|,)/.exec(html);
  if (!match) return null;
  const magnitude = match[2] === 'K' ? 1_000 : match[2] === 'M' ? 1_000_000 : 1;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value * magnitude : null;
}

/** The billing page as the signed-in account sees it, for the states only the page can show. */
export async function readBillingPage(origin: string, cookie: string): Promise<string> {
  const response = await fetch(`${origin}/account/billing`, { headers: { cookie, origin } });
  return response.text();
}

/** The stored billing record as it stands right now. */
export async function readBillingRecord(userId: string): Promise<BillingSubscriptionRecord | null> {
  // Imported lazily so a pre-flight doctor run keeps zero database side effects.
  const { dbBillingStore } = await import('../src/application/billing.store');
  return dbBillingStore.get(userId);
}

/** Waits until the webhook-written record matches, or null once the deadline passes. */
export async function waitForBillingRecord(
  userId: string,
  matches: (record: BillingSubscriptionRecord | null) => boolean,
  deadlineMs: number,
): Promise<BillingSubscriptionRecord | null> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    const record = await readBillingRecord(userId);
    if (matches(record)) return record;
    if (Date.now() >= deadline) return null;
    await sleep(POLL_INTERVAL_MS);
  }
}
