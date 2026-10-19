/**
 * Top-up payments: starting a Stripe Checkout and handling its webhook (docs/prd/top-up.md).
 *
 * The rules:
 * - a Checkout is for one of the page's amounts, and the credit it gives is worked out here, not
 *   taken from the browser;
 * - Checkout only holds the money. The webhook credits a payment once (the session id is the key),
 *   only if it is in pounds and for the amount asked, and only when both the card and the billing
 *   address are in the UK: then the hold is captured. Any other payment is released, so nothing is
 *   charged and Stripe keeps no fee;
 * - a sweeper settles any Checkout the webhook missed, long before the card hold expires (7 days).
 */
import { z } from 'zod';

import {
  creditPenceFor,
  creditSnapshot,
  reconcileLimits,
  TOP_UP_POUNDS,
  type CreditDeps,
  type CreditStore,
} from './credit';
import {
  checkoutSessionSchema,
  StripeError,
  type CheckoutSession,
  type StripeClient,
} from './stripe';

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

const completedEventSchema = z.object({
  type: z.literal('checkout.session.completed'),
  data: z.object({ object: checkoutSessionSchema }),
});

/** What the confirmation email says: which payment, whose, and what it paid for. */
export interface Confirmation {
  sessionId: string;
  userId: string;
  amountPence: number;
  creditPence: number;
}

export type WebhookOutcome =
  | { kind: 'ignored' }
  | {
      kind: 'duplicate';
      /** Set when the earlier delivery credited this payment, so a lost confirmation can be sent. */
      confirm?: Confirmation;
    }
  | {
      kind: 'credited';
      sessionId: string;
      userId: string;
      amountPence: number;
      creditPence: number;
    }
  /** Not a UK card and address: the hold was released (or the money refunded) and nothing credited. */
  | { kind: 'not_charged'; userId: string }
  | { kind: 'rejected'; reason: string };

export interface WebhookDeps {
  credit: CreditDeps;
  stripe: StripeClient;
}

/** Stripe's answer when a payment is no longer in the state we asked about (already captured, released or refunded). */
const WRONG_STATE = 'payment_intent_unexpected_state';

function isStripeCode(error: unknown, code: string): boolean {
  return error instanceof StripeError && error.code === code;
}

/** Handles one verified Stripe event. Other event types are ignored. */
export async function handleStripeEvent(
  deps: WebhookDeps,
  event: unknown,
): Promise<WebhookOutcome> {
  const parsed = completedEventSchema.safeParse(event);
  if (!parsed.success) return { kind: 'ignored' };
  return settleSession(deps, parsed.data.data.object);
}

/**
 * Settles one completed Checkout, whether the webhook or the sweeper found it. The card is only
 * held when the person pays: a UK card and address is captured and credited, anything else is
 * released, so nothing is charged and Stripe keeps no fee. A payment taken before holds existed
 * (already `succeeded`) is refunded instead. Safe to run twice: the session id keys the ledger.
 */
export async function settleSession(
  deps: WebhookDeps,
  session: CheckoutSession,
): Promise<WebhookOutcome> {
  const userId = session.metadata?.user_id;
  const amountPence = session.amount_total;

  if (session.payment_status === 'no_payment_required') return { kind: 'ignored' };
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
  const paymentIntent = session.payment_intent;

  const earlier = await deps.credit.store.paymentFor(userId, session.id);
  if (earlier) {
    return earlier.status === 'credited'
      ? { kind: 'duplicate', confirm: { sessionId: session.id, userId, amountPence, creditPence } }
      : { kind: 'duplicate' };
  }

  let facts = await deps.stripe.paymentFacts(paymentIntent);
  // Anything but a held or taken payment (still processing, expired and released) is not ours to settle.
  if (facts.status !== 'requires_capture' && facts.status !== 'succeeded') {
    return { kind: 'ignored' };
  }
  const inUk = facts.cardCountry === 'GB' && facts.billingCountry === 'GB';

  if (!inUk) {
    // Release or refund first, then record: a crash in between leaves the session unrecorded, so the
    // retry finds the payment already released (Stripe answers "wrong state") and the record is made.
    if (facts.status === 'requires_capture') {
      await deps.stripe.cancel(paymentIntent).catch((error: unknown) => {
        if (!isStripeCode(error, WRONG_STATE)) throw error;
      });
    } else {
      await deps.stripe.refund(paymentIntent).catch((error: unknown) => {
        if (!isStripeCode(error, 'charge_already_refunded')) throw error;
      });
    }
    const recorded = await deps.credit.store.recordPayment({
      sessionId: session.id,
      userId,
      amountPence,
      creditPence,
      status: 'refunded_not_uk',
    });
    return recorded === 'duplicate' ? { kind: 'duplicate' } : { kind: 'not_charged', userId };
  }

  // Take the money before crediting it, so credit is never given for a payment that did not go through.
  // A crash after this leaves a taken payment with no record, which the retry sees as `succeeded`.
  if (facts.status === 'requires_capture') {
    try {
      await deps.stripe.capture(paymentIntent);
    } catch (error) {
      if (!isStripeCode(error, WRONG_STATE)) throw error;
      facts = await deps.stripe.paymentFacts(paymentIntent);
      if (facts.status !== 'succeeded') return { kind: 'rejected', reason: 'capture_failed' };
    }
  }

  const recorded = await deps.credit.store.recordPayment({
    sessionId: session.id,
    userId,
    amountPence,
    creditPence,
    status: 'credited',
  });
  if (recorded === 'duplicate') {
    return {
      kind: 'duplicate',
      confirm: { sessionId: session.id, userId, amountPence, creditPence },
    };
  }
  await deps.credit.store.setLowNotified(userId, null);
  // Raise the live keys' limits now. If this fails, the next budget read repairs them.
  try {
    await reconcileLimits(deps.credit, await creditSnapshot(deps.credit, userId));
  } catch (error) {
    deps.credit.log?.('credit_reconcile_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return { kind: 'credited', sessionId: session.id, userId, amountPence, creditPence };
}

/** How far back the sweeper looks. A card hold lasts 7 days, so a payment is never found too late to settle. */
const SWEEP_WINDOW_SECONDS = 6 * 24 * 60 * 60;
/** Younger payments are left to their webhook, which usually arrives within seconds. */
const SWEEP_MIN_AGE_SECONDS = 2 * 60;

export interface SweepResult {
  looked: number;
  settled: WebhookOutcome[];
  failed: number;
}

/**
 * Finds completed Checkouts the webhook never settled (it failed, or Stripe could not reach us) and
 * settles them, so a held payment is captured or released well before the hold runs out. Meant to run
 * every few minutes; the ledger makes a repeat harmless. It also resends a confirmation email that
 * failed, since nothing else would.
 */
export async function sweepHolds(
  deps: WebhookDeps & { now?: () => Date },
  deliver: (outcome: WebhookOutcome) => Promise<void>,
): Promise<SweepResult> {
  const nowUnix = Math.floor((deps.now ?? (() => new Date()))().getTime() / 1000);
  const sessions = await deps.stripe.completedSessions(nowUnix - SWEEP_WINDOW_SECONDS);
  const result: SweepResult = { looked: sessions.length, settled: [], failed: 0 };
  for (const session of sessions) {
    if (session.created !== undefined && nowUnix - session.created < SWEEP_MIN_AGE_SECONDS)
      continue;
    try {
      const outcome = await settleSession(deps, session);
      if (outcome.kind === 'credited' || outcome.kind === 'not_charged') {
        result.settled.push(outcome);
        await deliver(outcome);
      } else if (outcome.kind === 'duplicate' && outcome.confirm) {
        // Settled earlier: send a confirmation that failed then, which sends at most once.
        await deliver(outcome);
      }
    } catch (error) {
      result.failed += 1;
      deps.credit.log?.('credit_sweep_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}

/** A claim that never finished (the process died mid-send) can be taken again after this long. */
const CLAIM_STALE_MS = 10 * 60 * 1000;

/**
 * Sends a payment's confirmation email at most once. The claim is taken before sending, so two
 * deliveries at the same time cannot both send; a failed send gives the claim back and rethrows,
 * so the webhook fails and Stripe delivers it again.
 * Returns whether this call sent it.
 */
export async function confirmOnce(
  deps: { store: CreditStore; now?: () => Date },
  confirmation: Confirmation,
  send: (confirmation: Confirmation) => Promise<void>,
): Promise<boolean> {
  const now = (deps.now ?? (() => new Date()))();
  const claimed = await deps.store.claimConfirmation(
    confirmation.sessionId,
    new Date(now.getTime() - CLAIM_STALE_MS),
  );
  if (!claimed) return false;
  try {
    await send(confirmation);
  } catch (error) {
    await deps.store.releaseConfirmation(confirmation.sessionId);
    throw error;
  }
  await deps.store.markConfirmationSent(confirmation.sessionId);
  return true;
}

/** Where a settled payment is reported: the person's email and their open app. */
export interface DeliverDeps {
  store: CreditStore;
  sendConfirmation: (confirmation: Confirmation) => Promise<void>;
  sendNotCharged: (userId: string) => Promise<void>;
  /** Tells the person's open app to read their credit again. Never fails the settlement. */
  notify: (userId: string, outcome: 'credited' | 'not_charged') => Promise<void>;
  log?: (event: string, fields: Record<string, unknown>) => void;
}

/**
 * Tells the person what happened to a payment, once. The confirmation can throw so the webhook
 * fails and Stripe delivers it again; the in-app notice and the "UK only" email are best effort.
 */
export async function deliverOutcome(deps: DeliverDeps, outcome: WebhookOutcome): Promise<void> {
  const confirm =
    outcome.kind === 'credited'
      ? outcome
      : outcome.kind === 'duplicate'
        ? outcome.confirm
        : undefined;
  if (confirm) await confirmOnce({ store: deps.store }, confirm, deps.sendConfirmation);
  if (outcome.kind !== 'credited' && outcome.kind !== 'not_charged') return;
  const userId = outcome.userId;
  if (outcome.kind === 'not_charged') {
    await deps.sendNotCharged(userId).catch((error: unknown) => {
      deps.log?.('credit_not_charged_email_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
  await deps.notify(userId, outcome.kind).catch((error: unknown) => {
    deps.log?.('credit_notify_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
