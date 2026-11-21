import type { BillingSubscriptionRecord } from '@hominem/db/billing';
import { describe, expect, it } from 'vitest';

import { verifyStripeLapseOutcome, type StripeLapseObservation } from './stripe-lapse-verify';
import type { StripeTestObservation } from './stripe-test-verify';

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

/** The billing page after /billing/cancel: the cancelled notice, and no un-cancel route. */
const CANCELLED_HTML =
  'Your plan Cancelled — access ends 21 December. Your current plan. Subscribe Core £9.99/mo';

/** The billing page once the period has lapsed: the Taster card, and no paid plan. */
const TASTER_HTML = 'Your plan Taster Your current plan. Subscribe Core £9.99/mo';

function afterCreate(overrides: Partial<StripeTestObservation> = {}): StripeTestObservation {
  return { subscription: subscription(), reportedAiTokens: 3_900_000, ...overrides };
}

function observation(overrides: Partial<StripeLapseObservation> = {}): StripeLapseObservation {
  return {
    subscription: subscription({ cancelAtPeriodEnd: true }),
    reportedAiTokens: 3_900_000,
    billingHtml: CANCELLED_HTML,
    ...overrides,
  };
}

function facts(
  overrides: Partial<Parameters<typeof verifyStripeLapseOutcome>[0]> = {},
): Parameters<typeof verifyStripeLapseOutcome>[0] {
  return {
    now: new Date('2026-12-22T00:00:00.000Z'),
    afterCreate: afterCreate(),
    afterCancel: observation(),
    afterLapse: {
      subscription: subscription({ status: 'canceled', cancelAtPeriodEnd: true }),
      reportedAiTokens: 1_000_000,
      billingHtml: TASTER_HTML,
    },
    ...overrides,
  };
}

describe('verifyStripeLapseOutcome', () => {
  it('passes for a clock-driven subscription that cancels, keeps access, then lapses to Taster', () => {
    const findings = verifyStripeLapseOutcome(facts());

    expect(failures(findings)).toEqual([]);
  });

  it('reuses the completed-checkout assertions for the paid state before the cancel', () => {
    const findings = verifyStripeLapseOutcome(
      facts({ afterCreate: afterCreate({ subscription: null }) }),
    );

    expect(failures(findings)).toContain('Webhook delivery');
  });

  it('fails when the cancel does not stop the renewal', () => {
    const findings = verifyStripeLapseOutcome(
      facts({
        afterCancel: observation({
          subscription: subscription({ cancelAtPeriodEnd: false }),
        }),
      }),
    );

    expect(failures(findings)).toContain('Cancellation at period end');
  });

  it('fails when cancelling downgrades early instead of retaining the paid period', () => {
    const findings = verifyStripeLapseOutcome(
      facts({ afterCancel: observation({ reportedAiTokens: 1_000_000 }) }),
    );

    expect(failures(findings)).toContain('Access retained through the paid period');
  });

  it('fails when the app offers a resume action after cancelling', () => {
    const findings = verifyStripeLapseOutcome(
      facts({
        afterCancel: observation({
          billingHtml: `${CANCELLED_HTML} <form action="/billing/resume">Resume</form>`,
        }),
      }),
    );

    expect(failures(findings)).toContain('No resume offered by the app');
  });

  it('fails when the cancelled notice never rendered', () => {
    const findings = verifyStripeLapseOutcome(
      facts({ afterCancel: observation({ billingHtml: 'Your plan Core Renews 21 December.' }) }),
    );

    expect(failures(findings)).toContain('No resume offered by the app');
  });

  it('fails when the period lapsed but the account stays on the paid plan', () => {
    const findings = verifyStripeLapseOutcome(
      facts({
        now: new Date('2026-11-22T00:00:00.000Z'),
        afterLapse: {
          subscription: subscription({ cancelAtPeriodEnd: true }),
          reportedAiTokens: 3_900_000,
          billingHtml: CANCELLED_HTML,
        },
      }),
    );

    expect(failures(findings)).toContain('Lapsed to Taster');
  });

  it('fails when the lapse never reached the Taster card on the billing page', () => {
    const findings = verifyStripeLapseOutcome(
      facts({
        afterLapse: {
          subscription: subscription({ status: 'canceled', cancelAtPeriodEnd: true }),
          reportedAiTokens: 1_000_000,
          billingHtml: CANCELLED_HTML,
        },
      }),
    );

    expect(failures(findings)).toContain('Lapsed to Taster');
  });

  it('fails when the lapsed account reports the paid allowance instead of the Taster one', () => {
    const findings = verifyStripeLapseOutcome(
      facts({
        afterLapse: {
          subscription: subscription({ status: 'canceled', cancelAtPeriodEnd: true }),
          reportedAiTokens: 3_900_000,
          billingHtml: TASTER_HTML,
        },
      }),
    );

    expect(failures(findings)).toContain('Taster allowance');
  });
});

function failures(findings: ReturnType<typeof verifyStripeLapseOutcome>) {
  return findings.filter((finding) => !finding.ok).map((finding) => finding.label);
}
