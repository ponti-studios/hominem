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
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright-core';
import type { Frame, Locator, Page } from 'playwright-core';

import { diagnoseStripeSetup } from '../src/application/stripe-setup-doctor';
import {
  verifyStripeTestOutcome,
  type StripeTestTier,
} from '../src/application/stripe-test-verify';
import { gatherStripeSetupFacts } from './stripe-facts';
import {
  die,
  printFindings,
  readReportedAiTokens,
  resetDisposableAccount,
  signIn,
  waitForBillingRecord,
} from './stripe-session';

const TIERS: readonly StripeTestTier[] = ['core', 'rhodium', 'iridium'];
const SUBSCRIPTION_DEADLINE_MS = 30_000;

/** Starts the app's own checkout and returns the hosted Stripe URL it redirects to. */
async function startCheckout(
  origin: string,
  cookie: string,
  tier: StripeTestTier,
): Promise<string> {
  const response = await fetch(`${origin}/billing/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, origin },
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

/** The hosted page puts the card form either on its main page (Managed Payments) or inside
 * an iframe (plain Checkout, Link). One candidate per live frame, so any layout works.
 * Every candidate resolves to a locator; presence is probed by count() in the helpers. */
function frameCandidates(
  page: Page,
  build: (frame: Frame) => Locator,
): Array<() => Promise<Locator>> {
  return page.frames().map((frame) => () => Promise.resolve(build(frame)));
}

/** The input names Stripe uses across its page variants, falling back to the accessible
 * label scoped to text inputs — decorative icons share the CVC label, and an unscoped
 * label match turns that shared name into an ambiguous two-element locator. */
function fieldIn(frame: Frame, names: readonly string[], label: RegExp): Locator {
  const byName = frame.locator(names.map((name) => `input[name="${name}"]`).join(', '));
  return byName.or(frame.getByRole('textbox', { name: label }));
}

/** Fills the first present candidate with the value. Names and labels drift over time. */
async function tryFill(candidates: Array<() => Promise<Locator>>, value: string): Promise<boolean> {
  for (const candidate of candidates) {
    const locator = await candidate();
    if ((await locator.count().catch(() => 0)) === 0) continue;
    if (
      await locator.fill(value).then(
        () => true,
        () => false,
      )
    )
      return true;
  }
  return false;
}

/** Types into the first present candidate, key by key: Stripe's card inputs are driven by
 * key events, so typing is what a real shopper's input looks like to them. */
async function tryType(candidates: Array<() => Promise<Locator>>, value: string): Promise<boolean> {
  for (const candidate of candidates) {
    const locator = await candidate();
    if ((await locator.count().catch(() => 0)) === 0) continue;
    if (
      await locator.pressSequentially(value, { delay: 40 }).then(
        () => true,
        () => false,
      )
    ) {
      return true;
    }
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
  // Whether the page's own confirm call fired. It separates a click that never submits
  // (a required field, or Managed Payments onboarding unfinished) from a payment Stripe
  // accepted but never finished, when a run has to fail.
  let confirmSent = false;
  // Everything the page says and every POST it sends, so a silent no-op names its cause.
  const consoleLines: string[] = [];
  const postLog: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    if (request.url().includes('/confirm')) confirmSent = true;
    postLog.push(request.url().slice(0, 120));
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLines.push(`${msg.type()}: ${msg.text().slice(0, 200)}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleLines.push(`pageerror: ${String(error.message).slice(0, 300)}`);
  });
  // Whether Link's save-info box was checked when Pay was clicked; checked, the click
  // opens Link's phone-verification flow instead of confirming the payment.
  let saveInfoChecked = false;
  // The submit button, never the "Pay with card"-style payment selectors above it.
  const payButton = page
    .getByRole('button', { name: /^(pay|subscribe|complete purchase|submit)\b(?! with\b)/i })
    .first();
  try {
    await page.goto(hostedUrl, { waitUntil: 'domcontentloaded' });

    await payButton.waitFor({ state: 'visible', timeout: 30_000 });

    // Managed Payments' own setup wizard asks to confirm the page sells through Link; that
    // branding is the only client-visible merchant-of-record signal, so a page without it
    // means the run just verified the wrong checkout shape.
    const pageText = (
      await Promise.all(
        page.frames().map((frame) =>
          frame
            .locator('body')
            .innerText()
            .catch(() => Promise.resolve('')),
        ),
      )
    ).join('\n');
    const soldThrough = /^.*sold through.*$/im.exec(pageText);
    if (!soldThrough) {
      console.error(`  page text at load: ${pageText.slice(0, 400)}`);
      die(
        'hosted page does not sell through Link — Managed Payments is not applied to this session',
      );
    }
    console.log(`  hosted page branding: ${soldThrough[0].trim()}`);

    await tryFill(
      frameCandidates(page, (frame) => fieldIn(frame, ['email'], /^Email/i)),
      email,
    );
    let cardFilled = await tryType(
      frameCandidates(page, (frame) =>
        fieldIn(frame, ['cardNumber', 'cardnumber'], /card number/i),
      ),
      '4242424242424242',
    );
    if (!cardFilled) {
      // The card iframe can attach a beat after the button; one retry before giving up.
      await page.waitForTimeout(2_000);
      cardFilled = await tryType(
        frameCandidates(page, (frame) =>
          fieldIn(frame, ['cardNumber', 'cardnumber'], /card number/i),
        ),
        '4242424242424242',
      );
    }
    if (!cardFilled) throw new Error('card number field not found');
    const expiryFilled = await tryType(
      frameCandidates(page, (frame) => fieldIn(frame, ['cardExpiry', 'exp-date'], /MM|expir/i)),
      '12/34',
    );
    if (!expiryFilled) throw new Error('card expiry field not found');
    const cvcFilled = await tryType(
      frameCandidates(page, (frame) => fieldIn(frame, ['cardCvc', 'cvc'], /cvc|security code/i)),
      '424',
    );
    if (!cvcFilled) throw new Error('card cvc field not found');
    // The postal code below is British: put the country in step first. A country change
    // re-renders the billing fields and clears a postal code filled before it, and the
    // page then refuses the submit silently on the empty required field. Skip the select
    // when the country already matches: even a no-op select fires a change event.
    for (const frame of page.frames()) {
      const country = frame
        .locator('select[name="billingCountry"]')
        .or(frame.getByRole('combobox', { name: /country/i }));
      if ((await country.count().catch(() => 0)) === 0) continue;
      const current = await country.inputValue().catch(() => '');
      if (current !== 'GB') await country.selectOption('GB').catch(() => {});
    }
    // Managed Payments also requires the cardholder name and billing postal code; plain
    // Checkout may not show either, so their absence is logged, not an error.
    const nameFilled = await tryFill(
      frameCandidates(page, (frame) =>
        fieldIn(frame, ['billingName', 'cardholderName'], /name on card|cardholder/i),
      ),
      'Stripe Test',
    );
    console.log(`  cardholder name ${nameFilled ? 'filled' : 'field not found'}`);
    const postalFilled = await tryFill(
      frameCandidates(page, (frame) =>
        fieldIn(frame, ['billingPostalCode', 'postal', 'postalCode'], /postal|zip|postcode/i),
      ),
      'SW1A 1AA',
    );
    console.log(`  postal code ${postalFilled ? 'filled' : 'field not found'}`);
    // The wizard's test step also mentions a phone number for Managed Payments payments;
    // fill one when the page asks so a required field never blocks the confirm call.
    await tryFill(
      frameCandidates(page, (frame) => fieldIn(frame, ['phone', 'billingPhone'], /phone/i)),
      '+442079460958',
    );
    // Never save the card into Link — a saved card would drag later runs into an
    // OTP-gated flow this script cannot complete.
    for (const frame of page.frames()) {
      const saveInfo = frame
        .locator('input[name="enableStripePass"]')
        .or(frame.getByRole('checkbox', { name: /save my information/i }));
      if ((await saveInfo.count().catch(() => 0)) > 0) {
        saveInfoChecked = await saveInfo.isChecked().catch(() => false);
        if (saveInfoChecked) await saveInfo.uncheck().catch(() => {});
      }
    }

    // Name the exact element the run is about to click, so a wrong-button click is visible.
    const buttonName = await payButton
      .evaluate((el) => `${el.tagName}: ${el.textContent?.trim() ?? ''}`)
      .catch(() => Promise.resolve('unreadable'));
    console.log(`  pay button resolved to: ${buttonName}`);
    // The confirm handler only engages once the page has digested the last input; give
    // Stripe's validation a beat before clicking, like a real shopper would.
    await page.waitForTimeout(5_000);
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
    console.error(`  page text at failure: ${text.slice(0, 1600)}`);
    const fieldErrors = await page
      .getByText(/incomplete|invalid|incorrect|declined|try again/i)
      .allInnerTexts()
      .catch((): string[] => []);
    console.error(`  field errors: ${JSON.stringify(fieldErrors)}`);
    // The values the key fields actually held, so a silently skipped or cleared required
    // field is visible even though input values never appear in page text.
    const probes: Array<[string, Locator]> = [
      ['email', fieldIn(page.mainFrame(), ['email'], /^Email/i)],
      ['card', fieldIn(page.mainFrame(), ['cardNumber', 'cardnumber'], /card number/i)],
      ['expiry', fieldIn(page.mainFrame(), ['cardExpiry', 'exp-date'], /MM|expir/i)],
      ['cvc', fieldIn(page.mainFrame(), ['cardCvc', 'cvc'], /cvc|security code/i)],
      [
        'name',
        fieldIn(page.mainFrame(), ['billingName', 'cardholderName'], /name on card|cardholder/i),
      ],
      [
        'postal',
        fieldIn(
          page.mainFrame(),
          ['billingPostalCode', 'postal', 'postalCode'],
          /postal|zip|postcode/i,
        ),
      ],
    ];
    const values = await Promise.all(
      probes.map(async ([key, locator]) => {
        const value = await locator.inputValue().catch(() => null);
        return [key, value] as const;
      }),
    );
    console.error(`  field values at failure: ${JSON.stringify(Object.fromEntries(values))}`);
    const payDisabled = await payButton.getAttribute('aria-disabled').catch(() => null);
    console.error(`  pay button aria-disabled at failure: ${payDisabled ?? '(unset)'}`);
    console.error(`  page console: ${consoleLines.slice(-10).join('\n    ') || '(nothing)'}`);
    console.error(`  page POSTs: ${postLog.slice(-10).join('\n    ') || '(none)'}`);
    die(
      `hosted checkout did not complete: ${error} — confirm request ${
        confirmSent ? 'sent' : 'never sent'
      } — save-info checkbox ${saveInfoChecked ? 'was on' : 'was off'} — screenshot saved to ${path}`,
    );
  } finally {
    await browser.close();
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
  await resetDisposableAccount(email);

  console.log(`→ signing in over the real OTP flow at ${origin}`);
  const { userId, cookie } = await signIn(origin, email);

  console.log(`→ starting ${tier} checkout through the app`);
  const hostedUrl = await startCheckout(origin, cookie, tier);

  console.log('→ completing the hosted Test Mode checkout with the test card');
  await completeHostedCheckout(hostedUrl, email, origin);

  console.log('→ waiting for the billing webhook to deliver the subscription');
  const subscription = await waitForBillingRecord(
    userId,
    (record) => record !== null,
    SUBSCRIPTION_DEADLINE_MS,
  );
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
