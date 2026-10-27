import { createHmac } from 'node:crypto';

import type {
  BillingSubscriptionRecord,
  BillingUsageKind,
  SaveBillingSubscriptionInput,
} from '@hominem/db/billing';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state: { subscription: BillingSubscriptionRecord | null } = { subscription: null };
  const usage: Array<{ userId: string; kind: BillingUsageKind }> = [];
  const stripe = {
    createSubscriptionCheckout: vi.fn(),
    subscription: vi.fn(),
    updateSubscriptionPlan: vi.fn(),
    cancelSubscriptionAtPeriodEnd: vi.fn(),
    cancelSubscriptionNow: vi.fn(),
  };
  return { state, usage, stripe, foundingSeats: { value: 0 } };
});

const SECRET = 'whsec_billing_test';

vi.mock('../../env', () => ({
  env: {
    API_URL: 'https://api.test',
    BILLING_AI_CHAT_MESSAGES: 3000,
    STRIPE_SECRET_KEY: 'sk_test_x',
  },
}));

vi.mock('../../application/billing.runtime', () => ({
  billingWebhookSecret: () => SECRET,
  billingDeps: () => ({
    store: {
      get: async () => mocks.state.subscription,
      save: async (input: SaveBillingSubscriptionInput) => {
        const record: BillingSubscriptionRecord = {
          userId: input.userId,
          tier: input.tier,
          status: input.status,
          stripeCustomerId: input.stripeCustomerId,
          stripeSubscriptionId: input.stripeSubscriptionId,
          pricePence: input.pricePence,
          founding: input.founding,
          currentPeriodEnd: input.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          createdAt: '2026-10-26T00:00:00.000Z',
          updatedAt: '2026-10-26T00:00:00.000Z',
        };
        mocks.state.subscription = record;
        return record;
      },
      countFoundingSeats: async () => mocks.foundingSeats.value,
      recordUsageWithinLimit: async (input: {
        userId: string;
        kind: BillingUsageKind;
        limit: number;
      }) => {
        const used = mocks.usage.filter(
          (event) => event.userId === input.userId && event.kind === input.kind,
        ).length;
        if (used >= input.limit) return false;
        mocks.usage.push({ userId: input.userId, kind: input.kind });
        return true;
      },
      recordUsage: async (input: { userId: string; kind: BillingUsageKind }) => {
        mocks.usage.push(input);
      },
      usageCount: async (input: { userId: string; kind: BillingUsageKind }) =>
        mocks.usage.filter((event) => event.userId === input.userId && event.kind === input.kind)
          .length,
    },
    stripe: mocks.stripe,
    config: {
      chatMessages: { taster: 50, core: 1000, ai: 3000, founding_core: 1000 },
      skillCalls: { taster: 500, core: null, ai: null, founding_core: null },
    },
  }),
}));

import { billingRoutes } from './index';

const USER = { id: 'u1', email: 'a@b.co', name: 'Dana' };

function app(authenticated = true) {
  const shell = new Hono<{ Variables: { auth?: unknown } }>();
  if (authenticated) {
    shell.use('*', async (c, next) => {
      c.set('auth', {
        userId: USER.id,
        user: { ...USER, emailVerified: true, createdAt: '', updatedAt: '', image: null },
        credential: 'session',
        scopes: [],
      });
      await next();
    });
  }
  return shell.route('/', billingRoutes);
}

function subscription(
  overrides: Partial<BillingSubscriptionRecord> = {},
): BillingSubscriptionRecord {
  return {
    userId: USER.id,
    tier: 'core',
    status: 'active',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    pricePence: 999,
    founding: false,
    currentPeriodEnd: '2099-11-26T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    ...overrides,
  };
}

function form(body: Record<string, string>) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.subscription = null;
  mocks.usage.length = 0;
  mocks.foundingSeats.value = 0;
  mocks.stripe.createSubscriptionCheckout.mockResolvedValue({
    id: 'cs_1',
    url: 'https://checkout.stripe.test/cs_1',
  });
  mocks.stripe.updateSubscriptionPlan.mockResolvedValue(undefined);
  mocks.stripe.cancelSubscriptionAtPeriodEnd.mockResolvedValue(undefined);
});

describe('GET /billing', () => {
  it('sends a signed-out visitor through hosted login and back', async () => {
    const response = await app(false).request('/billing');
    expect(response.status).toBe(303);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('/login');
    expect(decodeURIComponent(location)).toContain('/billing');
  });

  it('shows all four prices on the free tier', async () => {
    const response = await app().request('/billing');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const page = await response.text();
    expect(page).toContain('Taster');
    expect(page).toContain('£7.99');
    expect(page).toContain('£9.99');
    expect(page).toContain('£19.99');
    expect(page).toContain('0 of 50 messages this month');
  });

  it('shows the current plan, usage, and cancellation date for a subscriber', async () => {
    mocks.state.subscription = subscription({ cancelAtPeriodEnd: true });
    const page = await (await app().request('/billing')).text();
    expect(page).toContain('Core plan');
    expect(page).toContain('Cancelled — access ends');
    expect(page).toContain('£9.99 per month');
  });
});

describe('POST /billing/checkout', () => {
  it('starts a Core subscription at £9.99 when the founding seats are gone', async () => {
    mocks.foundingSeats.value = 100;
    const response = await app().request('/billing/checkout', form({ tier: 'core' }));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://checkout.stripe.test/cs_1');
    expect(mocks.stripe.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'core', pricePence: 999, founding: false }),
    );
  });

  it('charges £7.99 while founding seats remain', async () => {
    mocks.foundingSeats.value = 99;
    await app().request('/billing/checkout', form({ tier: 'core' }));
    expect(mocks.stripe.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ pricePence: 799, founding: true }),
    );
  });

  it('refuses a second subscription for someone already paying', async () => {
    mocks.state.subscription = subscription();
    const response = await app().request('/billing/checkout', form({ tier: 'ai' }));
    expect(response.status).toBe(409);
    expect(mocks.stripe.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('rejects an unknown tier without calling Stripe', async () => {
    const response = await app().request('/billing/checkout', form({ tier: 'platinum' }));
    expect(response.status).toBe(400);
    expect(mocks.stripe.createSubscriptionCheckout).not.toHaveBeenCalled();
  });
});

describe('POST /billing/change and /billing/cancel', () => {
  it('downgrades AI to Core', async () => {
    mocks.state.subscription = subscription({ tier: 'ai', pricePence: 1999 });
    const response = await app().request('/billing/change', form({ tier: 'core' }));
    expect(response.status).toBe(303);
    expect(mocks.stripe.updateSubscriptionPlan).toHaveBeenCalledWith('sub_1', 999, 'core');
    expect(mocks.state.subscription?.tier).toBe('core');
  });

  it('cancels at the end of the period', async () => {
    mocks.state.subscription = subscription();
    const response = await app().request('/billing/cancel', form({}));
    expect(response.status).toBe(303);
    expect(mocks.stripe.cancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith('sub_1');
    expect(mocks.state.subscription?.cancelAtPeriodEnd).toBe(true);
  });

  it('refuses to change or cancel when there is no paid subscription', async () => {
    expect((await app().request('/billing/change', form({ tier: 'core' }))).status).toBe(400);
    expect((await app().request('/billing/cancel', form({}))).status).toBe(400);
  });
});

describe('POST /webhooks/stripe/billing', () => {
  function signed(body: string, secret = SECRET) {
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    return { 'stripe-signature': `t=${t},v1=${v1}` };
  }

  const event = JSON.stringify({
    type: 'customer.subscription.created',
    data: { object: { id: 'sub_1' } },
  });

  it('rejects a bad signature and writes nothing', async () => {
    const response = await app(false).request('/webhooks/stripe/billing', {
      method: 'POST',
      headers: signed(event, 'whsec_wrong'),
      body: event,
    });
    expect(response.status).toBe(400);
    expect(mocks.stripe.subscription).not.toHaveBeenCalled();
  });

  it('applies a verified subscription event', async () => {
    mocks.stripe.subscription.mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      stripeCustomerId: 'cus_1',
      status: 'active',
      pricePence: 999,
      currentPeriodEnd: new Date('2099-11-26T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      userId: USER.id,
      tier: 'core',
      founding: false,
    });
    const response = await app(false).request('/webhooks/stripe/billing', {
      method: 'POST',
      headers: signed(event),
      body: event,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.state.subscription?.tier).toBe('core');
  });

  it('accepts an event it does not act on', async () => {
    const other = JSON.stringify({ type: 'invoice.paid', data: { object: { id: 'in_1' } } });
    const response = await app(false).request('/webhooks/stripe/billing', {
      method: 'POST',
      headers: signed(other),
      body: other,
    });
    expect(response.status).toBe(200);
    expect(mocks.stripe.subscription).not.toHaveBeenCalled();
  });
});
