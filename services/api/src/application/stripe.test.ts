import { describe, expect, it, vi } from 'vitest';

import { createStripeClient, StripeError } from './stripe';

function client(respond: (url: string, init: RequestInit) => unknown, status = 200) {
  const calls: { url: string; method: string; body: string }[] = [];
  const fetchImpl: typeof fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: String(init?.body ?? ''),
    });
    return new Response(JSON.stringify(respond(String(url), init ?? {})), { status });
  });
  return { stripe: createStripeClient('sk_test_x', fetchImpl, 'https://stripe.test/v1'), calls };
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
  const subscriptionObject = {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    current_period_end: 1_800_000_000,
    cancel_at_period_end: false,
    metadata: { user_id: 'u1', tier: 'core', founding: 'true' },
    items: { data: [{ id: 'si_1', price: { unit_amount: 799 } }] },
  };

  it('starts a monthly subscription Checkout at the decided price', async () => {
    const { stripe, calls } = client(() => ({
      id: 'cs_1',
      url: 'https://checkout.stripe.test/cs_1',
    }));
    await stripe.createSubscriptionCheckout({
      userId: 'u1',
      email: 'a@b.co',
      tier: 'core',
      pricePence: 799,
      founding: true,
      successUrl: 'https://api.test/billing/done',
      cancelUrl: 'https://api.test/billing/cancelled',
    });
    const form = new URLSearchParams(calls[0]!.body);
    expect(form.get('mode')).toBe('subscription');
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('799');
    expect(form.get('line_items[0][price_data][recurring][interval]')).toBe('month');
    expect(form.get('subscription_data[metadata][user_id]')).toBe('u1');
    expect(form.get('subscription_data[metadata][founding]')).toBe('true');
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

  it('changes the plan on the subscription’s own item', async () => {
    const { stripe, calls } = client(() => subscriptionObject);
    await stripe.updateSubscriptionPlan('sub_1', 999);
    expect(calls.map((call) => call.method)).toEqual(['GET', 'POST']);
    const form = new URLSearchParams(calls[1]!.body);
    expect(form.get('items[0][id]')).toBe('si_1');
    expect(form.get('items[0][price_data][unit_amount]')).toBe('999');
  });

  it('cancels at the end of the period, not immediately', async () => {
    const { stripe, calls } = client(() => ({}));
    await stripe.cancelSubscriptionAtPeriodEnd('sub_1');
    expect(calls[0]!.method).toBe('POST');
    expect(new URLSearchParams(calls[0]!.body).get('cancel_at_period_end')).toBe('true');
  });
});
