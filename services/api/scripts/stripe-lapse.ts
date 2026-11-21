/**
 * One-command Test Clock lapse verification (docs/billing-test-plan.md): seeds a disposable
 * account, starts a Core subscription under a Stripe Test Clock through the same metadata
 * contract a checkout produces, cancels through the real app, then advances the clock past
 * the period end and asserts the account falls back to Taster with access retained until
 * then. Judgement lives in the tested pure module; this script is the I/O relay.
 *
 * Usage: just billing stripe-lapse
 *
 * Needs `just billing stripe-setup` green and `just billing stripe-listen` running in
 * another terminal, exactly like stripe-test. Never point it at a live key: the doctor
 * refuses one.
 */
import 'dotenv/config';
import { pricePenceFor, planFor } from '../src/application/billing';
import { STRIPE_API_VERSION, createStripeClient } from '../src/application/stripe';
import { verifyStripeLapseOutcome } from '../src/application/stripe-lapse-verify';
import { diagnoseStripeSetup } from '../src/application/stripe-setup-doctor';
import { gatherStripeSetupFacts } from './stripe-facts';
import {
  die,
  printFindings,
  readBillingPage,
  readBillingRecord,
  readReportedAiTokens,
  resetDisposableAccount,
  signIn,
  sleep,
  waitForBillingRecord,
} from './stripe-session';

/** The doctor guarantees no STRIPE_API_BASE_URL override, so this is always Stripe itself. */
const STRIPE_BASE = 'https://api.stripe.com/v1';
const EMAIL = 'stripe-lapse-e2e@test.hominem.dev';
const WEBHOOK_DEADLINE_MS = 30_000;
const ACTIVE_DEADLINE_MS = 15_000;
const CLOCK_DEADLINE_MS = 15_000;
const CANCEL_DEADLINE_MS = 15_000;
const LAPSE_DEADLINE_MS = 60_000;

/** Stripe REST for the objects the app has no client for: clocks, customers, payment methods. */
function createTestModeClient(secretKey: string) {
  return async function call(
    what: string,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    form?: URLSearchParams,
  ): Promise<unknown> {
    const response = await fetch(`${STRIPE_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        // The account's default version predates test clocks; the app's pin does not.
        'Stripe-Version': STRIPE_API_VERSION,
        ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      // Only the writing methods carry a body; a GET with one is refused.
      ...(form ? { body: form.toString() } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Stripe ${what} failed (${response.status})`);
    return response.json();
  };
}

/** Anything object-shaped with string keys, for reading one field without trusting its shape. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** One field out of a JSON body, without trusting the body's shape. */
function stringField(object: unknown, key: string): string {
  if (!isRecord(object) || !(key in object)) return '';
  const value = object[key];
  return typeof value === 'string' ? value : '';
}

async function main(): Promise<void> {
  const origin = process.env.API_URL;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!origin || !secretKey) {
    die(
      'API_URL and STRIPE_SECRET_KEY must be set (the local portless origin and the Test Mode key)',
    );
  }

  const setup = diagnoseStripeSetup(await gatherStripeSetupFacts());
  if (setup.some((finding) => !finding.ok)) {
    printFindings(
      'Local Stripe verification is not ready — run just billing stripe-setup for details:',
      setup,
    );
    process.exit(1);
  }

  console.log(`→ resetting disposable account ${EMAIL}`);
  await resetDisposableAccount(EMAIL);
  console.log(`→ signing in over the real OTP flow at ${origin}`);
  const { userId, cookie } = await signIn(origin, EMAIL);

  const stripe = createTestModeClient(secretKey);
  console.log('→ creating a Stripe Test Clock frozen at now');
  // Test clocks live under the test_helpers namespace in current API versions.
  const clock = await stripe(
    'create test clock',
    'POST',
    '/test_helpers/test_clocks',
    new URLSearchParams({
      frozen_time: String(Math.floor(Date.now() / 1000)),
      name: 'Hominem lapse e2e',
    }),
  );
  const clockId = stringField(clock, 'id');
  if (!clockId) die('Stripe returned no test clock id');
  for (let waited = 0; ; waited += 1_000) {
    const status = stringField(
      await stripe('read test clock', 'GET', `/test_helpers/test_clocks/${clockId}`),
      'status',
    );
    if (!status || status === 'ready') break;
    if (waited >= CLOCK_DEADLINE_MS) die('test clock never became ready');
    await sleep(1_000);
  }
  console.log(`  clock ${clockId} ready`);

  console.log('→ creating the clock-attached customer with a test card');
  const method = await stripe(
    'create payment method',
    'POST',
    '/payment_methods',
    new URLSearchParams({ type: 'card', 'card[token]': 'tok_visa' }),
  );
  const paymentMethodId = stringField(method, 'id');
  if (!paymentMethodId) die('Stripe returned no payment method id');
  // One call attaches the card and makes it the invoice default, per the test-clock docs.
  const customer = await stripe(
    'create customer',
    'POST',
    '/customers',
    new URLSearchParams({
      test_clock: clockId,
      email: EMAIL,
      name: 'Stripe Lapse E2E',
      payment_method: paymentMethodId,
      'invoice_settings[default_payment_method]': paymentMethodId,
    }),
  );
  const customerId = stringField(customer, 'id');
  if (!customerId) die('Stripe returned no customer id');

  console.log('→ starting the Core subscription under the clock');
  const appClient = createStripeClient(secretKey);
  const priceId = await appClient.resolveSubscriptionPrice('core', pricePenceFor('core', false));
  const created = await stripe(
    'create subscription',
    'POST',
    '/subscriptions',
    new URLSearchParams({
      customer: customerId,
      'items[0][price]': priceId,
      'metadata[user_id]': userId,
      'metadata[tier]': 'core',
      'metadata[founding]': 'false',
    }),
  );
  const subscriptionId = stringField(created, 'id');
  if (!subscriptionId) die('Stripe returned no subscription id');
  let createdFacts = await appClient.subscription(subscriptionId);
  for (let waited = 0; createdFacts.status !== 'active'; waited += 1_000) {
    if (waited >= ACTIVE_DEADLINE_MS) {
      die(
        `expected the first invoice to pay and the subscription to go active, but Stripe says ${createdFacts.status}`,
      );
    }
    await sleep(1_000);
    createdFacts = await appClient.subscription(subscriptionId);
  }
  console.log(
    `  subscription ${subscriptionId}: active until ${createdFacts.currentPeriodEnd.toISOString()}`,
  );

  console.log('→ waiting for the billing webhook to deliver the subscription');
  const createdRecord = await waitForBillingRecord(
    userId,
    // The created event may arrive while the first invoice is still paying; the store is
    // settled only once a subscription event lands the granted state.
    (record) => record !== null && record.status === 'active',
    WEBHOOK_DEADLINE_MS,
  );
  if (!createdRecord) die('no subscription record landed — is just billing stripe-listen running?');
  // The observations are taken at the moment they describe — the page states below are
  // checked while they are still true, not reconstructed from the lapsed end state.
  const afterCreate = {
    subscription: createdRecord,
    reportedAiTokens: await readReportedAiTokens(origin, cookie),
  };

  console.log('→ cancelling through the app at /billing/cancel');
  const cancel = await fetch(`${origin}/billing/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, origin },
  });
  // fetch follows the app's 303 to the billing page, so the record poll below is the real proof.
  if (!cancel.ok) die(`expected /billing/cancel to succeed but got ${cancel.status}`);
  const cancelledRecord = await waitForBillingRecord(
    userId,
    (record) => record !== null && record.cancelAtPeriodEnd,
    CANCEL_DEADLINE_MS,
  );
  if (!cancelledRecord) die('the record never reached the cancelled-at-period-end state');
  const afterCancel = {
    subscription: cancelledRecord,
    reportedAiTokens: await readReportedAiTokens(origin, cookie),
    billingHtml: await readBillingPage(origin, cookie),
  };

  console.log('→ advancing the Test Clock past the period end');
  const lapseTime = Math.floor(createdFacts.currentPeriodEnd.getTime() / 1000) + 3_600;
  await stripe(
    'advance test clock',
    'POST',
    `/test_helpers/test_clocks/${clockId}/advance`,
    new URLSearchParams({ frozen_time: String(lapseTime) }),
  );
  let lapsed = false;
  for (let waited = 0; !lapsed; waited += 1_000) {
    lapsed = (await appClient.subscription(subscriptionId)).status === 'canceled';
    if (lapsed) break;
    if (waited >= LAPSE_DEADLINE_MS) die('the clock advanced but the subscription never canceled');
    await sleep(1_000);
  }

  console.log('→ waiting for the billing webhook to land the lapse');
  await waitForBillingRecord(
    userId,
    (record) => record !== null && planFor(record, new Date()) === 'taster',
    LAPSE_DEADLINE_MS,
  );
  // The poll's return is discarded on purpose: the verdict reads whatever the store holds now.
  const afterLapse = {
    subscription: await readBillingRecord(userId),
    reportedAiTokens: await readReportedAiTokens(origin, cookie),
    billingHtml: await readBillingPage(origin, cookie),
  };

  const findings = verifyStripeLapseOutcome({
    now: new Date(),
    afterCreate,
    afterCancel,
    afterLapse,
  });
  printFindings('\nstripe-lapse results:', findings);
  if (findings.some((finding) => !finding.ok)) process.exit(1);

  await stripe('delete test clock', 'DELETE', `/test_helpers/test_clocks/${clockId}`).catch(
    (error: unknown) => {
      console.error(`  (test clock ${clockId} left in place: ${String(error)})`);
    },
  );
  console.log(
    '\n✓ Test Clock lapse verified: cancel retains access, the lapse falls back to Taster.',
  );
}

void main();
