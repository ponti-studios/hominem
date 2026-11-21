import type { BillingSubscriptionRecord } from '@hominem/db/billing';
import { describe, expect, it } from 'vitest';

import { verifyStripeTestOutcome, type StripeTestObservation } from './stripe-test-verify';

function subscription(
  overrides: Partial<BillingSubscriptionRecord> = {},
): BillingSubscriptionRecord {
  return {
    userId: 'u1',
    tier: 'core',
    status: 'active',
    stripeCustomerId: 'cus_test',
    stripeSubscriptionId: 'sub_test',
    pricePence: 999,
    founding: false,
    currentPeriodEnd: '2026-12-21T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    createdAt: '2026-11-21T12:00:00.000Z',
    updatedAt: '2026-11-21T12:00:00.000Z',
    ...overrides,
  };
}

function observation(overrides: Partial<StripeTestObservation> = {}): StripeTestObservation {
  return {
    subscription: subscription(),
    reportedAiTokens: 3_900_000,
    ...overrides,
  };
}

describe('verifyStripeTestOutcome', () => {
  it('passes for a completed Core checkout at the catalog price', () => {
    const findings = verifyStripeTestOutcome('core', observation());

    expect(findings.every((finding) => finding.ok)).toBe(true);
  });

  it('passes for a completed Rhodium checkout at 19.99 with the 8.5M allowance', () => {
    const findings = verifyStripeTestOutcome(
      'rhodium',
      observation({
        subscription: subscription({ tier: 'rhodium', pricePence: 1999 }),
        reportedAiTokens: 8_500_000,
      }),
    );

    expect(findings.every((finding) => finding.ok)).toBe(true);
  });

  it('passes for a completed Iridium checkout at 39.99 with the 18M allowance', () => {
    const findings = verifyStripeTestOutcome(
      'iridium',
      observation({
        subscription: subscription({ tier: 'iridium', pricePence: 3999 }),
        reportedAiTokens: 18_000_000,
      }),
    );

    expect(findings.every((finding) => finding.ok)).toBe(true);
  });

  it('fails when no subscription landed and names the webhook as the suspect', () => {
    const findings = verifyStripeTestOutcome('core', observation({ subscription: null }));

    const failure = findings.find((finding) => !finding.ok);
    expect(failure?.fix).toContain('webhook');
  });

  it('fails on a tier mismatch and names the tier that was purchased', () => {
    const findings = verifyStripeTestOutcome(
      'rhodium',
      observation({ subscription: subscription({ tier: 'core', pricePence: 999 }) }),
    );

    const failure = findings.find((finding) => !finding.ok);
    expect(failure?.fix).toContain('core');
    expect(failure?.fix).toContain('rhodium');
  });

  it('fails when the subscription is not active', () => {
    const findings = verifyStripeTestOutcome(
      'core',
      observation({ subscription: subscription({ status: 'past_due' }) }),
    );

    expect(findings.some((finding) => !finding.ok)).toBe(true);
  });

  it('fails when an ordinary checkout mints a founding seat', () => {
    const findings = verifyStripeTestOutcome(
      'core',
      observation({ subscription: subscription({ founding: true, pricePence: 799 }) }),
    );

    const failure = findings.find((finding) => !finding.ok);
    expect(failure?.fix).toContain('founding');
  });

  it('fails when the stored price is not the catalog price for the tier', () => {
    const findings = verifyStripeTestOutcome(
      'core',
      observation({ subscription: subscription({ pricePence: 1999 }) }),
    );

    const failure = findings.find((finding) => !finding.ok);
    expect(failure?.fix).toContain('999');
  });

  it('fails when the app reports a different allowance than the plan grants', () => {
    const findings = verifyStripeTestOutcome('core', observation({ reportedAiTokens: 1_000_000 }));

    const failure = findings.find((finding) => !finding.ok);
    expect(failure?.fix).toContain('3,900,000');
  });

  it('fails when the allowance could not be read from the app at all', () => {
    const findings = verifyStripeTestOutcome('core', observation({ reportedAiTokens: null }));

    expect(findings.some((finding) => !finding.ok)).toBe(true);
  });
});
