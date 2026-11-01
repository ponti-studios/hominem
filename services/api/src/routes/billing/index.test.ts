import { createHmac, randomUUID } from 'node:crypto';

import type {
  BillingMembershipRecord,
  BillingSubscriptionRecord,
  BillingUsageKind,
  SaveBillingSubscriptionInput,
} from '@hominem/db/billing';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state: {
    subscription: BillingSubscriptionRecord | null;
    membership: BillingMembershipRecord | null;
  } = { subscription: null, membership: null };
  const aiUsage = {
    totalCostUsd: 4,
    limitUsd: 10,
    remainingUsd: 6,
    isOverLimit: false,
    totalTokens: 400_000,
    periodStart: '2026-10-01T00:00:00.000Z',
    periodEnd: '2026-11-01T00:00:00.000Z',
  };
  const usage: Array<{ userId: string; kind: BillingUsageKind }> = [];
  const stripe = {
    createSubscriptionCheckout: vi.fn(),
    subscription: vi.fn(),
    updateSubscriptionPlan: vi.fn(),
    cancelSubscriptionAtPeriodEnd: vi.fn(),
    cancelSubscriptionNow: vi.fn(),
  };
  const store = {
    get: async () => state.subscription,
    getOsmiumMembership: async () => state.membership,
    grantOsmiumMembership: async (input: { userId: string; grantedByUserId: string }) => {
      state.membership = {
        ...input,
        tier: 'osmium',
        grantedAt: '2026-10-26T00:00:00.000Z',
      };
      return state.membership;
    },
    revokeOsmiumMembership: async () => false,
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
      state.subscription = record;
      return record;
    },
    recordUsageWithinLimit: async (input: {
      userId: string;
      kind: BillingUsageKind;
      limit: number;
    }) => {
      const used = usage.filter(
        (event) => event.userId === input.userId && event.kind === input.kind,
      ).length;
      if (used >= input.limit) return false;
      usage.push({ userId: input.userId, kind: input.kind });
      return true;
    },
    recordUsage: async (input: { userId: string; kind: BillingUsageKind }) => {
      usage.push(input);
    },
    usageCount: async (input: { userId: string; kind: BillingUsageKind }) =>
      usage.filter((event) => event.userId === input.userId && event.kind === input.kind).length,
  };
  const config = {
    chatMessages: {
      taster: 50,
      core: null,
      ai: null,
      founding_core: null,
      rhodium: null,
      iridium: null,
      osmium: null,
    },
    skillCalls: {
      taster: 500,
      core: null,
      ai: null,
      founding_core: null,
      rhodium: null,
      iridium: null,
      osmium: null,
    },
    aiTokens: {
      taster: 1_000_000,
      core: 3_900_000,
      ai: 3_000_000,
      founding_core: 3_900_000,
      rhodium: 8_500_000,
      iridium: 18_000_000,
      osmium: null,
    },
    aiSpendUsd: {
      taster: 10,
      core: 2.5,
      ai: 10,
      founding_core: 2.5,
      rhodium: 5.45,
      iridium: 11.4,
      osmium: null,
    },
  };
  return { state, aiUsage, usage, stripe, store, config };
});

// Generated per run: the webhook code only needs a shared opaque value to sign with.
const SIGNING_KEY = randomUUID();

vi.mock('../../env', () => ({
  env: {
    API_URL: 'https://api.test',
  },
}));

vi.mock('../../application/billing.runtime', () => ({
  billingWebhookSecret: () => SIGNING_KEY,
  billingRules: () => ({ store: mocks.store, config: mocks.config }),
  billingDeps: () => ({ store: mocks.store, stripe: mocks.stripe, config: mocks.config }),
}));

vi.mock('../../application/ai-usage.service', () => ({
  getMonthlyUsageStatus: async () => mocks.aiUsage,
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
  mocks.state.membership = null;
  Object.assign(mocks.aiUsage, {
    totalCostUsd: 4,
    limitUsd: 10,
    remainingUsd: 6,
    isOverLimit: false,
  });
  mocks.usage.length = 0;
  mocks.stripe.createSubscriptionCheckout.mockResolvedValue({
    id: 'cs_1',
    url: 'https://checkout.stripe.test/cs_1',
  });
  mocks.stripe.updateSubscriptionPlan.mockResolvedValue(undefined);
  mocks.stripe.cancelSubscriptionAtPeriodEnd.mockResolvedValue(undefined);
});

describe('GET /account/billing', () => {
  it('redirects the former billing URL to the account route', async () => {
    const response = await app().request('/billing?from=old-link');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/account/billing?from=old-link');
  });

  it('sends a signed-out visitor through hosted login and back', async () => {
    const response = await app(false).request('/account/billing');
    expect(response.status).toBe(303);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('/login');
    expect(decodeURIComponent(location)).toContain('/account/billing');
  });

  it('shows Taster and one Core offer on the free tier', async () => {
    const response = await app().request('/account/billing');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const page = await response.text();
    expect(page).toContain('Taster');
    expect(page).toContain('£9.99');
    expect(page).not.toContain('Founding Core');
    expect(page).not.toContain('>AI<');
    expect(page.match(/>Subscribe<\/button>/g)).toHaveLength(3);
    expect(page).toContain('£19.99');
    expect(page).toContain('£39.99');
    expect(page).toContain('class="card rhodium-plan"');
    expect(page).toContain('class="card iridium-plan"');
    expect(page).toContain('<small>45</small><strong>Rh</strong>');
    expect(page).toContain('<small>77</small><strong>Ir</strong>');
    expect(page).toContain('<h1 id="billing-title">Your plan</h1>');
    expect(page).toContain('href="/account/usage"');
    expect(page).not.toContain('Usage this month');
    expect(page).toContain('500 MCP tool calls a month');
    expect(page).toContain('class="billing-page"');
    expect(page).not.toContain('Plans / Monthly');
    expect(page).toContain('background: #0a0a0a; color: #fff');
    expect(page).toContain('action="/billing/checkout"');
  });

  it('shows the distinctive complimentary Osmium membership', async () => {
    mocks.state.membership = {
      userId: USER.id,
      tier: 'osmium',
      grantedByUserId: 'admin-1',
      grantedAt: '2026-10-26T00:00:00.000Z',
    };
    const response = await app().request('/account/billing');
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain('Osmium Membership');
    expect(page).toContain('Your Osmium membership is complimentary and unlimited.');
    expect(page).toContain('osmium-seal');
    expect(page).not.toContain('Subscribe');
  });

  it('shows the current plan, usage, and cancellation date for a subscriber', async () => {
    mocks.state.subscription = subscription({ cancelAtPeriodEnd: true });
    const page = await (await app().request('/account/billing')).text();
    expect(page).toContain('Your current plan.');
    expect(page).toContain('Core');
    expect(page).toContain('Cancelled — access ends');
    expect(page).toContain('£9.99 per month');
    expect(page).not.toContain('Every MCP tool invocation uses one call.');
  });

  it('gives Founding Core its iron-core surface and seal', async () => {
    mocks.state.subscription = subscription({ pricePence: 799, founding: true });
    const page = await (await app().request('/account/billing')).text();

    expect(page).toContain('class="card current-plan founding-core-plan"');
    expect(page).toContain('class="metal-seal founding-core-seal"');
    expect(page).toContain('<small>26</small><strong>Fe</strong>');
    expect(page).toContain('radial-gradient(ellipse at 86% 18%');
  });

  it('keeps cancellation controls for an active paid subscriber', async () => {
    mocks.state.subscription = subscription();
    const page = await (await app().request('/account/billing')).text();

    expect(page).toContain('<button type="submit">Cancel</button>');
    expect(page).not.toContain('billing-manage');
  });
});

describe('GET /account/usage', () => {
  it('returns a signed-out visitor to usage after hosted login', async () => {
    const response = await app(false).request('/account/usage');
    expect(response.status).toBe(303);
    expect(decodeURIComponent(response.headers.get('location') ?? '')).toContain('/account/usage');
  });

  it('shows AI allowance and MCP usage in one AI-first stacked panel without raw spend or messages', async () => {
    const response = await app().request('/account/usage');
    expect(response.status).toBe(200);
    const page = await response.text();
    expect(page).toContain('href="/account/usage"');
    expect(page).toContain('MCP tool calls');
    expect(page).toContain('AI allowance');
    expect(page).toContain('40% used');
    expect(page).toContain('60% remaining');
    expect(page).toContain('max="100" value="40"');
    expect(page.indexOf('AI allowance')).toBeLessThan(page.indexOf('MCP tool calls'));
    expect(page).not.toContain('Messages');
    expect(page).not.toContain('AI spend');
    expect(page).not.toContain('$4.00');
    expect(page).not.toContain('View AI usage details');
  });

  it('shows unlimited AI allowance without a progress meter for Osmium', async () => {
    mocks.state.membership = {
      userId: USER.id,
      tier: 'osmium',
      grantedByUserId: 'admin-1',
      grantedAt: '2026-10-26T00:00:00.000Z',
    };
    const page = await (await app().request('/account/usage')).text();

    expect(page).toContain('AI allowance');
    expect(page).toContain('Unlimited');
    expect(page).not.toContain('<progress');
    expect(page).not.toContain('$4.00');
  });
});

describe('POST /billing/checkout', () => {
  it('refuses checkout for Osmium members', async () => {
    mocks.state.membership = {
      userId: USER.id,
      tier: 'osmium',
      grantedByUserId: 'admin-1',
      grantedAt: '2026-10-26T00:00:00.000Z',
    };
    const response = await app().request('/billing/checkout', form({ tier: 'core' }));
    expect(response.status).toBe(403);
    expect(mocks.stripe.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('starts a Core subscription at £9.99 when the founding seats are gone', async () => {
    const response = await app().request('/billing/checkout', form({ tier: 'core' }));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://checkout.stripe.test/cs_1');
    expect(mocks.stripe.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'core', pricePence: 999, founding: false }),
    );
  });

  it('does not issue new Founding Core prices', async () => {
    await app().request('/billing/checkout', form({ tier: 'core' }));
    expect(mocks.stripe.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ pricePence: 999, founding: false }),
    );
  });

  it('refuses a second subscription for someone already paying', async () => {
    mocks.state.subscription = subscription();
    const response = await app().request('/billing/checkout', form({ tier: 'core' }));
    expect(response.status).toBe(409);
    expect(mocks.stripe.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('rejects an unknown tier without calling Stripe', async () => {
    const response = await app().request('/billing/checkout', form({ tier: 'platinum' }));
    expect(response.status).toBe(400);
    expect(mocks.stripe.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('rejects AI as a new subscription', async () => {
    const response = await app().request('/billing/checkout', form({ tier: 'ai' }));
    expect(response.status).toBe(400);
    expect(mocks.stripe.createSubscriptionCheckout).not.toHaveBeenCalled();
  });
});

describe('POST /billing/change and /billing/cancel', () => {
  it('downgrades AI to Core', async () => {
    mocks.state.subscription = subscription({ tier: 'ai', pricePence: 1999 });
    const response = await app().request('/billing/change', form({ tier: 'core' }));
    expect(response.status).toBe(303);
    expect(mocks.stripe.updateSubscriptionPlan).toHaveBeenCalledWith('sub_1', 999, 'core', false);
    expect(mocks.state.subscription?.tier).toBe('core');
  });

  it('renders the branded recovery page when Stripe cannot change a plan', async () => {
    mocks.state.subscription = subscription({ tier: 'ai', pricePence: 1999 });
    mocks.stripe.updateSubscriptionPlan.mockRejectedValueOnce(new Error('Stripe unavailable'));

    const response = await app().request('/billing/change', form({ tier: 'core' }));
    const page = await response.text();

    expect(response.status).toBe(400);
    expect(page).toContain('class="billing-error"');
    expect(page).toContain('Could not change the plan.');
    expect(page).toContain('The plan change didn’t complete.');
    expect(page).toContain('href="/account/billing"');
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

describe('GET /billing/done', () => {
  it('renders the Labs-style checkout confirmation without claiming the webhook has finished', async () => {
    const response = await app().request('/billing/done');
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(page).toContain('Checkout complete');
    expect(page).toContain("font-family: 'JetBrains Mono'");
    expect(page).toContain('Your Hominem account is updating now');
    expect(page).not.toContain('Your new plan is active now');
    expect(page).toContain('href="/account/billing"');
  });
});

describe('POST /webhooks/stripe/billing', () => {
  function signed(body: string, secret = SIGNING_KEY) {
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
      headers: signed(event, randomUUID()),
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

  it('accepts a retried subscription event without duplicating its billing state', async () => {
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

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await app(false).request('/webhooks/stripe/billing', {
        method: 'POST',
        headers: signed(event),
        body: event,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: true });
    }

    expect(mocks.stripe.subscription).toHaveBeenCalledTimes(2);
    expect(mocks.state.subscription).toMatchObject({
      stripeSubscriptionId: 'sub_1',
      tier: 'core',
      status: 'active',
    });
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
