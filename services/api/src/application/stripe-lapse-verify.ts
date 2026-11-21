/**
 * Assertions for a Test Clock-driven lapse (docs/billing-test-plan.md). Pure: the calling
 * script observes the stored subscription, the app-reported allowance, and the rendered
 * billing page across the three moments of the scenario; this module judges them against
 * the billing rules, so the end-to-end assertions are themselves tested.
 *
 * The scenario: a paid subscription is cancelled through the app (access retained through
 * the paid period, no resume offered), then a Stripe Test Clock is advanced past the period
 * end and the account must fall back to Taster.
 */
import type { BillingSubscriptionRecord } from '@hominem/db/billing';

import { DEFAULT_BILLING_CONFIG, limitsFor, planFor, type BillingConfig } from './billing';
import {
  verifyStripeTestOutcome,
  type StripeTestFinding,
  type StripeTestObservation,
} from './stripe-test-verify';

/** One moment of the scenario, as the observing script sees it. */
export interface StripeLapseObservation {
  subscription: BillingSubscriptionRecord | null;
  /** The AI-token allowance the app itself reports for the account, or null when unreadable. */
  reportedAiTokens: number | null;
  /** The rendered /account/billing page, for the states only the page can show. */
  billingHtml: string;
}

export interface StripeLapseFacts {
  /** The moment the lapse is judged against; the clock has already moved past the period end. */
  now: Date;
  /** The paid state before the cancel, judged by the completed-checkout assertions. */
  afterCreate: StripeTestObservation;
  afterCancel: StripeLapseObservation;
  afterLapse: StripeLapseObservation;
}

const numberFormat = new Intl.NumberFormat('en-GB');

export function verifyStripeLapseOutcome(
  facts: StripeLapseFacts,
  config: BillingConfig = DEFAULT_BILLING_CONFIG,
): StripeTestFinding[] {
  const cancelled = facts.afterCancel.subscription;
  const lapsed = facts.afterLapse.subscription;
  const lapsedPlan = lapsed === null ? 'taster' : planFor(lapsed, facts.now);
  return [
    ...verifyStripeTestOutcome('core', facts.afterCreate, config),
    {
      ok: cancelled?.status === 'active' && cancelled.cancelAtPeriodEnd === true,
      label: 'Cancellation at period end',
      fix: `The app must stop only the next renewal — after /billing/cancel the record says status ${cancelled?.status ?? 'none'}, cancelAtPeriodEnd ${cancelled?.cancelAtPeriodEnd === true}.`,
    },
    {
      ok: facts.afterCancel.reportedAiTokens === limitsFor('core', config).aiTokensPerMonth,
      label: 'Access retained through the paid period',
      fix: `Cancelling must not downgrade early — expected the app to keep reporting ${numberFormat.format(limitsFor('core', config).aiTokensPerMonth ?? 0)} AI tokens until the period ends, but it reported ${facts.afterCancel.reportedAiTokens ?? 'no readable'} allowance.`,
    },
    {
      ok:
        facts.afterCancel.billingHtml.includes('Cancelled — access ends') &&
        !facts.afterCancel.billingHtml.includes('/billing/resume'),
      label: 'No resume offered by the app',
      fix: 'The billing page must show the cancelled state and offer no un-cancel action — the app flow has no resume route, so reversal can only happen in the Stripe dashboard.',
    },
    {
      ok: lapsedPlan === 'taster' && facts.afterLapse.billingHtml.includes('Taster'),
      label: 'Lapsed to Taster',
      fix: `Once the period lapsed the account must be on Taster — the stored record still grants ${lapsedPlan} and the billing page ${facts.afterLapse.billingHtml.includes('Taster') ? 'does' : 'does not'} show the Taster card.`,
    },
    {
      ok: facts.afterLapse.reportedAiTokens === limitsFor('taster', config).aiTokensPerMonth,
      label: 'Taster allowance',
      fix: `Expected the app to report ${numberFormat.format(limitsFor('taster', config).aiTokensPerMonth ?? 0)} AI tokens for Taster but it reported ${facts.afterLapse.reportedAiTokens ?? 'no readable'} allowance.`,
    },
  ];
}
