import type { BillingSubscriptionRecord } from '@hominem/db/billing';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BILLING_CONFIG,
  TIER_PRICES_PENCE,
  limitFor,
  limitsFor,
  planFor,
  planForMembership,
  pricePenceFor,
  usagePeriodStart,
  type BillingConfig,
} from './billing';

function subscription(
  overrides: Partial<BillingSubscriptionRecord> = {},
): BillingSubscriptionRecord {
  return {
    userId: 'u1',
    tier: 'core',
    status: 'active',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    pricePence: 999,
    founding: false,
    currentPeriodEnd: '2026-11-26T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    ...overrides,
  };
}

const now = new Date('2026-10-26T12:00:00.000Z');

describe('planFor', () => {
  it('is Taster without a subscription', () => {
    expect(planFor(null, now)).toBe('taster');
  });

  it('grants the paid tier while the paid period is live', () => {
    expect(planFor(subscription(), now)).toBe('core');
    expect(planFor(subscription({ tier: 'ai' }), now)).toBe('ai');
    expect(planFor(subscription({ status: 'trialing' }), now)).toBe('core');
  });

  it('grants Founding Core its locked plan', () => {
    expect(planFor(subscription({ founding: true, pricePence: 799 }), now)).toBe('founding_core');
  });

  it('keeps access until the period ends when the subscription is cancelled', () => {
    expect(planFor(subscription({ cancelAtPeriodEnd: true }), now)).toBe('core');
    expect(
      planFor(
        subscription({ cancelAtPeriodEnd: true, currentPeriodEnd: '2026-10-26T11:59:59.000Z' }),
        now,
      ),
    ).toBe('taster');
  });

  it('drops to Taster when the subscription is cancelled or the period lapses', () => {
    expect(planFor(subscription({ status: 'canceled' }), now)).toBe('taster');
    expect(planFor(subscription({ status: 'past_due' }), now)).toBe('taster');
    expect(planFor(subscription({ status: 'unpaid' }), now)).toBe('taster');
    expect(planFor(subscription({ currentPeriodEnd: '2026-10-01T00:00:00.000Z' }), now)).toBe(
      'taster',
    );
  });

  it('uses Osmium while an assigned membership is active, regardless of Stripe state', () => {
    expect(planForMembership(null, true, now)).toBe('osmium');
    expect(planForMembership(subscription({ status: 'canceled' }), true, now)).toBe('osmium');
    expect(planForMembership(subscription(), false, now)).toBe('core');
  });
});

describe('prices', () => {
  it('charges the decided prices', () => {
    expect(pricePenceFor('core', false)).toBe(999);
    expect(pricePenceFor('core', true)).toBe(799);
    expect(pricePenceFor('ai', false)).toBe(1999);
    expect(pricePenceFor('rhodium', false)).toBe(1999);
    expect(pricePenceFor('iridium', false)).toBe(3999);
    expect(TIER_PRICES_PENCE.taster).toBe(0);
    expect(TIER_PRICES_PENCE.osmium).toBe(0);
  });
});

describe('limits', () => {
  it('caps Taster and legacy conversation, while token-metering current paid tiers', () => {
    for (const plan of ['taster'] as const) {
      expect(limitsFor(plan).chatMessagesPerMonth).toBeGreaterThan(0);
      expect(Number.isFinite(limitsFor(plan).chatMessagesPerMonth)).toBe(true);
    }
    expect(limitsFor('core').chatMessagesPerMonth).toBeNull();
    expect(limitsFor('ai').chatMessagesPerMonth).toBeNull();
    expect(limitsFor('founding_core').chatMessagesPerMonth).toBeNull();
    expect(limitsFor('rhodium').chatMessagesPerMonth).toBeNull();
    expect(limitsFor('iridium').chatMessagesPerMonth).toBeNull();
    expect(limitFor('osmium', 'chat')).toBeNull();
    expect(limitsFor('core').aiTokensPerMonth).toBe(3_900_000);
    expect(limitsFor('founding_core').aiTokensPerMonth).toBe(3_900_000);
    expect(limitsFor('ai').aiTokensPerMonth).toBe(8_500_000);
    expect(limitsFor('rhodium').aiTokensPerMonth).toBe(8_500_000);
    expect(limitsFor('iridium').aiTokensPerMonth).toBe(18_000_000);
  });

  it('caps Taster skill volume but never caps paid skill volume', () => {
    expect(limitFor('taster', 'skill')).toBe(DEFAULT_BILLING_CONFIG.skillCalls.taster);
    expect(limitFor('core', 'skill')).toBeNull();
    expect(limitFor('ai', 'skill')).toBeNull();
    expect(limitFor('founding_core', 'skill')).toBeNull();
    expect(limitFor('osmium', 'skill')).toBeNull();
  });

  it('lets configuration change the caps without changing the rules', () => {
    const config: BillingConfig = {
      chatMessages: {
        taster: 5,
        core: null,
        ai: 500,
        founding_core: 50,
        rhodium: null,
        iridium: null,
        osmium: null,
      },
      skillCalls: {
        taster: 7,
        core: null,
        ai: null,
        founding_core: null,
        rhodium: null,
        iridium: null,
        osmium: null,
      },
      aiTokens: DEFAULT_BILLING_CONFIG.aiTokens,
      aiSpendUsd: DEFAULT_BILLING_CONFIG.aiSpendUsd,
    };
    expect(limitFor('taster', 'chat', config)).toBe(5);
    expect(limitFor('ai', 'chat', config)).toBe(500);
    expect(limitFor('taster', 'skill', config)).toBe(7);
  });
});

describe('usagePeriodStart', () => {
  it('is the first of the UTC month', () => {
    expect(usagePeriodStart(now).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(usagePeriodStart(new Date('2026-01-31T23:59:59.000Z')).toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });
});
