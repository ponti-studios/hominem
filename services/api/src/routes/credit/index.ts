import { randomBytes } from 'node:crypto';

import { db } from '@hominem/db/core';
import { logger } from '@hominem/telemetry';
import { Hono } from 'hono';
import { z } from 'zod';

import { creditFor, creditSnapshot, verifyLinkToken } from '../../application/credit';
import { sendTopUpConfirmationEmail } from '../../application/credit-email';
import {
  cancelledPage,
  creditCsp,
  donePage,
  problemPage,
  topUpPage,
} from '../../application/credit-page';
import { confirmOnce, handleStripeEvent, startCheckout } from '../../application/credit-payments';
import {
  creditDeps,
  personInCreditMode,
  stripeClient,
  stripeProblem,
} from '../../application/credit.runtime';
import { verifyStripeSignature } from '../../application/stripe';
import { env } from '../../env';

/** The page and its checkout, plus Stripe's webhook. Anonymous on purpose: a signed link is the sign-in. */
export const creditRoutes = new Hono();

async function userById(userId: string) {
  return db.selectFrom('user').select(['id', 'email']).where('id', '=', userId).executeTakeFirst();
}

function html(
  c: import('hono').Context,
  body: (nonce: string) => string,
  status: 200 | 400 | 404 | 503 = 200,
) {
  const nonce = randomBytes(16).toString('base64');
  c.header('Content-Security-Policy', creditCsp(nonce));
  c.header('Cache-Control', 'no-store');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Content-Type-Options', 'nosniff');
  return c.html(body(nonce), status);
}

creditRoutes.get('/credit', async (c) => {
  if (env.CREDIT_MODE === 'off') return c.notFound();
  const userId = verifyLinkToken(env.BETTER_AUTH_SECRET, c.req.query('t') ?? '', new Date());
  if (!userId) {
    return html(c, (n) => problemPage(n, 'This link has expired. Ask for a new one.'), 400);
  }
  const user = await userById(userId);
  const deps = creditDeps();
  if (!user || !(await personInCreditMode(user)) || !deps) return c.notFound();
  try {
    const reading = await creditFor(deps, userId);
    return html(c, (n) =>
      topUpPage({
        nonce: n,
        token: c.req.query('t') ?? '',
        balancePence: reading.balancePence,
        testMode: env.CREDIT_MODE === 'test',
      }),
    );
  } catch (error) {
    logger.error('credit_page_failed', { error });
    return html(c, (n) => problemPage(n, 'Something went wrong. Try again in a moment.'), 503);
  }
});

const checkoutBody = z.object({
  t: z.string().min(10).max(1000),
  amountPounds: z.number().int(),
  consent: z.boolean(),
});

creditRoutes.post('/credit/checkout', async (c) => {
  c.header('Cache-Control', 'no-store');
  if (env.CREDIT_MODE === 'off') return c.json({ error: 'not_found' }, 404);
  const body = checkoutBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'bad_request' }, 400);
  const userId = verifyLinkToken(env.BETTER_AUTH_SECRET, body.data.t, new Date());
  if (!userId) return c.json({ error: 'expired' }, 400);
  const user = await userById(userId);
  if (!user || !(await personInCreditMode(user))) return c.json({ error: 'not_found' }, 404);
  const stripe = stripeClient();
  if (!stripe) return c.json({ error: 'unavailable' }, 503);

  const origin = env.API_URL.replace(/\/$/, '');
  try {
    const outcome = await startCheckout(
      {
        stripe,
        // The signed link rides along so the next page can show who paid; the session id is Stripe's own placeholder.
        successUrl: `${origin}/credit/done?t=${encodeURIComponent(body.data.t)}&s={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/credit/cancelled?t=${encodeURIComponent(body.data.t)}`,
      },
      {
        userId,
        email: user.email,
        amountPounds: body.data.amountPounds,
        consent: body.data.consent,
      },
    );
    if (outcome.kind === 'started') return c.json({ url: outcome.url });
    return c.json({ error: outcome.kind }, 400);
  } catch (error) {
    logger.error('credit_checkout_failed', { error });
    return c.json({ error: 'unavailable' }, 503);
  }
});

const sessionIdSchema = z.string().regex(/^cs_[A-Za-z0-9_]{6,200}$/);

creditRoutes.get('/credit/done', (c) => {
  if (env.CREDIT_MODE === 'off') return c.notFound();
  const t = c.req.query('t') ?? '';
  const sessionId = sessionIdSchema.safeParse(c.req.query('s'));
  const live = verifyLinkToken(env.BETTER_AUTH_SECRET, t, new Date()) && sessionId.success;
  return html(c, (n) =>
    donePage(n, live && sessionId.success ? { token: t, sessionId: sessionId.data } : null),
  );
});

/** What the done page asks until the webhook has credited the payment. Needs the signed link. */
creditRoutes.get('/credit/status', async (c) => {
  c.header('Cache-Control', 'no-store');
  if (env.CREDIT_MODE === 'off') return c.json({ error: 'not_found' }, 404);
  const userId = verifyLinkToken(env.BETTER_AUTH_SECRET, c.req.query('t') ?? '', new Date());
  const sessionId = sessionIdSchema.safeParse(c.req.query('s'));
  const deps = creditDeps();
  if (!userId || !sessionId.success || !deps) return c.json({ error: 'bad_request' }, 400);
  try {
    const payment = await deps.store.paymentFor(userId, sessionId.data);
    if (!payment) return c.json({ state: 'pending' });
    if (payment.status !== 'credited') return c.json({ state: 'refunded' });
    const snapshot = await creditSnapshot(deps, userId);
    return c.json({
      state: 'credited',
      creditPence: payment.creditPence,
      balancePence: snapshot.balancePence,
    });
  } catch (error) {
    logger.error('credit_status_failed', { error });
    return c.json({ state: 'pending' });
  }
});

creditRoutes.get('/credit/cancelled', async (c) => {
  if (env.CREDIT_MODE === 'off') return c.notFound();
  const t = c.req.query('t') ?? '';
  const userId = verifyLinkToken(env.BETTER_AUTH_SECRET, t, new Date());
  const deps = creditDeps();
  let balancePence: number | null = null;
  if (userId && deps) {
    balancePence = await creditSnapshot(deps, userId)
      .then((snapshot) => snapshot.balancePence)
      .catch(() => null);
  }
  return html(c, (n) => cancelledPage(n, userId ? { token: t, balancePence } : null));
});

// Stripe calls this after a payment. The raw body is what the signature covers, so read it as text.
creditRoutes.post('/webhooks/stripe', async (c) => {
  if (env.CREDIT_MODE === 'off') return c.notFound();
  const problem = stripeProblem(env.CREDIT_MODE, env.STRIPE_SECRET_KEY);
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (problem || !secret) return c.json({ error: 'unavailable' }, 503);

  const raw = await c.req.text();
  if (!verifyStripeSignature(raw, c.req.header('stripe-signature'), secret, new Date())) {
    return c.json({ error: 'bad_signature' }, 400);
  }
  const deps = creditDeps();
  const stripe = stripeClient();
  if (!deps || !stripe) return c.json({ error: 'unavailable' }, 503);

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return c.json({ error: 'bad_request' }, 400);
  }
  try {
    const outcome = await handleStripeEvent({ credit: deps, stripe }, event);
    logger.info('credit_webhook', { outcome: outcome.kind });
    const confirm =
      outcome.kind === 'credited'
        ? outcome
        : outcome.kind === 'duplicate'
          ? outcome.confirm
          : undefined;
    // Sent once per payment: a retry after a failed send tries again, a repeat never sends twice.
    if (confirm) await confirmOnce({ store: deps.store }, confirm, sendTopUpConfirmationEmail);
    return c.json({ received: true });
  } catch (error) {
    // A 5xx makes Stripe retry, which the ledger's idempotency makes safe.
    logger.error('credit_webhook_failed', { error });
    return c.json({ error: 'failed' }, 500);
  }
});
