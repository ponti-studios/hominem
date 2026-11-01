/**
 * The little of Stripe that top-up needs, over plain HTTPS so there is no SDK to install and the
 * webhook rules can be tested with signed sample events.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

const DEFAULT_BASE = 'https://api.stripe.com/v1';
const MANAGED_PAYMENTS_API_VERSION = '2026-09-30.endive';
const INTEGRATION_IDENTIFIER_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function integrationIdentifier(): string {
  const suffix = Array.from(
    randomBytes(8),
    (byte) => INTEGRATION_IDENTIFIER_ALPHABET[byte % INTEGRATION_IDENTIFIER_ALPHABET.length],
  ).join('');
  return `hominem-subscription-${suffix}`;
}

export class StripeError extends Error {
  constructor(
    readonly what: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(`Stripe ${what} failed (${status})`);
    this.name = 'StripeError';
  }
}

export interface CheckoutInput {
  userId: string;
  email: string;
  amountPence: number;
  creditPence: number;
  successUrl: string;
  cancelUrl: string;
}

/** What the top-up rules need to know about a payment: whether the money is only held, and where the card and address are. */
export interface PaymentFacts {
  /** `requires_capture` while the money is held, `succeeded` once taken, `canceled` once released. */
  status: string;
  cardCountry: string | null;
  billingCountry: string | null;
}

/** A completed Checkout Session, as far as the top-up rules read it. */
export const checkoutSessionSchema = z.object({
  id: z.string().min(1),
  payment_status: z.string(),
  payment_intent: z.string().nullable(),
  currency: z.string().nullable(),
  amount_total: z.number().int().nullable(),
  metadata: z.record(z.string(), z.string()).nullable(),
  /** Unix seconds; present on Stripe's own objects. */
  created: z.number().int().optional(),
});
export type CheckoutSession = z.infer<typeof checkoutSessionSchema>;

export interface StripeClient {
  createCheckoutSession(input: CheckoutInput): Promise<{ id: string; url: string }>;
  paymentFacts(paymentIntentId: string): Promise<PaymentFacts>;
  /** Takes the money from a held payment. */
  capture(paymentIntentId: string): Promise<void>;
  /** Releases a held payment: nothing is charged and Stripe takes no fee. */
  cancel(paymentIntentId: string): Promise<void>;
  /** Refunds a payment that was already taken. */
  refund(paymentIntentId: string): Promise<void>;
  /** Checkouts completed since a time, newest first, for finding payments a webhook never settled. */
  completedSessions(sinceUnix: number): Promise<CheckoutSession[]>;
}

/** A subscription Checkout, or the subscription itself, reduced to what the billing rules read. */
export interface SubscriptionCheckoutInput {
  userId: string;
  email: string;
  tier: 'core' | 'rhodium' | 'iridium';
  pricePence: number;
  founding: boolean;
  successUrl: string;
  cancelUrl: string;
}

export interface SubscriptionFacts {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: string;
  pricePence: number;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  userId: string | null;
  tier: 'core' | 'ai' | 'rhodium' | 'iridium' | null;
  founding: boolean;
}

/**
 * The subscription slice of Stripe. Kept separate from `StripeClient` so the top-up doubles and
 * tests that only settle payments don't have to grow four unused methods.
 */
export interface StripeSubscriptionsClient {
  createSubscriptionCheckout(
    input: SubscriptionCheckoutInput,
  ): Promise<{ id: string; url: string }>;
  subscription(subscriptionId: string): Promise<SubscriptionFacts>;
  /** Moves the subscription to `tier` at its matching catalog price. */
  updateSubscriptionPlan(
    subscriptionId: string,
    pricePence: number,
    tier: 'core' | 'rhodium' | 'iridium',
    founding?: boolean,
  ): Promise<void>;
  cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<void>;
  /** Ends a subscription immediately, for an older one a new checkout has replaced. */
  cancelSubscriptionNow(subscriptionId: string): Promise<void>;
}

/** Stripe's subscription object, as far as billing reads it. */
const subscriptionItemSchema = z.object({
  id: z.string().min(1),
  // Stripe moved the period onto the item in API 2025-03-31.basil; older accounts still send the
  // subscription-level field. Both are optional here and the mapper requires one of them.
  current_period_end: z.number().int().nullable().optional(),
  price: z.object({
    unit_amount: z.number().int().nullable(),
    product: z
      .union([z.string(), z.object({ id: z.string().min(1) })])
      .nullable()
      .optional(),
  }),
});

const subscriptionSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  customer: z.union([z.string(), z.object({ id: z.string().min(1) })]),
  current_period_end: z.number().int().nullable().optional(),
  cancel_at_period_end: z.boolean().nullable().optional(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
  items: z.object({ data: z.array(subscriptionItemSchema).min(1) }),
});

function toSubscriptionFacts(subscription: z.infer<typeof subscriptionSchema>): SubscriptionFacts {
  const metadata = subscription.metadata ?? {};
  const tier =
    metadata.tier === 'core' ||
    metadata.tier === 'ai' ||
    metadata.tier === 'rhodium' ||
    metadata.tier === 'iridium'
      ? metadata.tier
      : null;
  const item = subscription.items.data[0];
  const periodEnd = subscription.current_period_end ?? item?.current_period_end ?? null;
  if (periodEnd === null) {
    throw new StripeError('read subscription', 200, 'subscription_period_end_missing');
  }
  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    status: subscription.status,
    pricePence: item?.price.unit_amount ?? 0,
    currentPeriodEnd: new Date(periodEnd * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    userId: metadata.user_id && metadata.user_id.length > 0 ? metadata.user_id : null,
    tier,
    founding: metadata.founding === 'true',
  };
}

const catalogPriceSchema = z.object({
  id: z.string().min(1),
  lookup_key: z.string().nullable(),
  active: z.boolean(),
  currency: z.string(),
  unit_amount: z.number().int().nullable(),
  type: z.string(),
  recurring: z.object({ interval: z.string() }).nullable(),
  metadata: z.record(z.string(), z.string()),
});

const CATALOG_PRICES = {
  core: { key: 'hominem_core_monthly', tier: 'core' },
  rhodium: { key: 'hominem_rhodium_monthly', tier: 'rhodium' },
  iridium: { key: 'hominem_iridium_monthly', tier: 'iridium' },
  founding_core: { key: 'hominem_founding_core_monthly', tier: 'core' },
} as const;

/** A safety stop on pagination: 2,000 completed Checkouts in the sweep window. */
const MAX_SESSION_PAGES = 20;

const sessionSchema = z.object({ id: z.string().min(1), url: z.string().url() });
const intentSchema = z.object({
  status: z.string(),
  latest_charge: z
    .object({
      billing_details: z.object({
        address: z.object({ country: z.string().nullable() }).nullable(),
      }),
      payment_method_details: z.object({
        card: z.object({ country: z.string().nullable() }).nullable().optional(),
      }),
    })
    .nullable(),
});

export function createStripeClient(
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
  base: string = DEFAULT_BASE,
): StripeClient &
  StripeSubscriptionsClient & {
    resolveSubscriptionPrice(
      tier: 'core' | 'rhodium' | 'iridium',
      amountPence: number,
      founding?: boolean,
    ): Promise<string>;
  } {
  async function call(
    what: string,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    form?: URLSearchParams,
    stripeVersion?: string,
  ) {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(stripeVersion ? { 'Stripe-Version': stripeVersion } : {}),
        ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: form?.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // Only Stripe's short error code is kept; the body can hold customer details.
      const failure = await response.json().catch(() => null);
      const code = z.object({ error: z.object({ code: z.string() }) }).safeParse(failure);
      throw new StripeError(what, response.status, code.success ? code.data.error.code : null);
    }
    const body: unknown = await response.json();
    return body;
  }

  async function resolveSubscriptionPrice(
    tier: 'core' | 'rhodium' | 'iridium',
    amountPence: number,
    founding = false,
  ): Promise<string> {
    const expected =
      tier === 'core' && founding ? CATALOG_PRICES.founding_core : CATALOG_PRICES[tier];
    const query = new URLSearchParams({ active: 'true', limit: '100' });
    query.append('lookup_keys[]', expected.key);
    const result = z
      .object({ data: z.array(catalogPriceSchema) })
      .safeParse(await call('list subscription prices', 'GET', `/prices?${query.toString()}`));
    if (!result.success) {
      throw new StripeError('resolve subscription price', 200, 'subscription_price_invalid');
    }
    const [price] = result.data.data;
    const foundingMetadataValid =
      expected.key === CATALOG_PRICES.founding_core.key
        ? price?.metadata.founding === 'true'
        : price?.metadata.founding === undefined || price.metadata.founding === 'false';
    if (
      result.data.data.length !== 1 ||
      !price?.active ||
      price.lookup_key !== expected.key ||
      price.currency !== 'gbp' ||
      price.unit_amount !== amountPence ||
      price.type !== 'recurring' ||
      price.recurring?.interval !== 'month' ||
      price.metadata.tier !== expected.tier ||
      price.metadata.plan !== 'monthly' ||
      !foundingMetadataValid
    ) {
      throw new StripeError('resolve subscription price', 200, 'subscription_price_invalid');
    }
    return price.id;
  }

  return {
    resolveSubscriptionPrice,
    async createCheckoutSession(input) {
      const form = new URLSearchParams({
        mode: 'payment',
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'gbp',
        'line_items[0][price_data][unit_amount]': String(input.amountPence),
        'line_items[0][price_data][product_data][name]': 'Thames credit',
        'payment_method_types[0]': 'card',
        // Only a card can be held and then released or taken, which the UK-only rule relies on.
        'payment_intent_data[capture_method]': 'manual',
        billing_address_collection: 'required',
        'custom_text[submit][message]':
          'You asked for your credit to be added as soon as you pay. Once it is added, you lose your 14-day right to cancel.',
        customer_email: input.email,
        client_reference_id: input.userId,
        'metadata[user_id]': input.userId,
        'metadata[amount_pence]': String(input.amountPence),
        'metadata[credit_pence]': String(input.creditPence),
        'payment_intent_data[metadata][user_id]': input.userId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      });
      return sessionSchema.parse(
        await call('create checkout session', 'POST', '/checkout/sessions', form),
      );
    },

    async paymentFacts(paymentIntentId) {
      const intent = intentSchema.parse(
        await call(
          'read payment',
          'GET',
          `/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`,
        ),
      );
      const charge = intent.latest_charge;
      return {
        status: intent.status,
        cardCountry: charge?.payment_method_details.card?.country ?? null,
        billingCountry: charge?.billing_details.address?.country ?? null,
      };
    },

    async capture(paymentIntentId) {
      await call(
        'capture',
        'POST',
        `/payment_intents/${encodeURIComponent(paymentIntentId)}/capture`,
        new URLSearchParams(),
      );
    },

    async cancel(paymentIntentId) {
      await call(
        'cancel',
        'POST',
        `/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`,
        new URLSearchParams(),
      );
    },

    async completedSessions(sinceUnix) {
      const sessions: CheckoutSession[] = [];
      let after: string | null = null;
      // Stripe returns at most 100 a page; follow `has_more` so a busy week never hides an older hold.
      for (let page = 0; page < MAX_SESSION_PAGES; page += 1) {
        const cursor: string = after ? `&starting_after=${encodeURIComponent(after)}` : '';
        const list = z
          .object({ data: z.array(checkoutSessionSchema), has_more: z.boolean().optional() })
          .parse(
            await call(
              'list checkouts',
              'GET',
              `/checkout/sessions?status=complete&limit=100&created[gte]=${Math.floor(sinceUnix)}${cursor}`,
            ),
          );
        sessions.push(...list.data);
        const last = list.data.at(-1);
        if (!list.has_more || !last) break;
        after = last.id;
      }
      return sessions;
    },

    async refund(paymentIntentId) {
      await call(
        'refund',
        'POST',
        '/refunds',
        new URLSearchParams({ payment_intent: paymentIntentId }),
      );
    },

    async createSubscriptionCheckout(input) {
      const priceId = await resolveSubscriptionPrice(input.tier, input.pricePence, input.founding);
      const form = new URLSearchParams({
        mode: 'subscription',
        'managed_payments[enabled]': 'true',
        integration_identifier: integrationIdentifier(),
        'line_items[0][quantity]': '1',
        'line_items[0][price]': priceId,
        customer_email: input.email,
        client_reference_id: input.userId,
        'subscription_data[metadata][user_id]': input.userId,
        'subscription_data[metadata][tier]': input.tier,
        'subscription_data[metadata][founding]': input.founding ? 'true' : 'false',
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      });
      return sessionSchema.parse(
        await call(
          'create subscription checkout',
          'POST',
          '/checkout/sessions',
          form,
          MANAGED_PAYMENTS_API_VERSION,
        ),
      );
    },

    async subscription(subscriptionId) {
      return toSubscriptionFacts(
        subscriptionSchema.parse(
          await call(
            'read subscription',
            'GET',
            `/subscriptions/${encodeURIComponent(subscriptionId)}`,
          ),
        ),
      );
    },

    async updateSubscriptionPlan(subscriptionId, pricePence, tier, founding = false) {
      const priceId = await resolveSubscriptionPrice(tier, pricePence, founding);
      const current = subscriptionSchema.parse(
        await call(
          'read subscription',
          'GET',
          `/subscriptions/${encodeURIComponent(subscriptionId)}`,
        ),
      );
      const item = current.items.data[0];
      if (!item) {
        throw new StripeError('read subscription', 200, 'subscription_product_missing');
      }
      await call(
        'update subscription',
        'POST',
        `/subscriptions/${encodeURIComponent(subscriptionId)}`,
        new URLSearchParams({
          'items[0][id]': item.id,
          'items[0][price]': priceId,
          // The webhook derives entitlement from the subscription metadata.
          'metadata[tier]': tier,
          // Change now, charging or crediting the difference on the next invoice.
          proration_behavior: 'create_prorations',
        }),
      );
    },

    async cancelSubscriptionAtPeriodEnd(subscriptionId) {
      await call(
        'cancel subscription',
        'POST',
        `/subscriptions/${encodeURIComponent(subscriptionId)}`,
        new URLSearchParams({ cancel_at_period_end: 'true' }),
      );
    },

    async cancelSubscriptionNow(subscriptionId) {
      await call(
        'cancel subscription',
        'DELETE',
        `/subscriptions/${encodeURIComponent(subscriptionId)}`,
      );
    },
  };
}

/**
 * Checks a webhook's `Stripe-Signature` header (`t=<unix>,v1=<hex>`) against the raw body and the
 * endpoint's secret, and rejects an old timestamp.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  now: Date,
  toleranceSeconds = 300,
): boolean {
  if (!header) return false;
  const parts = header.split(',').map((part): [string, string] => {
    const at = part.indexOf('=');
    return at < 0 ? [part, ''] : [part.slice(0, at), part.slice(at + 1)];
  });
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(Math.floor(now.getTime() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const expected = Buffer.from(
    createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex'),
  );
  return signatures.some((signature) => {
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
