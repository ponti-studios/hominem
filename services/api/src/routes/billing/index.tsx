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
  body:has(.billing-page) { background: #fff; color: #0a0a0a; }
  main:has(.billing-page) { box-sizing: border-box; width: min(100%, 1240px); max-width: none; min-height: 100svh; padding: 32px 24px 48px; font-family: 'Hanken Grotesk', Arial, sans-serif; }
  .billing-page { min-height: calc(100svh - 80px); color: #0a0a0a; }
  .billing-page__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e0e0e0; padding-bottom: 18px; }
  .billing-page__wordmark, .billing-page__meta, .billing-page__eyebrow, .billing-page__label { font-family: 'JetBrains Mono', ui-monospace, monospace; text-transform: uppercase; }
  .billing-page__wordmark { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; }
  .billing-page__meta, .billing-page__label { color: #737373; font-size: 10px; letter-spacing: 0.1em; }
  .billing-page__hero { margin: 64px 0 36px; }
  .billing-page__eyebrow { margin: 0 0 20px; color: #5c5c5c; font-size: 11px; letter-spacing: 0.12em; }
  .billing-page h1 { max-width: 700px; margin: 0; font-size: clamp(48px, 7vw, 76px); font-weight: 500; letter-spacing: -0.065em; line-height: 0.98; }
  .billing-page__lede { max-width: 650px; margin: 20px 0 0; color: #5c5c5c; font-size: 17px; line-height: 1.55; }
  .billing-page .current { display: grid; grid-template-columns: minmax(160px, 0.7fr) minmax(0, 1.3fr); gap: 24px; align-items: center; margin: 0 0 32px; padding: 20px 0; border: 0; border-top: 1px solid #0a0a0a; border-bottom: 1px solid #e0e0e0; border-radius: 0; background: #fff; }
  .billing-page .current h2 { margin: 6px 0 0; font-size: 24px; font-weight: 500; letter-spacing: -0.03em; }
  .billing-page .current .usage { margin: 0; color: #5c5c5c; font-size: 14px; }
  .billing-page .current .usage + .usage { margin-top: 6px; }
  .billing-page__usage { margin: 0 0 36px; }
  .billing-page__usage-header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
  .billing-page__usage-title { margin: 0; font-size: 22px; font-weight: 500; letter-spacing: -0.04em; }
  .billing-page__usage-reset { margin: 0; color: #5c5c5c; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
  .billing-page__usage-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(220px, 0.65fr); gap: 12px; }
  .billing-page__usage-card { display: flex; min-height: 150px; flex-direction: column; justify-content: space-between; gap: 22px; padding: 22px; border: 1px solid #e0e0e0; background: #f5f5f5; }
  .billing-page__usage-card--mcp { background: #0a0a0a; color: #fff; }
  .billing-page__usage-card-top { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
  .billing-page__usage-label { margin: 0; color: #5c5c5c; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
  .billing-page__usage-card--mcp .billing-page__usage-label { color: #bdbdbd; }
  .billing-page__usage-count { margin: 14px 0 0; font-size: clamp(48px, 7vw, 72px); font-variant-numeric: tabular-nums; font-weight: 500; letter-spacing: -0.08em; line-height: 0.9; }
  .billing-page__usage-limit { margin: 0; color: #5c5c5c; font-size: 13px; text-align: right; }
  .billing-page__usage-card--mcp .billing-page__usage-limit { color: #bdbdbd; }
  .billing-page__usage-meter { display: block; width: 100%; height: 10px; appearance: none; border: 0; border-radius: 0; background: #737373; }
  .billing-page__usage-meter::-webkit-progress-bar { background: #737373; }
  .billing-page__usage-meter::-webkit-progress-value { background: #0a0a0a; }
  .billing-page__usage-meter::-moz-progress-bar { background: #0a0a0a; }
  .billing-page__usage-card--mcp .billing-page__usage-meter { background: #737373; }
  .billing-page__usage-card--mcp .billing-page__usage-meter::-webkit-progress-bar { background: #737373; }
  .billing-page__usage-card--mcp .billing-page__usage-meter::-webkit-progress-value,
  .billing-page__usage-card--mcp .billing-page__usage-meter::-moz-progress-bar { background: #fff; }
  .billing-page__usage-detail { display: flex; justify-content: space-between; gap: 12px; margin: 8px 0 0; color: #5c5c5c; font-size: 12px; }
  .billing-page__usage-card--mcp .billing-page__usage-detail { color: #bdbdbd; }
  .billing-page .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; }
  .billing-page .card { display: flex; min-height: 200px; flex-direction: column; gap: 14px; padding: 20px; border: 1px solid #e0e0e0; background: #fff; }
  .billing-page .card:only-child { max-width: 500px; }
  .billing-page .card.current-plan { border-color: #0a0a0a; }
  .billing-page .card h2 { margin: 0; font-size: 19px; font-weight: 500; letter-spacing: -0.02em; }
  .billing-page .price { margin: 0; font-size: 34px; font-weight: 500; letter-spacing: -0.05em; line-height: 1; }
  .billing-page .price-period { color: #737373; font-size: 12px; font-weight: 400; letter-spacing: 0; }
  .billing-page .meta { flex: 1; margin: 0; color: #5c5c5c; font-size: 13px; line-height: 1.5; }
  .billing-page button { min-height: 44px; padding: 0 14px; border: 1px solid #0a0a0a; border-radius: 0; background: #0a0a0a; color: #fff; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
  .billing-page button:hover { background: #333; }
  .billing-page button.secondary { background: #fff; color: #0a0a0a; }
  .billing-page button.secondary:hover { background: #f4f4f4; }
  .billing-page .card .inline { margin: 0; }
  .billing-page .card .inline button { width: 100%; }
  .billing-page .billing-manage { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 32px; padding: 18px 0; border-top: 1px solid #e0e0e0; border-bottom: 1px solid #e0e0e0; }
  .billing-page .billing-manage h2 { margin: 0; font-size: 16px; font-weight: 500; }
  .billing-page .billing-manage .inline { margin: 0; }
  .billing-page .billing-page__note { margin: 24px 0 0; color: #737373; font-size: 12px; line-height: 1.6; }
  @media (max-width: 620px) { main:has(.billing-page) { padding: 24px 20px 32px; } .billing-page { min-height: calc(100svh - 56px); } .billing-page__hero { margin: 48px 0 28px; } .billing-page .current { grid-template-columns: 1fr; gap: 10px; } .billing-page__usage-grid { grid-template-columns: 1fr; } .billing-page__usage-header { align-items: start; flex-direction: column; gap: 6px; } .billing-page .card { min-height: 200px; } .billing-page .billing-manage { align-items: flex-start; flex-direction: column; } }
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
  body:has(.billing-error) { background: #fff; color: #0a0a0a; }
  main:has(.billing-error) { box-sizing: border-box; width: min(100%, 1040px); max-width: none; min-height: 100svh; padding: 32px 24px; }
  .billing-error { min-height: calc(100svh - 64px); display: flex; flex-direction: column; color: #0a0a0a; font-family: 'Hanken Grotesk', Arial, sans-serif; }
  .billing-error__header, .billing-error__footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .billing-error__header { border-bottom: 1px solid #e0e0e0; padding-bottom: 18px; }
  .billing-error__wordmark, .billing-error__meta, .billing-error__eyebrow, .billing-error__button, .billing-error__footer { font-family: 'JetBrains Mono', ui-monospace, monospace; text-transform: uppercase; }
  .billing-error__wordmark { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; }
  .billing-error__meta, .billing-error__footer { color: #737373; font-size: 10px; letter-spacing: 0.1em; }
  .billing-error__content { width: min(100%, 600px); margin: auto; padding: 72px 0; }
  .billing-error__eyebrow { display: flex; align-items: center; gap: 12px; margin: 0 0 28px; color: #5c5c5c; font-size: 11px; letter-spacing: 0.12em; }
  .billing-error__mark { display: grid; width: 44px; height: 44px; place-items: center; background: #0a0a0a; color: #fff; font-size: 21px; }
  .billing-error h1 { max-width: 560px; margin: 0; font-size: clamp(48px, 8vw, 76px); font-weight: 500; letter-spacing: -0.065em; line-height: 0.98; }
  .billing-error__copy { max-width: 430px; margin: 24px 0 32px; color: #5c5c5c; font-size: 17px; line-height: 1.55; }
  .billing-error__button { display: inline-flex; min-height: 48px; align-items: center; gap: 24px; padding: 0 18px; background: #0a0a0a; color: #fff; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; transition: background 150ms ease; }
  .billing-error__button:hover { background: #333; }
  .billing-error__button:focus-visible { outline: 2px solid #0a0a0a; outline-offset: 4px; }
  .billing-error__footer { justify-content: flex-start; border-top: 1px solid #e0e0e0; padding-top: 16px; }
  @media (max-width: 520px) { main:has(.billing-error) { padding: 24px 20px; } .billing-error { min-height: calc(100svh - 48px); } .billing-error__content { padding: 52px 0; } .billing-error__meta { font-size: 9px; } }
  @media (prefers-reduced-motion: reduce) { .billing-error__button { transition: none; } }
`;

function page(title: string, body: string, head = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>${head}<style>${STYLES}</style></head><body><main>${body}</main></body></html>`;
}

const BRAND_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap">`;

function billingChangeErrorPage(): string {
  return page(
    'Plan change unavailable | Hominem',
    `<section class="billing-error" aria-labelledby="billing-error-title">
       <header class="billing-error__header"><span class="billing-error__wordmark">Hominem</span><span class="billing-error__meta">Account / Billing</span></header>
       <div class="billing-error__content" role="alert">
         <p class="billing-error__eyebrow"><span class="billing-error__mark" aria-hidden="true">!</span> Billing / Update</p>
         <h1 id="billing-error-title">Could not change the plan.</h1>
         <p class="billing-error__copy">The plan change didn’t complete. You can return to billing and try again.</p>
         <a class="billing-error__button" href="/billing">Back to billing <span aria-hidden="true">↗</span></a>
       </div>
       <footer class="billing-error__footer"><span>Hominem</span><span aria-hidden="true">/</span><span>Billing</span></footer>
     </section>`,
    BRAND_FONTS,
  );
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

function usageCard(input: {
  label: string;
  used: number;
  limit: number | null;
  featured?: boolean;
}): string {
  const percent =
    input.limit === null ? null : Math.min(100, Math.round((input.used / input.limit) * 100));
  const value = input.limit === null ? input.used : Math.min(input.used, input.limit);
  return `<article class="billing-page__usage-card${input.featured ? ' billing-page__usage-card--mcp' : ''}" aria-label="${escapeHtml(input.label)} usage">
    <div class="billing-page__usage-card-top"><div><p class="billing-page__usage-label">${escapeHtml(input.label)}</p><p class="billing-page__usage-count">${input.used.toLocaleString('en-GB')}</p></div>
      <p class="billing-page__usage-limit">${input.limit === null ? 'No monthly cap' : `of ${input.limit.toLocaleString('en-GB')} this month`}</p>
    </div>
    ${input.limit === null ? '<p class="billing-page__usage-detail"><span>Every MCP tool invocation uses one call.</span><span>Uncapped</span></p>' : `<div><progress class="billing-page__usage-meter" max="${input.limit}" value="${value}" aria-label="${escapeHtml(input.label)} usage"></progress><p class="billing-page__usage-detail"><span>${percent}% of monthly limit</span><span>${(input.limit - value).toLocaleString('en-GB')} remaining</span></p></div>`}
  </article>`;
}

function usageResetLabel(periodStart: string): string {
  const reset = new Date(periodStart);
  reset.setUTCMonth(reset.getUTCMonth() + 1);
  return `Resets ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(reset)} · UTC`;
}

function billingPage(input: { state: BillingState; name: string; foundingLeft: number }): string {
  const { state } = input;
  const plan = state.plan;
  const planName = PLAN_NAMES[plan];
  const paid = plan !== 'taster';
  const subscription = state.subscription;
  const renews = dateLabel(subscription?.currentPeriodEnd);

  const status = `<section class="current" aria-label="Current plan">
    <div><span class="billing-page__label">Current plan</span><h2>${escapeHtml(planName)}</h2></div>
    <div>${
      subscription
        ? `<p class="usage">${
            subscription.cancelAtPeriodEnd
              ? `Cancelled — access ends ${escapeHtml(renews)}.`
              : `Renews ${escapeHtml(renews)}.`
          } ${pounds(subscription.pricePence)} per month${
            subscription.founding ? ' · founding price locked' : ''
          }.</p>`
        : `<p class="usage">Free tier. Subscribe to keep your full skills and more conversation.</p>`
    }</div>
  </section>`;
  const usage = `<section class="billing-page__usage" aria-labelledby="billing-usage-title">
    <header class="billing-page__usage-header"><h2 class="billing-page__usage-title" id="billing-usage-title">Usage this month</h2><p class="billing-page__usage-reset">${usageResetLabel(state.periodStart)}</p></header>
    <div class="billing-page__usage-grid">
      ${usageCard({ label: 'MCP tool calls', used: state.usage.skillCalls, limit: state.limits.skillCallsPerMonth, featured: true })}
      ${usageCard({ label: 'Messages', used: state.usage.chatMessages, limit: state.limits.chatMessagesPerMonth })}
    </div>
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
        meta: `Try every skill, up to ${state.limits.chatMessagesPerMonth} messages and ${state.limits.skillCallsPerMonth ?? 'unlimited'} MCP tool calls a month.`,
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
        price: `${foundingPrice}<span class="price-period">/mo</span>`,
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
        price: `${corePrice}<span class="price-period">/mo</span>`,
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
      price: `${aiPrice}<span class="price-period">/mo</span>`,
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
      ? `<section class="billing-manage"><h2>Manage subscription</h2>
          ${actionForm('/billing/cancel', 'Cancel at the end of this period', true)}
        </section>`
      : '';

  return page(
    'Plan | Hominem',
    `<section class="billing-page" aria-labelledby="billing-title">
       <header class="billing-page__header"><span class="billing-page__wordmark">Hominem</span><span class="billing-page__meta">Account / Billing</span></header>
       <div class="billing-page__hero"><p class="billing-page__eyebrow">Plans / Monthly</p><h1 id="billing-title">Choose your plan.</h1><p class="billing-page__lede">Every tier uses every skill. Plans differ in how much you use, never in which parts of Hominem you can reach.</p></div>
       ${status}
       ${usage}
       <div class="grid">${cards.join('')}</div>
       ${paidActions}
       <p class="billing-page__note">Payments and receipts are handled by Stripe. Prices are in pounds and renew monthly until you cancel. ${escapeHtml(input.name ? `Signed in as ${input.name}.` : '')}</p>
     </section>`,
    BRAND_FONTS,
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
    return c.html(billingChangeErrorPage(), 400);
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
      BRAND_FONTS,
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
