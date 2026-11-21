/**
 * One-command hosted Test Mode checkout verification (docs/billing-test-plan.md): seeds a
 * disposable account, starts a subscription checkout through the real app, completes Stripe's
 * hosted page with a test card, and asserts the webhook-delivered entitlement and allowance.
 * Judgement lives in the tested pure modules; this script is the I/O relay between them.
 *
 * Usage: just billing stripe-test core|rhodium|iridium
 *
 * Needs `just billing stripe-setup` green (Test Mode key in the ignored services/api/.env, no
 * STRIPE_API_BASE_URL, webhook secret set) and `just billing stripe-listen` running in another
 * terminal. Never point it at a live key: the doctor refuses one.
 */
import 'dotenv/config';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { BillingSubscriptionRecord } from '@hominem/db/billing';
import { readLatestScriptedOtp, resolveScriptedMailboxPath } from '@hominem/utils/email';
import { chromium } from 'playwright-core';

import {
  diagnoseStripeSetup,
  type StripeSetupFinding,
} from '../src/application/stripe-setup-doctor';
import {
  verifyStripeTestOutcome,
  type StripeTestTier,
  type StripeTestFinding,
} from '../src/application/stripe-test-verify';
import { gatherStripeSetupFacts } from './stripe-facts';

const run = promisify(execFile);
const TIERS: readonly StripeTestTier[] = ['core', 'rhodium', 'iridium'];
const SUBSCRIPTION_DEADLINE_MS = 30_000;
const POLL_INTERVAL_MS = 500;

function die(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printFindings(header: string, findings: StripeSetupFinding[] | StripeTestFinding[]): void {
  console.log(header);
  for (const finding of findings) {
    console.log(
      `  ${finding.ok ? '✓' : '✗'} ${finding.label}${finding.ok ? '' : ` — ${finding.fix}`}`,
    );
  }
}

/** Signs in over the real OTP flow and returns the session cookie header value. */
async function signIn(origin: string, email: string): Promise<{ userId: string; cookie: string }> {
  const send = await fetch(`${origin}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
    headers: { 'content-type': 'application/json' },
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

/** Starts the app's own checkout and returns the hosted Stripe URL it redirects to. */
async function startCheckout(
  origin: string,
  cookie: string,
  tier: StripeTestTier,
): Promise<string> {
  const response = await fetch(`${origin}/billing/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: `tier=${tier}`,
    redirect: 'manual',
  });
  const location = response.headers.get('location') ?? '';
  if (response.status !== 303 || !location.startsWith('https://checkout.stripe.com/')) {
    die(
      `expected a 303 redirect to Stripe's hosted checkout but got ${response.status} ${location || '(no location)'}`,
    );
  }
  return location;
}

/** Fills the first locator that is present and editable. Hosted-page labels vary over time. */
async function tryFill(
  candidates: () => Promise<{ fill: (value: string) => Promise<void> } | null>[],
  value: string,
): Promise<boolean> {
  for (const candidate of candidates) {
    const locator = await candidate();
    if (
      locator &&
      (await locator.fill(value).then(
        () => true,
        () => false,
      ))
    )
      return true;
  }
  return false;
}

/** Completes Stripe's hosted Test Mode checkout with the standard test card. */
async function completeHostedCheckout(
  hostedUrl: string,
  email: string,
  origin: string,
): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(hostedUrl, { waitUntil: 'domcontentloaded' });

    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.count()) await emailInput.fill(email);

    const frame = page.frameLocator('iframe[title*="payment input frame" i]').first();
    const cardFilled = await tryFill(
      [
        () => Promise.resolve(frame.getByLabel('Card number')),
        () => Promise.resolve(page.getByLabel('Card number')),
      ],
      '4242424242424242',
    );
    if (!cardFilled) throw new Error('card number field not found');
    await tryFill(
      [
        () => Promise.resolve(frame.getByLabel(/expir/i)),
        () => Promise.resolve(page.getByLabel(/expir/i)),
      ],
      '12/34',
    );
    await tryFill(
      [
        () => Promise.resolve(frame.getByLabel('CVC')),
        () => Promise.resolve(frame.getByLabel(/cvc|security code/i)),
      ],
      '424',
    );

    const payButton = page
      .getByRole('button', { name: /pay|subscribe|complete purchase|submit/i })
      .first();
    await payButton.click();
    await page.waitForURL((url) => url.href.startsWith(`${origin}/billing/done`), {
      timeout: 90_000,
    });
  } catch (error) {
    const path = join(tmpdir(), `hominem-stripe-test-${Date.now()}.png`);
    await page.screenshot({ path, fullPage: true }).catch(() => {});
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => Promise.resolve(''));
    console.error(`  page text at failure: ${text.slice(0, 400)}`);
    die(`hosted checkout did not complete: ${error} — screenshot saved to ${path}`);
  } finally {
    await browser.close();
  }
}

/** Reads the allowance the app itself renders for the signed-in account, or null. */
async function readReportedAiTokens(origin: string, cookie: string): Promise<number | null> {
  const response = await fetch(`${origin}/account/billing`, { headers: { cookie } });
  const html = await response.text();
  const match = /([\d,.]+)\s*([KM])?\s*AI tokens\/month/.exec(html);
  if (!match) return null;
  const magnitude = match[2] === 'K' ? 1_000 : match[2] === 'M' ? 1_000_000 : 1;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value * magnitude : null;
}

/** Waits for the billing webhook to land the subscription record. Null once the deadline passes. */
async function waitForSubscription(userId: string): Promise<BillingSubscriptionRecord | null> {
  // Imported lazily so the pre-flight doctor runs with zero database side effects.
  const { dbBillingStore } = await import('../src/application/billing.store');
  const deadline = Date.now() + SUBSCRIPTION_DEADLINE_MS;
  for (;;) {
    const record = await dbBillingStore.get(userId);
    if (record) return record;
    if (Date.now() >= deadline) return null;
    await sleep(POLL_INTERVAL_MS);
  }
}

async function main(): Promise<void> {
  const tierArg = process.argv[2];
  const tier = TIERS.find((candidate) => candidate === tierArg);
  if (!tier) die(`Usage: just billing stripe-test <tier> — one of ${TIERS.join(', ')}`);

  const origin = process.env.API_URL;
  if (!origin) die('API_URL must be set (the local portless origin, e.g. https://api.lvh.me)');

  const setup = diagnoseStripeSetup(await gatherStripeSetupFacts());
  const setupFailures = setup.filter((finding) => !finding.ok);
  if (setupFailures.length > 0) {
    printFindings(
      'Local Stripe verification is not ready — run just billing stripe-setup for details:',
      setup,
    );
    process.exit(1);
  }

  const email = `stripe-${tier}-e2e@test.hominem.dev`;
  console.log(`→ resetting disposable account ${email}`);
  const packageRoot = join(import.meta.dirname, '..');
  await run('pnpm', ['test-user', 'reset', '--email', email], { cwd: packageRoot });

  console.log(`→ signing in over the real OTP flow at ${origin}`);
  const { userId, cookie } = await signIn(origin, email);

  console.log(`→ starting ${tier} checkout through the app`);
  const hostedUrl = await startCheckout(origin, cookie, tier);

  console.log('→ completing the hosted Test Mode checkout with the test card');
  await completeHostedCheckout(hostedUrl, email, origin);

  console.log('→ waiting for the billing webhook to deliver the subscription');
  const subscription = await waitForSubscription(userId);
  if (subscription) {
    console.log(
      `  stored: tier=${subscription.tier} status=${subscription.status} pricePence=${subscription.pricePence} founding=${subscription.founding}`,
    );
  }

  const reportedAiTokens = await readReportedAiTokens(origin, cookie);
  console.log(`→ the app reports ${reportedAiTokens ?? 'no readable'} AI tokens/month`);

  const findings = verifyStripeTestOutcome(tier, { subscription, reportedAiTokens });
  printFindings(`\nstripe-test ${tier} results:`, findings);
  if (findings.some((finding) => !finding.ok)) process.exit(1);
  console.log(`\n✓ ${tier} Test Mode checkout verified end to end.`);
}

void main();
