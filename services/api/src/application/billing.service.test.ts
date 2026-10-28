import type {
  BillingSubscriptionRecord,
  BillingUsageKind,
  SaveBillingSubscriptionInput,
} from '@hominem/db/billing';
import { ForbiddenError } from '@hominem/db/errors';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_BILLING_CONFIG } from './billing';
import {
  assertBillingUsage,
  billingState,
  cancelPlan,
  changePlan,
  handleBillingEvent,
  startSubscriptionCheckout,
  type BillingDeps,
  type BillingStore,
} from './billing.service';
import type { SubscriptionFacts } from './stripe';

const now = new Date('2026-10-26T12:00:00.000Z');
const nowFn = () => now;

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

interface MemoryStore extends BillingStore {
  saved: BillingSubscriptionRecord | null;
  usage: Array<{ userId: string; kind: BillingUsageKind }>;
  /** Set to simulate a founding seat lost to a simultaneous signup. */
  denyFounding: boolean;
}

function memoryStore(initial: BillingSubscriptionRecord | null = null): MemoryStore {
  let current = initial;
  const store: MemoryStore = {
    saved: initial,
    usage: [],
    denyFounding: false,
    async get() {
      return current;
    },
    async save(input: SaveBillingSubscriptionInput) {
      const record = subscription({
        ...input,
        currentPeriodEnd: input.currentPeriodEnd.toISOString(),
        founding: input.founding && !store.denyFounding,
      });
      current = record;
      store.saved = record;
      return record;
    },
    async recordUsageWithinLimit(input) {
      const used = store.usage.filter(
        (event) => event.userId === input.userId && event.kind === input.kind,
      ).length;
      if (used >= input.limit) return false;
      store.usage.push({ userId: input.userId, kind: input.kind });
      return true;
    },
    async recordUsage(input) {
      store.usage.push(input);
    },
    async usageCount(input) {
      return store.usage.filter(
        (event) => event.userId === input.userId && event.kind === input.kind,
      ).length;
    },
  };
  return store;
}

function stripe(overrides: Partial<BillingDeps['stripe']> = {}): BillingDeps['stripe'] {
  return {
    createSubscriptionCheckout: vi.fn(async () => ({
      id: 'cs_1',
      url: 'https://stripe.test/cs_1',
    })),
    subscription: vi.fn(),
    updateSubscriptionPlan: vi.fn(async () => undefined),
    cancelSubscriptionAtPeriodEnd: vi.fn(async () => undefined),
    cancelSubscriptionNow: vi.fn(async () => undefined),
    ...overrides,
  };
}

function deps(store: BillingStore, overrides: Partial<BillingDeps['stripe']> = {}): BillingDeps {
  return {
    store,
    stripe: stripe(overrides),
    config: DEFAULT_BILLING_CONFIG,
    now: nowFn,
  };
}

function facts(overrides: Partial<SubscriptionFacts> = {}): SubscriptionFacts {
  return {
    stripeSubscriptionId: 'sub_1',
    stripeCustomerId: 'cus_1',
    status: 'active',
    pricePence: 999,
    currentPeriodEnd: new Date('2026-11-26T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    userId: 'u1',
    tier: 'core',
    founding: false,
    ...overrides,
  };
}

describe('assertBillingUsage', () => {
  it('blocks a Taster at the message limit, and lets exactly the limit through', async () => {
    const store = memoryStore();
    const billing = deps(store);
    const limit = DEFAULT_BILLING_CONFIG.chatMessages.taster;

    for (let sent = 0; sent < limit; sent += 1) {
      await expect(assertBillingUsage(billing, 'u1', 'chat')).resolves.toBe('taster');
    }
    // At the limit: the next message is the one that is blocked.
    await expect(assertBillingUsage(billing, 'u1', 'chat')).rejects.toBeInstanceOf(ForbiddenError);
    expect(store.usage.filter((event) => event.kind === 'chat')).toHaveLength(limit);
  });

  it('caps skill calls as a volume, without looking at the capability domain', async () => {
    const store = memoryStore();
    const billing = deps(store);
    const limit = DEFAULT_BILLING_CONFIG.skillCalls.taster ?? 0;

    for (let call = 0; call < limit; call += 1) {
      await expect(assertBillingUsage(billing, 'u1', 'skill')).resolves.toBe('taster');
    }
    await expect(assertBillingUsage(billing, 'u1', 'skill')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('records administrator usage without applying monthly caps', async () => {
    const store = memoryStore();
    const billing = deps(store);

    for (let call = 0; call < 501; call += 1) {
      await expect(
        assertBillingUsage(billing, 'u1', 'skill', undefined, { isAdmin: true }),
      ).resolves.toBe('taster');
    }
    for (let message = 0; message < 51; message += 1) {
      await expect(
        assertBillingUsage(billing, 'u1', 'chat', undefined, { isAdmin: true }),
      ).resolves.toBe('taster');
    }

    expect(store.usage).toHaveLength(552);
  });

  it('gives Core and AI uncapped skill volume but still caps their conversation', async () => {
    for (const plan of ['core', 'ai'] as const) {
      const store = memoryStore(subscription({ tier: plan }));
      const billing = deps(store);
      const cap = DEFAULT_BILLING_CONFIG.chatMessages[plan];

      for (let call = 0; call < 50; call += 1) {
        await expect(assertBillingUsage(billing, 'u1', 'skill')).resolves.toBe(plan);
      }
      for (let sent = 0; sent < cap; sent += 1) {
        await expect(assertBillingUsage(billing, 'u1', 'chat')).resolves.toBe(plan);
      }
      await expect(assertBillingUsage(billing, 'u1', 'chat')).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    }
  });

  it('is back on Taster once the subscription is cancelled', async () => {
    const store = memoryStore(subscription({ status: 'canceled' }));
    const billing = deps(store);
    await expect(assertBillingUsage(billing, 'u1', 'chat')).resolves.toBe('taster');
    expect(store.usage).toHaveLength(1);
  });
});

describe('billingState', () => {
  it('reports the plan, caps, and this month’s usage', async () => {
    const store = memoryStore(subscription({ tier: 'ai' }));
    await store.recordUsage({ userId: 'u1', kind: 'chat' });
    const state = await billingState(deps(store), 'u1');
    expect(state.plan).toBe('ai');
    expect(state.limits.chatMessagesPerMonth).toBe(DEFAULT_BILLING_CONFIG.chatMessages.ai);
    expect(state.usage.chatMessages).toBe(1);
    expect(state.usage.skillCalls).toBe(0);
    expect(state.periodStart).toBe('2026-10-01T00:00:00.000Z');
  });

  it('reports no usage caps for an administrator', async () => {
    const state = await billingState(deps(memoryStore()), 'u1', now, { isAdmin: true });
    expect(state.limits).toEqual({ chatMessagesPerMonth: null, skillCallsPerMonth: null });
  });
});

describe('startSubscriptionCheckout', () => {
  it('charges £9.99 for Core even when legacy founding seats remain', async () => {
    const store = memoryStore();
    const billing = deps(store);
    const outcome = await startSubscriptionCheckout(billing, {
      userId: 'u1',
      email: 'a@b.co',
      tier: 'core',
      origin: 'https://api.test',
    });
    expect(outcome).toEqual({ kind: 'started', url: 'https://stripe.test/cs_1' });
    expect(billing.stripe.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'core',
        pricePence: 999,
        founding: false,
        successUrl: 'https://api.test/billing/done?session_id={CHECKOUT_SESSION_ID}',
      }),
    );
  });

  it('does not start a second subscription for someone already paying', async () => {
    const store = memoryStore(subscription());
    const outcome = await startSubscriptionCheckout(deps(store), {
      userId: 'u1',
      email: 'a@b.co',
      tier: 'core',
      origin: 'https://api.test',
    });
    expect(outcome).toEqual({ kind: 'already_subscribed' });
  });
});

describe('handleBillingEvent', () => {
  it('applies a created subscription and a later downgrade', async () => {
    const store = memoryStore();
    const billing = deps(store, {
      subscription: vi
        .fn()
        .mockResolvedValueOnce(facts({ tier: 'ai', pricePence: 1999 }))
        .mockResolvedValueOnce(facts({ tier: 'core', pricePence: 999 })),
    });

    const created = await handleBillingEvent(billing, {
      type: 'customer.subscription.created',
      data: { object: { id: 'sub_1' } },
    });
    expect(created).toMatchObject({ kind: 'applied', subscription: { tier: 'ai' } });

    const downgraded = await handleBillingEvent(billing, {
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1' } },
    });
    expect(downgraded).toMatchObject({ kind: 'applied', subscription: { tier: 'core' } });
    expect((await billingState(billing, 'u1')).plan).toBe('core');
  });

  it('drops paid access when Stripe says the subscription is deleted', async () => {
    const store = memoryStore(subscription());
    const billing = deps(store, {
      subscription: vi.fn(async () => facts({ status: 'canceled' })),
    });
    await handleBillingEvent(billing, {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1' } },
    });
    expect((await billingState(billing, 'u1')).plan).toBe('taster');
  });

  it('reprices a founding seat lost to a simultaneous signup', async () => {
    const store = memoryStore();
    store.denyFounding = true;
    const billing = deps(store, {
      subscription: vi.fn(async () => facts({ pricePence: 799, founding: true })),
    });
    const outcome = await handleBillingEvent(billing, {
      type: 'customer.subscription.created',
      data: { object: { id: 'sub_1' } },
    });
    expect(billing.stripe.updateSubscriptionPlan).toHaveBeenCalledWith('sub_1', 999, 'core');
    expect(outcome).toMatchObject({ kind: 'applied', subscription: { pricePence: 999 } });
    expect(store.saved?.founding).toBe(false);
  });

  it('ends the previous live subscription when a new checkout completes', async () => {
    const store = memoryStore(subscription({ stripeSubscriptionId: 'sub_old' }));
    const billing = deps(store, {
      subscription: vi.fn(async () => facts({ stripeSubscriptionId: 'sub_new' })),
    });

    await handleBillingEvent(billing, {
      type: 'customer.subscription.created',
      data: { object: { id: 'sub_new' } },
    });

    expect(billing.stripe.cancelSubscriptionNow).toHaveBeenCalledWith('sub_old');
    expect(store.saved?.stripeSubscriptionId).toBe('sub_new');
  });

  it('ignores events that are not about subscriptions, and subscriptions with no owner', async () => {
    const store = memoryStore();
    const billing = deps(store, { subscription: vi.fn(async () => facts({ userId: null })) });
    expect(
      await handleBillingEvent(billing, { type: 'invoice.paid', data: { object: {} } }),
    ).toEqual({ kind: 'ignored' });
    expect(
      await handleBillingEvent(billing, {
        type: 'customer.subscription.created',
        data: { object: { id: 'sub_1' } },
      }),
    ).toEqual({ kind: 'ignored' });
    expect(store.saved).toBeNull();
  });
});

describe('changePlan and cancelPlan', () => {
  it('downgrades AI to Core immediately, at the Core price', async () => {
    const store = memoryStore(subscription({ tier: 'ai', pricePence: 1999 }));
    const billing = deps(store);
    const changed = await changePlan(billing, 'u1', 'core');
    expect(billing.stripe.updateSubscriptionPlan).toHaveBeenCalledWith('sub_1', 999, 'core');
    expect(changed.tier).toBe('core');
    expect((await billingState(billing, 'u1')).plan).toBe('core');
    expect((await billingState(billing, 'u1')).limits.chatMessagesPerMonth).toBe(
      DEFAULT_BILLING_CONFIG.chatMessages.core,
    );
  });

  it('keeps the founding price when its holder changes tier', async () => {
    const store = memoryStore(subscription({ founding: true, pricePence: 799 }));
    const billing = deps(store);
    const changed = await changePlan(billing, 'u1', 'core');
    expect(billing.stripe.updateSubscriptionPlan).toHaveBeenCalledWith('sub_1', 799, 'core');
    expect(changed.founding).toBe(true);
  });

  it('cancels at the end of the paid period without taking access away early', async () => {
    const store = memoryStore(subscription());
    const billing = deps(store);
    const cancelled = await cancelPlan(billing, 'u1');
    expect(billing.stripe.cancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith('sub_1');
    expect(cancelled.cancelAtPeriodEnd).toBe(true);
    expect((await billingState(billing, 'u1')).plan).toBe('core');
  });
});
