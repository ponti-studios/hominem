/**
 * The real senders and clock behind settling a payment: used by the Stripe webhook and by the
 * sweeper that settles any payment the webhook missed (see `credit-payments.ts`).
 */
import { logger } from '@hominem/telemetry';

import { env } from '../env';
import { sendTopUpConfirmationEmail, sendTopUpNotChargedEmail } from './credit-email';
import { publishCreditEvent } from './credit-events';
import { deliverOutcome, sweepHolds, type WebhookOutcome } from './credit-payments';
import { creditDeps, stripeClient } from './credit.runtime';

/** Reports a settled payment to the person: the once-only email, and their open app. */
export async function deliverSettled(
  store: NonNullable<ReturnType<typeof creditDeps>>['store'],
  outcome: WebhookOutcome,
): Promise<void> {
  await deliverOutcome(
    {
      store,
      sendConfirmation: sendTopUpConfirmationEmail,
      sendNotCharged: sendTopUpNotChargedEmail,
      notify: publishCreditEvent,
      log: (event, fields) => logger.error(event, fields),
    },
    outcome,
  );
}

const SWEEP_EVERY_MS = 5 * 60 * 1000;

/** Settles missed payments every few minutes. Returns a function that stops it. */
export function startHoldSweeper(): () => void {
  if (env.CREDIT_MODE === 'off') return () => undefined;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const credit = creditDeps();
      const stripe = stripeClient();
      if (!credit || !stripe) return;
      const result = await sweepHolds({ credit, stripe }, (outcome) =>
        deliverSettled(credit.store, outcome),
      );
      if (result.settled.length > 0 || result.failed > 0) {
        logger.info('credit_sweep', {
          looked: result.looked,
          settled: result.settled.length,
          failed: result.failed,
        });
      }
    } catch (error) {
      logger.error('credit_sweep_error', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), SWEEP_EVERY_MS);
  return () => clearInterval(timer);
}
