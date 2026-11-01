import { describe, expect, it, vi } from 'vitest';

import { createStripeClient, StripeError } from './stripe';

function client(respond: (url: string, init: RequestInit) => unknown, status = 200) {
  const calls: { url: string; method: string; body: string; stripeVersion: string | null }[] = [];
  const fetchImpl: typeof fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: String(init?.body ?? ''),
      stripeVersion: new Headers(init?.headers).get('Stripe-Version'),
    });
    return new Response(JSON.stringify(respond(String(url), init ?? {})), { status });
  });
  return {
    stripe: createStripeClient('test-stripe-key', fetchImpl, 'https://stripe.test/v1'),
    calls,
  };
}

describe('the Stripe client', () => {
  it('asks Checkout to hold the card, and only a card, so the UK check can come before the money moves', async () => {
    const { stripe, calls } = client(() => ({
      id: 'cs_1',
      url: 'https://checkout.stripe.test/cs_1',
    }));
    await stripe.createCheckoutSession({
      userId: 'u1',
      email: 'a@b.co',
      amountPence: 1000,
      creditPence: 819,
      successUrl: 'https://api.test/done',
      cancelUrl: 'https://api.test/cancel',
    });
    const form = new URLSearchParams(calls[0]!.body);
    expect(form.get('payment_intent_data[capture_method]')).toBe('manual');
    expect(form.get('payment_method_types[0]')).toBe('card');
    expect(form.get('billing_address_collection')).toBe('required');
    expect(form.has('managed_payments[enabled]')).toBe(false);
  });

  it('reads whether the money is held and where the card and address are', async () => {
    const { stripe, calls } = client(() => ({
      status: 'requires_capture',
      latest_charge: {
        billing_details: { address: { country: 'GB' } },
        payment_method_details: { card: { country: 'GB' } },
      },
    }));
    expect(await stripe.paymentFacts('pi_1')).toEqual({
      status: 'requires_capture',
      cardCountry: 'GB',
      billingCountry: 'GB',
    });
    expect(calls[0]!.url).toContain('/payment_intents/pi_1?expand[]=latest_charge');
  });

  it('captures and releases a held payment with POSTs to its own address', async () => {
    const { stripe, calls } = client(() => ({}));
    await stripe.capture('pi_1');
    await stripe.cancel('pi_2');
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['POST', 'https://stripe.test/v1/payment_intents/pi_1/capture'],
      ['POST', 'https://stripe.test/v1/payment_intents/pi_2/cancel'],
    ]);
  });

  it('lists completed checkouts since a time', async () => {
    const { stripe, calls } = client(() => ({
      data: [
        {
          id: 'cs_1',
          payment_status: 'unpaid',
          payment_intent: 'pi_1',
          currency: 'gbp',
          amount_total: 1000,
          metadata: { user_id: 'u1' },
          created: 1_760_000_000,
        },
      ],
    }));
    const sessions = await stripe.completedSessions(1_759_999_999.7);
    expect(sessions).toHaveLength(1);
    expect(calls[0]!.url).toContain('status=complete');
    expect(calls[0]!.url).toContain('created[gte]=1759999999');
  });

  it('follows pages until Stripe says there are no more', async () => {
    const page = (id: string, more: boolean) => ({
      has_more: more,
      data: [
        {
          id,
          payment_status: 'unpaid',
          payment_intent: 'pi_1',
          currency: 'gbp',
          amount_total: 500,
          metadata: null,
        },
      ],
    });
    const { stripe, calls } = client(() =>
      calls.length === 1 ? page('cs_1', true) : page('cs_2', false),
    );
    const sessions = await stripe.completedSessions(1_759_999_999);
    expect(sessions.map((session) => session.id)).toEqual(['cs_1', 'cs_2']);
    expect(calls[1]!.url).toContain('starting_after=cs_1');
  });

  it('keeps only Stripe’s short error code when a call fails', async () => {
    const { stripe } = client(
      () => ({ error: { code: 'payment_intent_unexpected_state', message: 'secret detail' } }),
      400,
    );
    const error = await stripe.capture('pi_1').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StripeError);
    if (!(error instanceof StripeError)) throw new Error('expected a StripeError');
    expect(error.code).toBe('payment_intent_unexpected_state');
    expect(error.message).not.toContain('secret');
  });
});

describe('the Stripe subscriptions client', () => {
  const catalogPrice = (overrides: Record<string, unknown> = {}) => ({
    id: 'price_core',
    lookup_key: 'hominem_core_monthly',
    active: true,
    currency: 'gbp',
    unit_amount: 999,
    tax_behavior: 'inclusive',
    type: 'recurring',
    recurring: { interval: 'month' },
    metadata: { tier: 'core', plan: 'monthly' },
    ...overrides,
  });
  const priceList = (price: unknown = catalogPrice()) => ({
    data: price ? [price] : [],
  });
  const subscriptionObject = {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    current_period_end: 1_800_000_000,
    cancel_at_period_end: false,
    metadata: { user_id: 'u1', tier: 'core', founding: 'true' },
    items: { data: [{ id: 'si_1', price: { unit_amount: 799, product: 'prod_1' } }] },
  };

  it('starts a monthly subscription Checkout at the public catalog Price', async () => {
    const { stripe, calls } = client((url) =>
      url.includes('/prices?')
        ? priceList()
        : { id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' },
    );
    await stripe.createSubscriptionCheckout({
      userId: 'u1',
      email: 'a@b.co',
      tier: 'core',
      pricePence: 999,
      founding: false,
      successUrl: 'https://api.test/billing/done',
      cancelUrl: 'https://api.test/billing/cancelled',
    });
    const form = new URLSearchParams(calls[1]!.body);
    expect(form.get('mode')).toBe('subscription');
    expect(form.get('line_items[0][price]')).toBe('price_core');
    expect(form.has('line_items[0][price_data][unit_amount]')).toBe(false);
    expect(form.get('subscription_data[metadata][user_id]')).toBe('u1');
    expect(form.get('subscription_data[metadata][founding]')).toBe('false');
    expect(form.has('payment_method_types[0]')).toBe(false);
    expect(form.get('managed_payments[enabled]')).toBe('true');
    expect(form.get('integration_identifier')).toMatch(/^hominem-subscription-[a-z]{8}$/);
    expect(calls[1]!.stripeVersion).toBe('2026-09-30.endive');
    const lookup = new URL(calls[0]!.url);
    expect(lookup.searchParams.get('lookup_keys[]')).toBe('hominem_core_monthly');
  });

  it('reads the fields the billing rules enforce', async () => {
    const { stripe } = client(() => subscriptionObject);
    expect(await stripe.subscription('sub_1')).toEqual({
      stripeSubscriptionId: 'sub_1',
      stripeCustomerId: 'cus_1',
      status: 'active',
      pricePence: 799,
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
      cancelAtPeriodEnd: false,
      userId: 'u1',
      tier: 'core',
      founding: true,
    });
  });

  it.each([
    ['core', 999, 'hominem_core_monthly'],
    ['rhodium', 1999, 'hominem_rhodium_monthly'],
    ['iridium', 3999, 'hominem_iridium_monthly'],
  ] as const)('resolves the %s catalog Price', async (tier, amountPence, key) => {
    const { stripe, calls } = client(() =>
      priceList({
        ...catalogPrice(),
        id: `price_${tier}`,
        lookup_key: key,
        unit_amount: amountPence,
        metadata: { tier, plan: 'monthly' },
      }),
    );
    expect(await stripe.resolveSubscriptionPrice(tier, amountPence)).toBe(`price_${tier}`);
    expect(new URL(calls[0]!.url).searchParams.get('lookup_keys[]')).toBe(key);
  });

  it('changes the plan on the subscription’s own item, with a real price and the new tier', async () => {
    const { stripe, calls } = client((url) =>
      url.includes('/prices?')
        ? priceList()
        : url.endsWith('/subscriptions/sub_1') && calls.some((call) => call.method === 'POST')
          ? {}
          : subscriptionObject,
    );
    await stripe.updateSubscriptionPlan('sub_1', 999, 'core');
    expect(calls.map((call) => [call.method, call.url])).toEqual([
      [
        'GET',
        'https://stripe.test/v1/prices?active=true&limit=100&lookup_keys%5B%5D=hominem_core_monthly',
      ],
      ['GET', 'https://stripe.test/v1/subscriptions/sub_1'],
      ['POST', 'https://stripe.test/v1/subscriptions/sub_1'],
    ]);
    const form = new URLSearchParams(calls[2]!.body);
    expect(form.get('items[0][id]')).toBe('si_1');
    expect(form.get('items[0][price]')).toBe('price_core');
    expect(form.get('metadata[tier]')).toBe('core');
    expect(calls.some((call) => call.url.endsWith('/prices'))).toBe(false);
  });

  it('uses the Founding Core catalog Price when a grandfathered subscriber returns to Core', async () => {
    const foundingPrice = catalogPrice({
      id: 'price_founding',
      lookup_key: 'hominem_founding_core_monthly',
      unit_amount: 799,
      metadata: { tier: 'core', plan: 'monthly', founding: 'true' },
    });
    const { stripe, calls } = client((url) =>
      url.includes('/prices?') ? priceList(foundingPrice) : subscriptionObject,
    );
    await stripe.updateSubscriptionPlan('sub_1', 799, 'core', true);
    expect(new URL(calls[0]!.url).searchParams.get('lookup_keys[]')).toBe(
      'hominem_founding_core_monthly',
    );
    expect(new URLSearchParams(calls[2]!.body).get('items[0][price]')).toBe('price_founding');
  });

  it.each([
    ['missing', null],
    ['inactive', catalogPrice({ active: false })],
    ['wrong tier', catalogPrice({ metadata: { tier: 'rhodium', plan: 'monthly' } })],
    ['wrong plan metadata', catalogPrice({ metadata: { tier: 'core', plan: 'yearly' } })],
    [
      'unexpected founding metadata',
      catalogPrice({ metadata: { tier: 'core', plan: 'monthly', founding: 'true' } }),
    ],
    ['wrong lookup key', catalogPrice({ lookup_key: 'hominem_rhodium_monthly' })],
    [
      'missing founding metadata',
      catalogPrice({
        lookup_key: 'hominem_founding_core_monthly',
        unit_amount: 799,
        metadata: { tier: 'core', plan: 'monthly' },
      }),
      true,
    ],
    ['wrong amount', catalogPrice({ unit_amount: 1000 })],
    ['tax-exclusive', catalogPrice({ tax_behavior: 'exclusive' })],
    ['unspecified tax behavior', catalogPrice({ tax_behavior: 'unspecified' })],
    ['wrong currency', catalogPrice({ currency: 'usd' })],
    ['non-monthly', catalogPrice({ recurring: { interval: 'year' } })],
  ])('fails closed for a %s catalog price', async (_name, price, founding = false) => {
    const { stripe } = client(() => priceList(price));
    await expect(
      stripe.resolveSubscriptionPrice('core', founding ? 799 : 999, founding),
    ).rejects.toMatchObject({
      code: 'subscription_price_invalid',
    });
  });

  it('fails closed when Stripe returns multiple prices for one lookup key', async () => {
    const { stripe } = client(() => ({
      data: [catalogPrice(), catalogPrice({ id: 'price_duplicate' })],
    }));
    await expect(stripe.resolveSubscriptionPrice('core', 999)).rejects.toMatchObject({
      code: 'subscription_price_invalid',
    });
  });

  it('cancels at the end of the period, not immediately', async () => {
    const { stripe, calls } = client(() => ({}));
    await stripe.cancelSubscriptionAtPeriodEnd('sub_1');
    expect(calls[0]!.method).toBe('POST');
    expect(new URLSearchParams(calls[0]!.body).get('cancel_at_period_end')).toBe('true');
  });

  it('ends a replaced subscription immediately when a new one takes over', async () => {
    const { stripe, calls } = client(() => ({}));
    await stripe.cancelSubscriptionNow('sub_old');
    expect(calls[0]!.method).toBe('DELETE');
    expect(calls[0]!.url).toBe('https://stripe.test/v1/subscriptions/sub_old');
  });

  it('reads the period from the subscription item on newer Stripe API versions', async () => {
    const { stripe } = client(() => ({
      ...subscriptionObject,
      current_period_end: undefined,
      items: {
        data: [
          {
            id: 'si_1',
            current_period_end: 1_800_000_001,
            price: { unit_amount: 999, product: 'prod_1' },
          },
        ],
      },
    }));
    const facts = await stripe.subscription('sub_1');
    expect(facts.currentPeriodEnd).toEqual(new Date(1_800_000_001 * 1000));
  });
});
