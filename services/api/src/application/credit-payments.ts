/**
 * Top-up payments: starting a Stripe Checkout and handling its webhook (docs/prd/top-up.md).
 *
 * The rules:
 * - a Checkout is for one of the page's amounts, and the credit it gives is worked out here, not
 *   taken from the browser;
 * - the webhook credits a payment once (the session id is the key), only if it is paid, in pounds
 *   and for the amount asked, and only when both the card and the billing address are in the UK;
 *   any other payment is refunded in full and credits nothing.
 */
import { z } from 'zod';

import {
  creditPenceFor,
  creditSnapshot,
  reconcileLimits,
  TOP_UP_POUNDS,
  type CreditDeps,
} from './credit';
import { StripeError, type StripeClient } from './stripe';

export interface CheckoutDeps {
  stripe: StripeClient;
  /** Where Stripe sends the person afterwards, as absolute URLs. */
  successUrl: string;
  cancelUrl: string;
}

export type CheckoutOutcome =
  | { kind: 'started'; url: string }
  | { kind: 'bad_amount' }
  | { kind: 'no_consent' };

/** Starts a Checkout for one of the offered amounts, once the person has ticked the consent. */
export async function startCheckout(
  deps: CheckoutDeps,
  input: { userId: string; email: string; amountPounds: number; consent: boolean },
): Promise<CheckoutOutcome> {
  if (!TOP_UP_POUNDS.includes(input.amountPounds)) {
    return { kind: 'bad_amount' };
  }
  if (!input.consent) return { kind: 'no_consent' };
  const amountPence = input.amountPounds * 100;
  const session = await deps.stripe.createCheckoutSession({
    userId: input.userId,
    email: input.email,
    amountPence,
    creditPence: creditPenceFor(amountPence),
    successUrl: deps.successUrl,
    cancelUrl: deps.cancelUrl,
  });
  return { kind: 'started', url: session.url };
}

const completedSchema = z.object({
  type: z.literal('checkout.session.completed'),
  data: z.object({
    object: z.object({
      id: z.string().min(1),
      payment_status: z.string(),
      payment_intent: z.string().nullable(),
      currency: z.string().nullable(),
      amount_total: z.number().int().nullable(),
      metadata: z.record(z.string(), z.string()).nullable(),
    }),
  }),
});

export type WebhookOutcome =
  | { kind: 'ignored' }
  | { kind: 'duplicate' }
  | { kind: 'credited'; userId: string; amountPence: number; creditPence: number }
  | { kind: 'refunded_not_uk'; userId: string }
  | { kind: 'rejected'; reason: string };

export interface WebhookDeps {
  credit: CreditDeps;
  stripe: StripeClient;
}

/** Handles one verified Stripe event. Other event types are ignored. */
export async function handleStripeEvent(
  deps: WebhookDeps,
  event: unknown,
): Promise<WebhookOutcome> {
  const parsed = completedSchema.safeParse(event);
  if (!parsed.success) return { kind: 'ignored' };
  const session = parsed.data.data.object;
  const userId = session.metadata?.user_id;
  const amountPence = session.amount_total;

  if (session.payment_status !== 'paid') return { kind: 'ignored' };
  if (!userId || amountPence === null || !session.payment_intent) {
    return { kind: 'rejected', reason: 'missing_fields' };
  }
  if (session.currency !== 'gbp') return { kind: 'rejected', reason: 'not_gbp' };
  if (!TOP_UP_POUNDS.includes(amountPence / 100)) {
    return { kind: 'rejected', reason: 'unknown_amount' };
  }
  if (String(amountPence) !== session.metadata?.amount_pence) {
    return { kind: 'rejected', reason: 'amount_mismatch' };
  }
  const creditPence = creditPenceFor(amountPence);

  const countries = await deps.stripe.paymentCountries(session.payment_intent);
  const inUk = countries.cardCountry === 'GB' && countries.billingCountry === 'GB';
  if (!inUk) {
    // Refund first, then record: a crash in between leaves the session unrecorded, so Stripe's
    // retry refunds again, which Stripe answers with "already refunded" and the record is then made.
    await deps.stripe.refund(session.payment_intent).catch((error: unknown) => {
      if (!(error instanceof StripeError) || error.code !== 'charge_already_refunded') throw error;
    });
    const recorded = await deps.credit.store.recordPayment({
      sessionId: session.id,
      userId,
      amountPence,
      creditPence,
      status: 'refunded_not_uk',
    });
    return recorded === 'duplicate' ? { kind: 'duplicate' } : { kind: 'refunded_not_uk', userId };
  }

  const recorded = await deps.credit.store.recordPayment({
    sessionId: session.id,
    userId,
    amountPence,
    creditPence,
    status: 'credited',
  });
  if (recorded === 'duplicate') return { kind: 'duplicate' };
  await deps.credit.store.setLowNotified(userId, null);
  // Raise the live keys' limits now. If this fails, the next budget read repairs them.
  try {
    await reconcileLimits(deps.credit, await creditSnapshot(deps.credit, userId));
  } catch (error) {
    deps.credit.log?.('credit_reconcile_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return { kind: 'credited', userId, amountPence, creditPence };
}
