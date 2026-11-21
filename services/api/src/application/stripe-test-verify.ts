/**
 * Assertions for a completed hosted Test Mode checkout (docs/billing-test-plan.md). Pure: the
 * calling script observes the stored subscription and the app-reported allowance, this module
 * judges them against the billing rules, so the end-to-end assertions are themselves tested.
 */
import type { BillingSubscriptionRecord } from '@hominem/db/billing';

import { DEFAULT_BILLING_CONFIG, limitsFor, pricePenceFor, type BillingConfig } from './billing';

/** The tiers `just stripe-test` can drive a hosted checkout for. */
export type StripeTestTier = 'core' | 'rhodium' | 'iridium';

export interface StripeTestObservation {
  subscription: BillingSubscriptionRecord | null;
  /** The AI-token allowance the app itself reports for the account, or null when unreadable. */
  reportedAiTokens: number | null;
}

export interface StripeTestFinding {
  ok: boolean;
  label: string;
  fix: string;
}

const numberFormat = new Intl.NumberFormat('en-GB');

export function verifyStripeTestOutcome(
  tier: StripeTestTier,
  observed: StripeTestObservation,
  config: BillingConfig = DEFAULT_BILLING_CONFIG,
): StripeTestFinding[] {
  const expectedPence = pricePenceFor(tier, false);
  const expectedAiTokens = limitsFor(tier, config).aiTokensPerMonth;
  const subscription = observed.subscription;
  return [
    {
      ok: subscription !== null,
      label: 'Webhook delivery',
      fix: 'No subscription record landed — the billing webhook never arrived. Is just billing stripe-listen running, and does BILLING_STRIPE_WEBHOOK_SECRET match its printed whsec_...?',
    },
    {
      ok: subscription?.tier === tier,
      label: 'Purchased tier',
      fix: `Expected a ${tier} subscription but the record says ${subscription?.tier ?? 'none'}.`,
    },
    {
      ok: subscription?.status === 'active',
      label: 'Active status',
      fix: `Subscription status is ${subscription?.status ?? 'absent'}; a completed checkout must be active.`,
    },
    {
      ok: subscription?.founding === false,
      label: 'No founding seat',
      fix: 'An ordinary checkout must not set the founding flag — founding seats come only from the Founding Core offer.',
    },
    {
      ok: subscription?.pricePence === expectedPence,
      label: 'Catalog price',
      fix: `Expected the ${tier} catalog price of ${expectedPence} pence but the record says ${subscription?.pricePence ?? 'none'}.`,
    },
    {
      ok: observed.reportedAiTokens !== null && observed.reportedAiTokens === expectedAiTokens,
      label: 'AI token allowance',
      fix:
        expectedAiTokens === null
          ? `The ${tier} plan has no AI-token cap in this configuration, but the app reported ${observed.reportedAiTokens ?? 'no readable'} allowance.`
          : observed.reportedAiTokens === null
            ? `Could not read the allowance from the app surface; ${tier} grants ${numberFormat.format(expectedAiTokens)} AI tokens.`
            : `Expected the app to report ${numberFormat.format(expectedAiTokens)} AI tokens for ${tier} but it reported ${numberFormat.format(observed.reportedAiTokens)}.`,
    },
  ];
}
