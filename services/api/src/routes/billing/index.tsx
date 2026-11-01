/**
 * The pay surface and Stripe's subscription webhook. A person reaches /billing from the app; the
 * page offers Taster, Core, Rhodium, and Iridium, starts a Checkout, and lets subscribers change or
 * cancel. Stripe's
 * webhook is the only writer of account state (docs/billing.md).
 */
import { logger } from '@hominem/telemetry';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

import { getMonthlyUsageStatus } from '../../application/ai-usage.service';
import { TIER_PRICES_PENCE, type BillingTier, type Plan } from '../../application/billing';
import { billingDeps, billingRules, billingWebhookSecret } from '../../application/billing.runtime';
import {
  billingState,
  cancelPlan,
  changePlan,
  handleBillingEvent,
  startSubscriptionCheckout,
  type BillingDeps,
  type BillingState,
} from '../../application/billing.service';
import {
  isManagedPaymentsTaxCountry,
  MANAGED_PAYMENTS_TAX_COUNTRIES,
} from '../../application/managed-payments-tax-countries';
import { verifyStripeSignature } from '../../application/stripe';
import { env } from '../../env';
import type { AppEnv } from '../../server';

export const billingRoutes = new Hono<AppEnv>();

const PLAN_NAMES: Record<Plan, string> = {
  taster: 'Taster',
  core: 'Core',
  ai: 'AI',
  founding_core: 'Founding Core',
  rhodium: 'Rhodium',
  iridium: 'Iridium',
  osmium: 'Osmium',
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

function formatTokens(tokens: number): string {
  return tokens >= 1_000_000 ? `${tokens / 1_000_000}M` : tokens.toLocaleString('en-GB');
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
  .account-nav { display:flex; flex-wrap:wrap; gap:8px 24px; padding:18px 0; border-bottom:1px solid #e0e0e0; }
  .account-nav a { color:#737373; font: 10px 'JetBrains Mono', ui-monospace, monospace; letter-spacing:.08em; text-decoration:none; text-transform:uppercase; }
  .account-nav a[aria-current='page'] { color:#0a0a0a; text-decoration:underline; text-underline-offset:5px; }
  .billing-page__wordmark, .billing-page__meta { font-family: 'JetBrains Mono', ui-monospace, monospace; text-transform: uppercase; }
  .billing-page__wordmark { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; }
  .billing-page__meta { color: #737373; font-size: 10px; letter-spacing: 0.1em; }
  .billing-page__hero { margin: 64px 0 36px; }
  .billing-page h1 { max-width: 700px; margin: 0; font-size: clamp(48px, 7vw, 76px); font-weight: 500; letter-spacing: -0.065em; line-height: 0.98; }
  .billing-page__usage { margin: 0 0 36px; }
  .billing-page__usage-header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
  .billing-page__usage-title { margin: 0; font-size: 22px; font-weight: 500; letter-spacing: -0.04em; }
  .billing-page__usage-reset { margin: 0; color: #5c5c5c; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
  .billing-page__usage-grid { display: grid; gap: 0; padding: 4px 24px; border: 1px solid #e0e0e0; background: #f5f5f5; }
  .billing-page__usage-card { display: flex; flex-direction: column; gap: 12px; padding: 20px 0; }
  .billing-page__usage-card + .billing-page__usage-card { border-top: 1px solid #d5d5d5; }
  .billing-page__usage-card-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .billing-page__usage-reading { display: flex; align-items: baseline; justify-content: flex-end; gap: 8px; }
  .billing-page__usage-label { margin: 0; color: #5c5c5c; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
  .billing-page__usage-count { margin: 0; font-size: clamp(32px, 5vw, 44px); font-variant-numeric: tabular-nums; font-weight: 500; letter-spacing: -0.07em; line-height: 1; }
  .billing-page__usage-limit { margin: 0; color: #5c5c5c; font-size: 24px; font-variant-numeric: tabular-nums; }
  .billing-page__usage-slash { color: #737373; font-size: 18px; }
  .billing-page__usage-meter { display: block; width: 100%; height: 8px; appearance: none; overflow: clip; border: 0 solid; border-radius: 0; background: #d0d0d0; }
  .billing-page__usage-meter::-webkit-progress-bar { background: #d0d0d0; }
  .billing-page__usage-meter::-webkit-progress-value { background: #0a0a0a; }
  .billing-page__usage-meter::-moz-progress-bar { background: #0a0a0a; }
  .billing-page__usage-card--ai { gap: 16px; padding: 28px 0 26px; }
  .billing-page__usage-card--ai .billing-page__usage-label { font-size: 11px; }
  .billing-page__usage-card--ai .billing-page__usage-count { font-size: clamp(48px, 7vw, 68px); letter-spacing: -0.065em; }
  .billing-page__usage-card--ai .billing-page__usage-foot { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
  .billing-page__usage-card--ai .billing-page__usage-detail { margin: 0; color: #5c5c5c; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
  .billing-page__usage-card--ai .billing-page__usage-detail:last-child { text-align: right; }
  .billing-page__usage-card--ai .billing-page__usage-explainer { margin: 0; color: #5c5c5c; font-size: 13px; line-height: 1.5; }
  .billing-page__usage-card--mcp { padding: 16px 0; }
  .billing-page__usage-card--mcp .billing-page__usage-count { font-size: 24px; letter-spacing: -0.04em; }
  .billing-page__usage-card--mcp .billing-page__usage-limit { font-size: 16px; }
  .billing-page .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; }
  .billing-page .card { display: flex; min-height: 200px; flex-direction: column; gap: 14px; padding: 20px; border: 1px solid #e0e0e0; background: #fff; }
  .billing-page .card:only-child { max-width: none; }
  .billing-page .card.current-plan { border-color: #0a0a0a; background: #0a0a0a; color: #fff; }
  .billing-page .card.current-plan .meta { color: #bdbdbd; }
  .billing-page .card.current-plan .price-period { color: #bdbdbd; }
  .billing-page .card.founding-core-plan { position: relative; overflow: hidden; border-color: #7b3929; background: radial-gradient(ellipse at 86% 18%, #f17a3a 0%, #9f3927 13%, #401b1a 31%, transparent 52%), repeating-linear-gradient(112deg, #ffb35b08 0 1px, transparent 1px 5px), linear-gradient(135deg, #171213 0%, #261617 52%, #0a0a0a 100%); color: #fff; }
  .billing-page .card.founding-core-plan::after { position: absolute; top: -116px; right: -84px; width: 270px; height: 270px; border: 1px solid #f3a16870; border-radius: 50%; box-shadow: 0 0 0 12px #e8784222, 0 0 0 28px #f4b46b18, 0 0 0 52px #e8784210; content: ''; pointer-events: none; }
  .billing-page .card.founding-core-plan > :not(.metal-seal) { position: relative; z-index: 1; }
  .billing-page .card.founding-core-plan .meta, .billing-page .card.founding-core-plan .price-period { color: #e0c2b4; }
  .billing-page .card.founding-core-plan button { border-color: #f1e7df; background: #f1e7df; color: #171213; }
  .billing-page .card.founding-core-plan button:hover { background: #fff; }
  .billing-page .card.osmium-plan { position: relative; overflow: hidden; min-height: 260px; border-color: #aab0b9; background: radial-gradient(ellipse at 85% 10%, #525966 0, #191d24 32%, #090b0f 75%); color: #f5f6f8; }
  .billing-page .card.osmium-plan::after { position: absolute; top: -90px; right: -74px; width: 250px; height: 250px; border: 1px solid #cbd0d855; border-radius: 50%; box-shadow: 0 0 0 20px #cbd0d810, 0 0 0 42px #cbd0d808; content: ''; pointer-events: none; }
  .billing-page .card.osmium-plan .meta { color: #c5cad2; }
  .billing-page .card.osmium-plan .tag { background: #e1e4e9; color: #101216; }
  .billing-page .card.rhodium-plan { position: relative; overflow: hidden; min-height: 260px; border-color: #a7adb6; background: repeating-linear-gradient(177deg, #ffffff24 0 1px, #65707d0c 2px 3px, #ffffff10 4px 5px), radial-gradient(ellipse at 84% 12%, #ffffffdc 0, #ffffff00 36%), linear-gradient(132deg, #d4d8de 0%, #f3f4f5 30%, #9fa6af 57%, #e0e3e7 78%, #aab0b8 100%); color: #14171c; }
  .billing-page .card.rhodium-plan::after { position: absolute; top: -72px; right: -74px; width: 230px; height: 230px; border: 1px solid #30384638; border-radius: 50%; box-shadow: 0 0 0 13px #ffffff45, 0 0 0 28px #39414b12, 0 0 0 47px #ffffff32; content: ''; pointer-events: none; }
  .billing-page .card.rhodium-plan > :not(.metal-seal), .billing-page .card.iridium-plan > :not(.metal-seal) { position: relative; z-index: 1; }
  .billing-page .card.rhodium-plan .meta { color: #343a43; }
  .billing-page .card.rhodium-plan .tag { background: #191d23; color: #f5f6f8; }
  .billing-page .card.iridium-plan { position: relative; overflow: hidden; min-height: 260px; border-color: #626a76; background: repeating-linear-gradient(135deg, #e3e7ee08 0 1px, #05070b00 1px 9px), linear-gradient(118deg, #11151c 0%, #282e38 38%, #11151b 39%, #343b46 40%, #151920 58%, #090b10 100%); color: #f5f6f8; }
  .billing-page .card.iridium-plan::after { position: absolute; top: -88px; right: -72px; width: 236px; height: 236px; border: 1px solid #d8dde333; box-shadow: 0 0 0 13px #d8dde30e, 0 0 0 30px #d8dde31a, 0 0 0 52px #d8dde308; content: ''; pointer-events: none; transform: rotate(45deg); }
  .billing-page .card.iridium-plan .meta { color: #c8cdd5; }
  .billing-page .card.iridium-plan .price-period { color: #c8cdd5; }
  .billing-page .card.iridium-plan button { border-color: #d9dde3; background: #d9dde3; color: #11151b; }
  .billing-page .card.iridium-plan button:hover { background: #f2f3f5; }
  .billing-page .card.iridium-plan button:focus-visible { outline-color: #f5f6f8; }
  .billing-page .card.iridium-plan .tag { background: #d9dde3; color: #11151b; }
  .billing-page .metal-seal { position: absolute; top: 20px; right: 24px; z-index: 1; display: grid; width: 62px; height: 72px; place-content: center; border: 1px solid #d5d9df88; background: linear-gradient(145deg, #e1e4e9, #777e88 46%, #d6d9de); color: #12151a; text-align: center; }
  .billing-page .metal-seal small { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 9px; line-height: 1; }
  .billing-page .metal-seal strong { font-size: 28px; font-weight: 500; line-height: 1; }
  .billing-page .osmium-seal { background: linear-gradient(145deg, #e1e4e9, #777e88 46%, #d6d9de); }
  .billing-page .rhodium-seal { background: linear-gradient(145deg, #ffffff, #9da5b0 42%, #e9ebee 68%, #777f8a); }
  .billing-page .iridium-seal { border-color: #bec5d080; background: linear-gradient(145deg, #e0e3e8, #7a8390 44%, #c2c8d1); }
  .billing-page .founding-core-seal { width: 66px; height: 66px; border-color: #e59b6d; border-radius: 50%; background: radial-gradient(circle at 36% 30%, #ffe0a7 0%, #c96b3d 22%, #64251f 58%, #171213 100%); box-shadow: inset 0 0 0 3px #f5bb7c40, 0 0 24px #f0783b55; color: #fff7ed; }
  .billing-page .founding-core-seal strong { font-size: 27px; }
  .billing-page .card h2 { margin: 0; font-size: 19px; font-weight: 500; letter-spacing: -0.02em; }
  .billing-page .price { margin: 0; font-size: 34px; font-weight: 500; letter-spacing: -0.05em; line-height: 1; }
  .billing-page .price-period { color: #737373; font-size: 12px; font-weight: 400; letter-spacing: 0; }
  .billing-page .meta { flex: 1; margin: 0; color: #5c5c5c; font-size: 13px; line-height: 1.5; }
  .billing-page button { min-height: 44px; padding: 0 14px; border: 1px solid #0a0a0a; border-radius: 0; background: #0a0a0a; color: #fff; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
  .billing-page button:hover { background: #333; }
  .billing-page button:focus-visible { outline: 2px solid #0a0a0a; outline-offset: 4px; }
  .billing-page button.secondary { background: #fff; color: #0a0a0a; }
  .billing-page button.secondary:hover { background: #f4f4f4; }
  .billing-page .card .inline { margin: 0; }
  .billing-page .card .inline button { width: 100%; }
  .billing-page .billing-page__note { margin: 24px 0 0; color: #737373; font-size: 12px; line-height: 1.6; }
  .checkout-country { max-width: 620px; margin: 0 auto; padding: 48px 0; font-family: 'Hanken Grotesk', Arial, sans-serif; }
  .checkout-country__eyebrow { color: #737373; font: 10px 'JetBrains Mono', ui-monospace, monospace; letter-spacing: .1em; text-transform: uppercase; }
  .checkout-country h1 { margin: 24px 0 12px; font-size: clamp(40px, 7vw, 64px); font-weight: 500; letter-spacing: -.06em; }
  .checkout-country p { max-width: 560px; color: #5c5c5c; line-height: 1.55; }
  .checkout-country label { display: block; margin: 28px 0 8px; font-weight: 600; }
  .checkout-country select { box-sizing: border-box; width: 100%; min-height: 52px; padding: 0 14px; border: 1px solid #737373; border-radius: 0; background: #fff; color: #0a0a0a; font: inherit; }
  .checkout-country button { width: 100%; min-height: 52px; margin-top: 20px; border-radius: 0; font: 11px 'JetBrains Mono', ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; }
  .checkout-country__error { padding: 14px 16px; border-left: 3px solid #0a0a0a; background: #f5f5f5; color: #0a0a0a !important; }
  .checkout-country a { display: inline-block; margin-top: 20px; color: #5c5c5c; }
  @media (max-width: 620px) { main:has(.billing-page) { padding: 24px 20px 32px; } .billing-page { min-height: calc(100svh - 56px); } .billing-page__hero { margin: 48px 0 28px; } .billing-page__usage-grid { grid-template-columns: 1fr; padding: 2px 16px; } .billing-page__usage-header { align-items: start; flex-direction: column; gap: 6px; } .billing-page__usage-card--ai .billing-page__usage-count { font-size: clamp(42px, 12vw, 56px); } .billing-page .card { min-height: 200px; } }
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
         <a class="billing-error__button" href="/account/billing">Back to billing <span aria-hidden="true">↗</span></a>
       </div>
       <footer class="billing-error__footer"><span>Hominem</span><span aria-hidden="true">/</span><span>Billing</span></footer>
     </section>`,
    BRAND_FONTS,
  );
}

function subscribeForm(tier: BillingTier, label: string, secondary = false): string {
  return `<form class="inline" method="get" action="/billing/checkout"><input type="hidden" name="tier" value="${tier}"><button${secondary ? ' class="secondary"' : ''} type="submit">${label}</button></form>`;
}

function checkoutCountryPage(
  tier: Extract<BillingTier, 'core' | 'rhodium' | 'iridium'>,
  error = '',
): string {
  const countries = MANAGED_PAYMENTS_TAX_COUNTRIES.map(
    ({ code, name }) => `<option value="${code}">${escapeHtml(name)}</option>`,
  ).join('');
  return page(
    'Billing country | Hominem',
    `<section class="checkout-country" aria-labelledby="checkout-country-title">
       <p class="checkout-country__eyebrow">Hominem / Checkout</p>
       <h1 id="checkout-country-title">Your billing country</h1>
       <p>Choose the country where you’ll be billed. Hominem currently offers paid plans in countries covered by Stripe Managed Payments tax handling.</p>
       ${error ? `<p class="checkout-country__error" role="alert">${escapeHtml(error)}</p>` : ''}
       <form method="post" action="/billing/checkout">
         <input type="hidden" name="tier" value="${tier}">
         <label for="billing-country">Country or region</label>
         <select id="billing-country" name="country" required><option value="">Select a country</option>${countries}</select>
         <button type="submit">Continue to secure checkout</button>
       </form>
       <a href="/account/billing">Back to plans</a>
     </section>`,
    BRAND_FONTS,
  );
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
  variant?: string;
  seal?: { number: string; symbol: string };
}): string {
  const metalVariant = input.variant?.replace(/-plan$/, '') ?? 'osmium';
  return `<section class="card${input.current ? ' current-plan' : ''}${input.variant ? ` ${input.variant}` : ''}">
    ${input.tag ? `<span class="tag">${escapeHtml(input.tag)}</span>` : ''}
    ${input.seal ? `<span class="metal-seal ${metalVariant}-seal" aria-hidden="true"><small>${escapeHtml(input.seal.number)}</small><strong>${escapeHtml(input.seal.symbol)}</strong></span>` : ''}
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
  className?: string;
}): string {
  const value = input.limit === null ? input.used : Math.min(input.used, input.limit);
  return `<article class="billing-page__usage-card${input.className ? ` ${input.className}` : ''}" aria-label="${escapeHtml(input.label)} usage">
    <div class="billing-page__usage-card-top"><p class="billing-page__usage-label">${escapeHtml(input.label)}</p><div class="billing-page__usage-reading">
      <p class="billing-page__usage-count">${input.used.toLocaleString('en-GB')}</p><span class="billing-page__usage-slash">/</span><p class="billing-page__usage-limit">${input.limit === null ? '∞' : input.limit.toLocaleString('en-GB')}</p></div>
    </div>
    ${input.limit === null ? '' : `<progress class="billing-page__usage-meter" max="${input.limit}" value="${value}" aria-label="${escapeHtml(input.label)} usage"></progress>`}
  </article>`;
}

function aiAllowanceCard(input: {
  usedPercent: number | null;
  remainingPercent: number | null;
}): string {
  const unlimited = input.usedPercent === null;
  return `<article class="billing-page__usage-card billing-page__usage-card--ai" aria-label="AI allowance usage">
    <div class="billing-page__usage-card-top"><p class="billing-page__usage-label">AI allowance</p><div class="billing-page__usage-reading">
      <p class="billing-page__usage-count">${unlimited ? 'Unlimited' : `${input.usedPercent}% used`}</p></div>
    </div>
    ${
      unlimited
        ? ''
        : `<progress class="billing-page__usage-meter" max="100" value="${input.usedPercent}" aria-label="AI allowance used: ${input.usedPercent}%"></progress>
      <div class="billing-page__usage-foot"><p class="billing-page__usage-detail">Monthly allowance used</p><p class="billing-page__usage-detail">${input.remainingPercent}% remaining</p></div>
      <p class="billing-page__usage-explainer">Longer conversations and AI-assisted replies use more of your monthly allowance.</p>`
    }
  </article>`;
}

function usageResetLabel(periodStart: string): string {
  const reset = new Date(periodStart);
  reset.setUTCMonth(reset.getUTCMonth() + 1);
  return `Resets ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(reset)} · UTC`;
}

function billingPage(input: { state: BillingState; name: string }): string {
  const { state } = input;
  const plan = state.plan;
  const osmium = plan === 'osmium';
  const paid = plan !== 'taster' && !osmium;
  const subscription = state.subscription;
  const cards: string[] = [];
  const publicTokenBudgets = { core: 3_900_000, rhodium: 8_500_000, iridium: 18_000_000 } as const;
  if (osmium) {
    cards.push(
      planCard({
        name: 'Osmium Membership',
        price: 'Complimentary',
        meta: 'Unlimited messages, MCP tools and AI usage. No recurring charge.',
        current: true,
        variant: 'osmium-plan',
        seal: { number: '76', symbol: 'Os' },
        tag: 'Your membership',
        action: `<p class="meta">A rare tier. Yours for as long as it’s assigned to your account.</p>`,
      }),
    );
  } else if (!paid) {
    cards.push(
      planCard({
        name: 'Taster',
        price: '£0',
        meta: `Try every skill, up to ${state.limits.aiTokensPerMonth ? formatTokens(state.limits.aiTokensPerMonth) : 'unlimited'} AI tokens, ${state.limits.chatMessagesPerMonth?.toLocaleString('en-GB') ?? 'unlimited'} messages and ${state.limits.skillCallsPerMonth?.toLocaleString('en-GB') ?? 'unlimited'} MCP tool calls a month.`,
        current: plan === 'taster',
        action: `<p class="meta">Your current plan.</p>`,
      }),
    );
  } else {
    const renews = dateLabel(subscription?.currentPeriodEnd);
    const pricePence = subscription?.pricePence ?? TIER_PRICES_PENCE.core;
    const aiAllowance =
      state.limits.aiTokensPerMonth === null
        ? 'unlimited AI usage'
        : `${formatTokens(state.limits.aiTokensPerMonth)} AI tokens/month`;
    const mcpAllowance =
      state.limits.skillCallsPerMonth === null
        ? 'unlimited MCP calls'
        : `${state.limits.skillCallsPerMonth.toLocaleString('en-GB')} MCP calls/month`;
    cards.push(
      planCard({
        name: PLAN_NAMES[plan],
        price: `${pounds(pricePence)}<span class="price-period">/mo</span>`,
        meta: subscription?.cancelAtPeriodEnd
          ? `Cancelled — access ends ${escapeHtml(renews)}. ${pounds(pricePence)} per month · ${aiAllowance} · ${mcpAllowance}.`
          : `Renews ${escapeHtml(renews)}. ${pounds(pricePence)} per month${subscription?.founding ? ' · founding price locked' : ''} · ${aiAllowance} · ${mcpAllowance}.`,
        current: true,
        variant: plan === 'founding_core' ? 'founding-core-plan' : undefined,
        seal: plan === 'founding_core' ? { number: '26', symbol: 'Fe' } : undefined,
        action: subscription?.cancelAtPeriodEnd
          ? `<p class="meta">Your current plan.</p>`
          : actionForm('/billing/cancel', 'Cancel'),
      }),
    );
  }
  if (!osmium) {
    for (const tier of ['core', 'rhodium', 'iridium'] as const) {
      const current = plan === tier || (tier === 'core' && plan === 'founding_core');
      if (current) continue;
      const pricePence = TIER_PRICES_PENCE[tier];
      const budget = publicTokenBudgets[tier];
      const name = tier[0]!.toUpperCase() + tier.slice(1);
      cards.push(
        planCard({
          name,
          price: `${pounds(pricePence)}<span class="price-period">/mo</span>`,
          meta: `All skills, with ${formatTokens(budget)} AI tokens each month.`,
          current: false,
          variant: tier === 'core' ? undefined : `${tier}-plan`,
          seal:
            tier === 'rhodium'
              ? { number: '45', symbol: 'Rh' }
              : tier === 'iridium'
                ? { number: '77', symbol: 'Ir' }
                : undefined,
          action: paid
            ? actionForm('/billing/change', `Switch to ${name}`, true, tier)
            : subscribeForm(tier, 'Subscribe'),
        }),
      );
    }
  }
  return page(
    'Plan | Hominem',
    `<section class="billing-page" aria-labelledby="billing-title">
       <header class="billing-page__header"><span class="billing-page__wordmark">Hominem</span><span class="billing-page__meta">Account</span></header>
       <nav aria-label="Account" class="account-nav"><a href="/account">Account</a><a href="/account/usage">Usage</a><a aria-current="page" href="/account/billing">Billing</a><a href="/account/connections">Connections</a><a href="/account/data">Data</a></nav>
       <div class="billing-page__hero"><h1 id="billing-title">Your plan</h1></div>
       ${cards.length ? `<div class="grid">${cards.join('')}</div>` : ''}
       <p class="billing-page__note">${osmium ? 'Your Osmium membership is complimentary and unlimited.' : 'Payments and receipts are handled by Stripe. Prices are in pounds and renew monthly until you cancel.'} ${escapeHtml(input.name ? `Signed in as ${input.name}.` : '')}</p>
     </section>`,
    BRAND_FONTS,
  );
}

function messagePage(title: string, heading: string, body: string): string {
  return page(
    title,
    `<h1>${escapeHtml(heading)}</h1><p class="lede">${body}</p><p><a href="/account/billing">Back to plans</a></p>`,
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
  resumePath = '/account/billing',
): { userId: string; email: string; name: string } | { response: Response } {
  const auth = c.get('auth');
  if (!auth) {
    const target = new URL(resumePath, originFor(c)).toString();
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

billingRoutes.get('/billing', (c) =>
  c.redirect(`/account/billing${new URL(c.req.url).search}`, 302),
);

billingRoutes.get('/account/usage', async (c) => {
  const who = authOrRedirect(c, '/account/usage');
  if ('response' in who) return who.response;
  try {
    const state = await billingState(billingRules(), who.userId);
    const aiUsage = await getMonthlyUsageStatus(
      who.userId,
      state.limits.aiSpendUsdPerMonth ?? Number.MAX_SAFE_INTEGER,
    );
    c.header('Cache-Control', 'no-store');
    const aiUnlimited = state.plan === 'osmium';
    const tokenLimit = aiUnlimited ? null : state.limits.aiTokensPerMonth;
    const tokenPercent =
      tokenLimit === null || tokenLimit === 0 ? 0 : (aiUsage.totalTokens / tokenLimit) * 100;
    const spendLimit = aiUnlimited ? null : state.limits.aiSpendUsdPerMonth;
    const spendPercent =
      spendLimit === null || spendLimit === 0 ? 0 : (aiUsage.totalCostUsd / spendLimit) * 100;
    const aiPercentUsed = aiUnlimited
      ? null
      : Math.min(100, Math.round(Math.max(tokenPercent, spendPercent)));
    const aiRemainingPercent = aiPercentUsed === null ? null : 100 - aiPercentUsed;
    const content = `<section class="billing-page__usage" aria-labelledby="billing-usage-title">
      <header class="billing-page__usage-header"><h1 class="billing-page__usage-title" id="billing-usage-title">Usage this month</h1><p class="billing-page__usage-reset">${usageResetLabel(state.periodStart)}</p></header>
      <div class="billing-page__usage-grid">${aiAllowanceCard({ usedPercent: aiPercentUsed, remainingPercent: aiRemainingPercent })}${usageCard({ label: 'MCP tool calls', used: state.usage.skillCalls, limit: state.limits.skillCallsPerMonth, className: 'billing-page__usage-card--mcp' })}</div>
    </section>`;
    return c.html(
      page(
        'Usage | Hominem',
        `<section class="billing-page"><header class="billing-page__header"><span class="billing-page__wordmark">Hominem</span><span class="billing-page__meta">Account</span></header><nav aria-label="Account" class="account-nav"><a href="/account">Account</a><a aria-current="page" href="/account/usage">Usage</a><a href="/account/billing">Billing</a><a href="/account/connections">Connections</a><a href="/account/data">Data</a></nav><div class="billing-page__hero"><h1>Your usage</h1></div>${content}</section>`,
        BRAND_FONTS,
      ),
    );
  } catch (error) {
    logger.error('account_usage_page_failed', {
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return c.html(
      messagePage(
        'Usage unavailable | Hominem',
        'Usage unavailable',
        'Something went wrong. Try again in a moment.',
      ),
      503,
    );
  }
});

billingRoutes.get('/account/billing', async (c) => {
  const who = authOrRedirect(c);
  if ('response' in who) return who.response;
  try {
    const state = await billingState(billingRules(), who.userId);
    if (state.plan !== 'osmium') {
      const deps = requireDeps(c);
      if ('response' in deps) return deps.response;
    }
    c.header('Cache-Control', 'no-store');
    return c.html(billingPage({ state, name: who.name }));
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

billingRoutes.get('/billing/checkout', async (c) => {
  const who = authOrRedirect(c);
  if ('response' in who) return who.response;
  const tier = c.req.query('tier');
  if (tier !== 'core' && tier !== 'rhodium' && tier !== 'iridium')
    return c.text('Bad Request', 400);
  if (await billingRules().store.getOsmiumMembership(who.userId)) {
    return c.text('Osmium membership is already unlimited.', 403);
  }
  return c.html(checkoutCountryPage(tier));
});

billingRoutes.post('/billing/checkout', async (c) => {
  const who = authOrRedirect(c);
  if ('response' in who) return who.response;
  if (await billingRules().store.getOsmiumMembership(who.userId)) {
    return c.text('Osmium membership is already unlimited.', 403);
  }
  const deps = requireDeps(c);
  if ('response' in deps) return deps.response;
  const body = await c.req.parseBody();
  const tier = body.tier;
  if (tier !== 'core' && tier !== 'rhodium' && tier !== 'iridium')
    return c.text('Bad Request', 400);
  const country = typeof body.country === 'string' ? body.country : '';
  if (!/^[A-Z]{2}$/.test(country) || !isManagedPaymentsTaxCountry(country)) {
    return c.html(
      checkoutCountryPage(
        tier,
        'Paid plans are not available for that billing country yet. Choose a listed country to continue.',
      ),
      422,
    );
  }
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
  if (await billingRules().store.getOsmiumMembership(who.userId)) {
    return c.text('Osmium membership is already unlimited.', 403);
  }
  const deps = requireDeps(c);
  if ('response' in deps) return deps.response;
  const tier = (await c.req.parseBody()).tier;
  if (tier !== 'core' && tier !== 'rhodium' && tier !== 'iridium')
    return c.text('Bad Request', 400);
  try {
    await changePlan(deps.deps, who.userId, tier);
    return c.redirect('/account/billing', 303);
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
  if (await billingRules().store.getOsmiumMembership(who.userId)) {
    return c.text('Osmium membership is complimentary and does not renew.', 403);
  }
  const deps = requireDeps(c);
  if ('response' in deps) return deps.response;
  try {
    await cancelPlan(deps.deps, who.userId);
    return c.redirect('/account/billing', 303);
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
          <a class="billing-done__button" href="/account/billing">Return to plans <span aria-hidden="true">↗</span></a>
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
