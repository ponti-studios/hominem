/**
 * The pay surface and Stripe's subscription webhook. A person reaches /billing from the app; the
 * page names the four tiers, starts a Checkout, and offers a downgrade or a cancellation to anyone
 * already paying. Stripe's webhook is the only writer of account state (docs/billing.md).
 */
import { FOUNDING_SEATS } from '@hominem/db/billing';
import { logger } from '@hominem/telemetry';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

import { TIER_PRICES_PENCE, type BillingTier, type Plan } from '../../application/billing';
import { billingDeps, billingWebhookSecret } from '../../application/billing.runtime';
import {
  billingState,
  cancelPlan,
  changePlan,
  handleBillingEvent,
  startSubscriptionCheckout,
  type BillingDeps,
  type BillingState,
} from '../../application/billing.service';
import { verifyStripeSignature } from '../../application/stripe';
import { env } from '../../env';
import type { AppEnv } from '../../server';

export const billingRoutes = new Hono<AppEnv>();

const PLAN_NAMES: Record<Plan, string> = {
  taster: 'Taster',
  core: 'Core',
  ai: 'AI',
  founding_core: 'Founding Core',
};

function originFor(c: Context): string {
  const url = new URL(env.API_URL);
  const requestUrl = new URL(c.req.url);
  url.hostname = requestUrl.hostname;
  url.port = requestUrl.port;
  return url.origin;
}

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function dateLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const STYLES = `
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; background: #f6f5f2; color: #191817; }
  main { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; }
  h1 { font-size: 32px; letter-spacing: -0.02em; margin: 0 0 8px; }
  h2 { font-size: 18px; margin: 0 0 12px; }
  p { line-height: 1.5; }
  .lede { color: #5b5751; margin: 0 0 32px; }
  .current { background: #fff; border: 1px solid #e4e0d9; border-radius: 14px; padding: 20px; margin-bottom: 32px; }
  .usage { color: #5b5751; font-size: 14px; margin: 4px 0 0; }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
  .card { background: #fff; border: 1px solid #e4e0d9; border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
  .card.current-plan { border-color: #191817; }
  .price { font-size: 26px; font-weight: 650; letter-spacing: -0.02em; margin: 0; }
  .meta { color: #5b5751; font-size: 13px; margin: 0; flex: 1; }
  .tag { align-self: flex-start; background: #191817; color: #fff; border-radius: 999px; font-size: 11px; padding: 3px 9px; text-transform: uppercase; letter-spacing: 0.06em; }
  button { font: inherit; font-weight: 600; cursor: pointer; border-radius: 10px; border: 1px solid #191817; background: #191817; color: #fff; padding: 10px 14px; }
  button.secondary { background: transparent; color: #191817; }
  form.inline { margin: 0; }
  .note { color: #5b5751; font-size: 13px; margin-top: 24px; }
  a { color: inherit; }
  body:has(.billing-done) { background: #fff; color: #0a0a0a; }
  main:has(.billing-done) { box-sizing: border-box; width: min(100%, 1040px); max-width: none; min-height: 100svh; padding: 32px 24px; }
  .billing-done { min-height: calc(100svh - 64px); display: flex; flex-direction: column; color: #0a0a0a; font-family: 'Hanken Grotesk', Arial, sans-serif; }
  .billing-done__header, .billing-done__footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .billing-done__header { border-bottom: 1px solid #e0e0e0; padding-bottom: 18px; }
  .billing-done__wordmark, .billing-done__meta, .billing-done__eyebrow, .billing-done__button, .billing-done__footer { font-family: 'JetBrains Mono', ui-monospace, monospace; text-transform: uppercase; }
  .billing-done__wordmark { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; }
  .billing-done__meta, .billing-done__footer { color: #737373; font-size: 10px; letter-spacing: 0.1em; }
  .billing-done__content { width: min(100%, 600px); margin: auto; padding: 72px 0; }
  .billing-done__eyebrow { display: flex; align-items: center; gap: 12px; margin: 0 0 28px; font-size: 11px; letter-spacing: 0.12em; }
  .billing-done__mark { display: grid; width: 44px; height: 44px; place-items: center; background: #0a0a0a; color: #fff; font-size: 21px; }
  .billing-done h1 { max-width: 560px; margin: 0; font-size: clamp(48px, 8vw, 76px); font-weight: 500; letter-spacing: -0.065em; line-height: 0.98; }
  .billing-done__copy { max-width: 430px; margin: 24px 0 32px; color: #5c5c5c; font-size: 17px; line-height: 1.55; }
  .billing-done__button { display: inline-flex; min-height: 48px; align-items: center; gap: 24px; padding: 0 18px; background: #0a0a0a; color: #fff; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; transition: background 150ms ease; }
  .billing-done__button:hover { background: #333; }
  .billing-done__footer { justify-content: flex-start; border-top: 1px solid #e0e0e0; padding-top: 16px; }
  @media (max-width: 520px) { main:has(.billing-done) { padding: 24px 20px; } .billing-done { min-height: calc(100svh - 48px); } .billing-done__content { padding: 52px 0; } .billing-done__meta { font-size: 9px; } }
  @media (prefers-reduced-motion: reduce) { .billing-done__button { transition: none; } }
`;

function page(title: string, body: string, head = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>${head}<style>${STYLES}</style></head><body><main>${body}</main></body></html>`;
}

function subscribeForm(tier: BillingTier, label: string, secondary = false): string {
  return `<form class="inline" method="post" action="/billing/checkout"><input type="hidden" name="tier" value="${tier}"><button${secondary ? ' class="secondary"' : ''} type="submit">${label}</button></form>`;
}

function actionForm(action: string, label: string, secondary = false, tier?: BillingTier): string {
  return `<form class="inline" method="post" action="${action}">${
    tier ? `<input type="hidden" name="tier" value="${tier}">` : ''
  }<button${secondary ? ' class="secondary"' : ''} type="submit">${label}</button></form>`;
}

function planCard(input: {
  name: string;
  price: string;
  meta: string;
  current: boolean;
  action: string;
  tag?: string;
}): string {
  return `<section class="card${input.current ? ' current-plan' : ''}">
    ${input.tag ? `<span class="tag">${escapeHtml(input.tag)}</span>` : ''}
    <h2>${escapeHtml(input.name)}</h2>
    <p class="price">${input.price}</p>
    <p class="meta">${input.meta}</p>
    ${input.action}
  </section>`;
}

function billingPage(input: { state: BillingState; name: string; foundingLeft: number }): string {
  const { state } = input;
  const plan = state.plan;
  const planName = PLAN_NAMES[plan];
  const paid = plan !== 'taster';
  const subscription = state.subscription;
  const renews = dateLabel(subscription?.currentPeriodEnd);

  const status = `<section class="current">
    <h2>${escapeHtml(planName)} plan</h2>
    <p class="usage">${state.usage.chatMessages} of ${state.limits.chatMessagesPerMonth} messages this month${
      state.limits.skillCallsPerMonth === null
        ? ' · skills uncapped'
        : ` · ${state.usage.skillCalls} of ${state.limits.skillCallsPerMonth} skill calls`
    }</p>
    ${
      subscription
        ? `<p class="usage">${
            subscription.cancelAtPeriodEnd
              ? `Cancelled — access ends ${escapeHtml(renews)}.`
              : `Renews ${escapeHtml(renews)}.`
          } ${pounds(subscription.pricePence)} per month${
            subscription.founding ? ' · founding price locked' : ''
          }.</p>`
        : `<p class="usage">Free tier. Subscribe to keep your full skills and more conversation.</p>`
    }
  </section>`;

  const corePrice = pounds(TIER_PRICES_PENCE.core);
  const aiPrice = pounds(TIER_PRICES_PENCE.ai);
  const foundingPrice = pounds(TIER_PRICES_PENCE.founding_core);

  const cards: string[] = [];
  if (!paid) {
    cards.push(
      planCard({
        name: 'Taster',
        price: '£0',
        meta: `Try every skill, up to ${state.limits.chatMessagesPerMonth} messages and ${state.limits.skillCallsPerMonth ?? 'unlimited'} skill calls a month.`,
        current: plan === 'taster',
        action: `<p class="meta">Your current plan.</p>`,
      }),
    );
  }
  const coreSwitchPrice = subscription?.founding ? foundingPrice : corePrice;
  if (input.foundingLeft > 0 && !paid) {
    cards.push(
      planCard({
        name: 'Founding Core',
        price: `${foundingPrice}<span style="font-size:13px;font-weight:400">/mo</span>`,
        meta: `All skills, unlimited. ${input.foundingLeft} of ${FOUNDING_SEATS} founding seats left; the price never rises while you stay subscribed.`,
        current: false,
        action: subscribeForm('core', 'Subscribe'),
      }),
    );
  }
  if (plan !== 'core' && plan !== 'founding_core') {
    cards.push(
      planCard({
        name: 'Core',
        price: `${corePrice}<span style="font-size:13px;font-weight:400">/mo</span>`,
        meta: 'All skills, unlimited. For the everyday work of keeping your life in one place.',
        current: false,
        action: paid
          ? actionForm('/billing/change', `Switch to Core at ${coreSwitchPrice}/mo`, true, 'core')
          : subscribeForm('core', 'Subscribe'),
      }),
    );
  }
  cards.push(
    planCard({
      name: 'AI',
      price: `${aiPrice}<span style="font-size:13px;font-weight:400">/mo</span>`,
      meta: `All skills plus the longest conversation: up to ${env.BILLING_AI_CHAT_MESSAGES} messages a month.`,
      current: plan === 'ai',
      action:
        plan === 'ai'
          ? `<p class="meta">Your current plan.</p>`
          : paid
            ? actionForm('/billing/change', `Switch to AI at ${aiPrice}/mo`, false, 'ai')
            : subscribeForm('ai', 'Subscribe'),
    }),
  );

  const paidActions =
    paid && !subscription?.cancelAtPeriodEnd
      ? `<section class="current"><h2>Manage</h2>
          ${actionForm('/billing/cancel', 'Cancel at the end of this period', true)}
        </section>`
      : '';

  return page(
    'Plan | Hominem',
    `<h1>Choose your plan</h1>
     <p class="lede">Every tier uses every skill. Plans differ in how much you use, never in which parts of Hominem you can reach.</p>
     ${status}
     <div class="grid">${cards.join('')}</div>
     ${paidActions}
     <p class="note">Payments and receipts are handled by Stripe. Prices are in pounds and renew monthly until you cancel. ${escapeHtml(input.name ? `Signed in as ${input.name}.` : '')}</p>`,
  );
}

function messagePage(title: string, heading: string, body: string): string {
  return page(
    title,
    `<h1>${escapeHtml(heading)}</h1><p class="lede">${body}</p><p><a href="/billing">Back to plans</a></p>`,
  );
}

function requireDeps(c: Context): { deps: BillingDeps } | { response: Response } {
  const deps = billingDeps();
  if (deps) return { deps };
  return {
    response: c.html(
      messagePage(
        'Plans unavailable | Hominem',
        'Plans are unavailable',
        'Billing is not configured right now. Try again later.',
      ),
      503,
    ),
  };
}

function authOrRedirect(
  c: Context,
): { userId: string; email: string; name: string } | { response: Response } {
  const auth = c.get('auth');
  if (!auth) {
    const target = new URL('/billing', originFor(c)).toString();
    const login = new URL('/login', env.API_URL);
    login.searchParams.set('next', target);
    login.searchParams.set('step', 'email');
    return { response: c.redirect(login.toString(), 303) };
  }
  return {
    userId: auth.userId,
    email: auth.user.email,
    name: auth.user.name ?? '',
  };
}

billingRoutes.get('/billing', async (c) => {
  const who = authOrRedirect(c);
  if ('response' in who) return who.response;
  const deps = requireDeps(c);
  if ('response' in deps) return deps.response;
  try {
    const [state, foundingUsed] = await Promise.all([
      billingState(deps.deps, who.userId),
      deps.deps.store.countFoundingSeats(),
    ]);
    c.header('Cache-Control', 'no-store');
    return c.html(
      billingPage({
        state,
        name: who.name,
        foundingLeft: Math.max(0, FOUNDING_SEATS - foundingUsed),
      }),
    );
  } catch (error) {
    logger.error('billing_page_failed', {
      operation: 'billing.page',
      failureType: 'billing.page.failed',
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return c.html(
      messagePage(
        'Plans unavailable | Hominem',
        'Plans are unavailable',
        'Something went wrong. Try again in a moment.',
      ),
      503,
    );
  }
});

billingRoutes.post('/billing/checkout', async (c) => {
  const who = authOrRedirect(c);
  if ('response' in who) return who.response;
  const deps = requireDeps(c);
  if ('response' in deps) return deps.response;
  const tier = (await c.req.parseBody()).tier;
  if (tier !== 'core' && tier !== 'ai') return c.text('Bad Request', 400);
  try {
    const outcome = await startSubscriptionCheckout(deps.deps, {
      userId: who.userId,
      email: who.email,
      tier,
      origin: originFor(c),
    });
    if (outcome.kind === 'already_subscribed') {
      return c.html(
        messagePage(
          'Already subscribed | Hominem',
          'You already have a plan',
          'Change or cancel your current subscription below.',
        ),
        409,
      );
    }
    return c.redirect(outcome.url, 303);
  } catch (error) {
    logger.error('billing_checkout_failed', {
      operation: 'billing.checkout',
      failureType: 'billing.checkout.failed',
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return c.html(
      messagePage(
        'Checkout unavailable | Hominem',
        'Checkout is unavailable',
        'Something went wrong. Try again in a moment.',
      ),
      503,
    );
  }
});

billingRoutes.post('/billing/change', async (c) => {
  const who = authOrRedirect(c);
  if ('response' in who) return who.response;
  const deps = requireDeps(c);
  if ('response' in deps) return deps.response;
  const tier = (await c.req.parseBody()).tier;
  const wanted = tier === 'ai' || tier === 'core' ? tier : null;
  if (!wanted) return c.text('Bad Request', 400);
  try {
    await changePlan(deps.deps, who.userId, wanted);
    return c.redirect('/billing', 303);
  } catch (error) {
    logger.error('billing_change_failed', {
      operation: 'billing.change',
      failureType: 'billing.change.failed',
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return c.text('Could not change the plan.', 400);
  }
});

billingRoutes.post('/billing/cancel', async (c) => {
  const who = authOrRedirect(c);
  if ('response' in who) return who.response;
  const deps = requireDeps(c);
  if ('response' in deps) return deps.response;
  try {
    await cancelPlan(deps.deps, who.userId);
    return c.redirect('/billing', 303);
  } catch (error) {
    logger.error('billing_cancel_failed', {
      operation: 'billing.cancel',
      failureType: 'billing.cancel.failed',
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return c.text('Could not cancel the subscription.', 400);
  }
});

billingRoutes.get('/billing/done', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.html(
    page(
      'Checkout complete | Hominem',
      `<section class="billing-done" aria-labelledby="billing-done-title">
        <header class="billing-done__header">
          <span class="billing-done__wordmark">Hominem</span>
          <span class="billing-done__meta">Account / Billing</span>
        </header>
        <div class="billing-done__content">
          <p class="billing-done__eyebrow"><span class="billing-done__mark" aria-hidden="true">✓</span> Checkout complete</p>
          <h1 id="billing-done-title">You’re all set.</h1>
          <p class="billing-done__copy">Checkout is complete. Your Hominem account is updating now, and Stripe will email your receipt.</p>
          <a class="billing-done__button" href="/billing">Return to plans <span aria-hidden="true">↗</span></a>
        </div>
        <footer class="billing-done__footer"><span>Hominem</span><span aria-hidden="true">/</span><span>Billing</span></footer>
      </section>`,
      `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap">`,
    ),
  );
});

billingRoutes.get('/billing/cancelled', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.html(
    messagePage(
      'Checkout cancelled | Hominem',
      'Nothing was charged',
      'You can start again whenever you are ready.',
    ),
  );
});

const stripeEventSchema = z.object({
  type: z.string().min(1),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

// Stripe calls this after a subscription changes. The body's bytes are what the signature covers.
billingRoutes.post('/webhooks/stripe/billing', async (c) => {
  const secret = billingWebhookSecret();
  const deps = billingDeps();
  if (!secret || !deps) return c.json({ error: 'unavailable' }, 503);

  const raw = await c.req.text();
  if (!verifyStripeSignature(raw, c.req.header('stripe-signature'), secret, new Date())) {
    return c.json({ error: 'bad_signature' }, 400);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return c.json({ error: 'bad_request' }, 400);
  }
  const event = stripeEventSchema.safeParse(parsed);
  if (!event.success) return c.json({ received: true });

  try {
    const outcome = await handleBillingEvent(deps, event.data);
    logger.info('billing_webhook', { outcome: outcome.kind });
    return c.json({ received: true });
  } catch (error) {
    // A 5xx makes Stripe retry; the store's upsert makes a repeat safe.
    logger.error('billing_webhook_failed', {
      operation: 'billing.webhook',
      failureType: 'billing.webhook.failed',
      retryable: true,
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return c.json({ error: 'failed' }, 500);
  }
});
