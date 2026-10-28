/**
 * The billing workflow: what a person is entitled to, starting a subscription, changing or
 * cancelling one, and applying what Stripe reports. The rules themselves live in billing.ts;
 * this file is the glue to the store and Stripe, and everything within it is testable with doubles.
 */
import {
  type BillingStatus,
  type BillingSubscriptionRecord,
  type BillingUsageKind,
  type SaveBillingSubscriptionInput,
} from '@hominem/db/billing';

import { ForbiddenError, ValidationError } from '../errors';
import {
  TIER_PRICES_PENCE,
  limitFor,
  limitsFor,
  planFor,
  pricePenceFor,
  usagePeriodStart,
  type BillingConfig,
  type BillingLimits,
  type BillingTier,
  type Plan,
} from './billing';
import type { StripeSubscriptionsClient, SubscriptionFacts } from './stripe';

export interface BillingStore {
  get(userId: string): Promise<BillingSubscriptionRecord | null>;
  save(input: SaveBillingSubscriptionInput): Promise<BillingSubscriptionRecord>;
  recordUsageWithinLimit(input: {
    userId: string;
    kind: BillingUsageKind;
    since: Date;
    limit: number;
  }): Promise<boolean>;
  recordUsage(input: { userId: string; kind: BillingUsageKind }): Promise<void>;
  usageCount(input: { userId: string; kind: BillingUsageKind; since: Date }): Promise<number>;
}

export interface BillingDeps {
  store: BillingStore;
  stripe: StripeSubscriptionsClient;
  config: BillingConfig;
  now?: () => Date;
  log?: (event: string, fields: Record<string, unknown>) => void;
}

export type BillingRulesDeps = Pick<BillingDeps, 'store' | 'config' | 'now'>;

export interface BillingState {
  plan: Plan;
  subscription: BillingSubscriptionRecord | null;
  limits: BillingLimits;
  usage: { chatMessages: number; skillCalls: number };
  periodStart: string;
}

const PLAN_LABELS: Record<Plan, string> = {
  taster: 'Taster',
  core: 'Core',
  ai: 'AI',
  founding_core: 'Founding Core',
};

const BILLING_STATUSES: readonly BillingStatus[] = [
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused',
];

function isBillingStatus(value: string): value is BillingStatus {
  return BILLING_STATUSES.some((status) => status === value);
}

function clock(deps: { now?: () => Date }): Date {
  return (deps.now ?? (() => new Date()))();
}

/** The plan, its limits, and how much of this month's volume is already used. */
export async function billingState(
  deps: BillingRulesDeps,
  userId: string,
  now: Date = clock(deps),
): Promise<BillingState> {
  const subscription = await deps.store.get(userId);
  const plan = planFor(subscription, now);
  const periodStart = usagePeriodStart(now);
  const [chatMessages, skillCalls] = await Promise.all([
    deps.store.usageCount({ userId, kind: 'chat', since: periodStart }),
    deps.store.usageCount({ userId, kind: 'skill', since: periodStart }),
  ]);
  return {
    plan,
    subscription,
    limits: limitsFor(plan, deps.config),
    usage: { chatMessages, skillCalls },
    periodStart: periodStart.toISOString(),
  };
}

/**
 * Records one billable interaction if the plan has room for it. Throws a 403 the person can act on
 * (upgrade) when the monthly volume is used up. Never checks the capability's domain: a plan is
 * blocked by volume, never by domain.
 */
export async function assertBillingUsage(
  deps: BillingRulesDeps,
  userId: string,
  kind: BillingUsageKind,
  now: Date = clock(deps),
): Promise<Plan> {
  const subscription = await deps.store.get(userId);
  const plan = planFor(subscription, now);
  const limit = limitFor(plan, kind, deps.config);
  if (limit === null) {
    await deps.store.recordUsage({ userId, kind });
    return plan;
  }
  const allowed = await deps.store.recordUsageWithinLimit({
    userId,
    kind,
    since: usagePeriodStart(now),
    limit,
  });
  if (!allowed) {
    const what = kind === 'chat' ? 'messages' : 'skill calls';
    throw new ForbiddenError(
      `You've reached the ${PLAN_LABELS[plan]} plan's monthly limit of ${limit} ${what}.`,
      { plan, kind, limit },
    );
  }
  return plan;
}

export type CheckoutOutcome = { kind: 'started'; url: string } | { kind: 'already_subscribed' };

/** Starts a Core subscription Checkout at the current public price. */
export async function startSubscriptionCheckout(
  deps: BillingDeps,
  input: { userId: string; email: string; tier: 'core'; origin: string; now?: Date },
): Promise<CheckoutOutcome> {
  const now = input.now ?? clock(deps);
  const existing = await deps.store.get(input.userId);
  if (planFor(existing, now) !== 'taster') return { kind: 'already_subscribed' };

  const session = await deps.stripe.createSubscriptionCheckout({
    userId: input.userId,
    email: input.email,
    tier: input.tier,
    pricePence: TIER_PRICES_PENCE.core,
    founding: false,
    successUrl: `${input.origin}/billing/done?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${input.origin}/billing/cancelled`,
  });
  return { kind: 'started', url: session.url };
}

/**
 * Writes what Stripe says about a subscription. A legacy founding seat that a simultaneous signup
 * took is repriced to Core before it is stored, so nobody keeps £7.99 by losing a race.
 */
async function applySubscription(
  deps: BillingDeps,
  facts: SubscriptionFacts,
): Promise<BillingSubscriptionRecord | null> {
  if (!facts.userId || !facts.tier || !isBillingStatus(facts.status)) return null;
  // A second completed Checkout replaces the first subscription. End the old one at Stripe too, or
  // it keeps renewing and /billing/cancel only knows about the newest one.
  const previous = await deps.store.get(facts.userId);
  if (
    previous &&
    previous.stripeSubscriptionId !== facts.stripeSubscriptionId &&
    ['active', 'trialing', 'past_due'].includes(previous.status)
  ) {
    try {
      await deps.stripe.cancelSubscriptionNow(previous.stripeSubscriptionId);
    } catch (error) {
      deps.log?.('billing_previous_subscription_cancel_failed', {
        subscriptionId: previous.stripeSubscriptionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const wantsFounding =
    facts.tier === 'core' && facts.founding && facts.pricePence === TIER_PRICES_PENCE.founding_core;
  const base = {
    userId: facts.userId,
    tier: facts.tier,
    status: facts.status,
    stripeCustomerId: facts.stripeCustomerId,
    stripeSubscriptionId: facts.stripeSubscriptionId,
    currentPeriodEnd: facts.currentPeriodEnd,
    cancelAtPeriodEnd: facts.cancelAtPeriodEnd,
  };
  let saved = await deps.store.save({
    ...base,
    pricePence: facts.pricePence,
    founding: wantsFounding,
  });
  if (wantsFounding && !saved.founding) {
    const pricePence = pricePenceFor('core', false);
    await deps.stripe.updateSubscriptionPlan(facts.stripeSubscriptionId, pricePence, 'core');
    saved = await deps.store.save({ ...base, pricePence, founding: false });
  }
  return saved;
}

export type BillingEventOutcome =
  | { kind: 'applied'; subscription: BillingSubscriptionRecord }
  | { kind: 'ignored' };

const SUBSCRIPTION_EVENT_TYPES: readonly string[] = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

/** Applies one Stripe event. Anything that is not a subscription event is ignored, not an error. */
export async function handleBillingEvent(
  deps: BillingDeps,
  event: { type?: unknown; data?: { object?: unknown } },
): Promise<BillingEventOutcome> {
  if (typeof event.type !== 'string' || !SUBSCRIPTION_EVENT_TYPES.includes(event.type)) {
    return { kind: 'ignored' };
  }
  const object = event.data?.object;
  const id =
    typeof object === 'object' && object !== null && 'id' in object ? object.id : undefined;
  if (typeof id !== 'string' || id.length === 0) return { kind: 'ignored' };
  const facts = await deps.stripe.subscription(id);
  const subscription = await applySubscription(deps, facts);
  return subscription ? { kind: 'applied', subscription } : { kind: 'ignored' };
}

/** Changes a live subscription's tier now (AI to Core is the downgrade). */
export async function changePlan(
  deps: BillingDeps,
  userId: string,
  tier: BillingTier,
  now: Date = clock(deps),
): Promise<BillingSubscriptionRecord> {
  const subscription = await deps.store.get(userId);
  if (
    !subscription ||
    !isBillingStatus(subscription.status) ||
    planFor(subscription, now) === 'taster'
  ) {
    throw new ValidationError('There is no paid subscription to change.');
  }
  const pricePence = pricePenceFor(tier, subscription.founding);
  await deps.stripe.updateSubscriptionPlan(subscription.stripeSubscriptionId, pricePence, tier);
  return deps.store.save({
    userId: subscription.userId,
    tier,
    status: subscription.status,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    pricePence,
    founding: subscription.founding,
    currentPeriodEnd: new Date(subscription.currentPeriodEnd),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  });
}

/** Stops the next renewal; access continues until the paid period ends (Stripe's `deleted` closes it). */
export async function cancelPlan(
  deps: BillingDeps,
  userId: string,
  now: Date = clock(deps),
): Promise<BillingSubscriptionRecord> {
  const subscription = await deps.store.get(userId);
  if (
    !subscription ||
    !isBillingStatus(subscription.status) ||
    planFor(subscription, now) === 'taster'
  ) {
    throw new ValidationError('There is no paid subscription to cancel.');
  }
  await deps.stripe.cancelSubscriptionAtPeriodEnd(subscription.stripeSubscriptionId);
  return deps.store.save({
    userId: subscription.userId,
    tier: subscription.tier,
    status: subscription.status,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    pricePence: subscription.pricePence,
    founding: subscription.founding,
    currentPeriodEnd: new Date(subscription.currentPeriodEnd),
    cancelAtPeriodEnd: true,
  });
}
