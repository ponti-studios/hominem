/**
 * Billing rules (docs/billing.md): the current offers and legacy subscription tiers, what each
 * grants, and when a paid subscription stops granting access. Pure functions only — Stripe calls and the database live in
 * billing.service.ts and billing.store.ts, so every rule here is testable on its own.
 */
import type { BillingSubscriptionRecord, BillingTier, BillingUsageKind } from '@hominem/db/billing';

export type { BillingTier, BillingUsageKind };

/** The plan a person is actually on. Taster is the absence of a live paid subscription. */
export type Plan = 'taster' | 'core' | 'ai' | 'founding_core' | 'rhodium' | 'iridium' | 'osmium';

/** Current offer prices plus legacy prices needed to preserve stored subscription terms. */
export const TIER_PRICES_PENCE = {
  taster: 0,
  core: 999,
  ai: 1999,
  rhodium: 1999,
  iridium: 3999,
  founding_core: 799,
  osmium: 0,
} as const;

export interface BillingConfig {
  /** Monthly message caps for free and legacy plans. New paid plans are token-metered instead. */
  chatMessages: Record<Plan, number | null>;
  /** Monthly skill-call volume. `null` is unlimited; Taster is blocked by volume, never by domain. */
  skillCalls: Record<Plan, number | null>;
  /** Provider-reported total tokens per UTC month. `null` is unlimited. */
  aiTokens: Record<Plan, number | null>;
  /** Internal cost guard in USD, separate from the user-facing token allowance. */
  aiSpendUsd: Record<Plan, number | null>;
}

/**
 * Provisional caps. The numbers belong to the "Hominem — Paid Tier Plan" sheet; this module is the
 * only place they are expressed, and each can be overridden from the environment (see
 * billing.runtime.ts).
 */
export const DEFAULT_BILLING_CONFIG: BillingConfig = {
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
    ai: 8_500_000,
    founding_core: 3_900_000,
    rhodium: 8_500_000,
    iridium: 18_000_000,
    osmium: null,
  },
  aiSpendUsd: {
    taster: 10,
    core: 2.5,
    ai: 5.45,
    founding_core: 2.5,
    rhodium: 5.45,
    iridium: 11.4,
    osmium: null,
  },
};

export interface BillingLimits {
  chatMessagesPerMonth: number | null;
  skillCallsPerMonth: number | null;
  aiTokensPerMonth: number | null;
  aiSpendUsdPerMonth: number | null;
}

const PAID_STATUSES: readonly string[] = ['active', 'trialing'];

/** Whether the subscription is paid up right now: an active (or trialing) period that has not ended. */
export function subscriptionGrantsAccess(
  subscription: Pick<BillingSubscriptionRecord, 'status' | 'currentPeriodEnd'>,
  now: Date,
): boolean {
  if (!PAID_STATUSES.includes(subscription.status)) return false;
  return new Date(subscription.currentPeriodEnd).getTime() > now.getTime();
}

/**
 * The plan the subscription grants now. A cancelled subscription keeps access until the paid period
 * ends; the moment Stripe marks it `canceled` (or the period lapses) the person is back on Taster.
 */
export function planFor(subscription: BillingSubscriptionRecord | null, now: Date): Plan {
  if (!subscription || !subscriptionGrantsAccess(subscription, now)) return 'taster';
  if (subscription.tier === 'rhodium' || subscription.tier === 'iridium') return subscription.tier;
  if (subscription.tier === 'ai') return 'ai';
  return subscription.founding ? 'founding_core' : 'core';
}

export function planForMembership(
  subscription: BillingSubscriptionRecord | null,
  hasOsmiumMembership: boolean,
  now: Date,
): Plan {
  return hasOsmiumMembership ? 'osmium' : planFor(subscription, now);
}

export function limitsFor(
  plan: Plan,
  config: BillingConfig = DEFAULT_BILLING_CONFIG,
): BillingLimits {
  return {
    chatMessagesPerMonth: config.chatMessages[plan],
    skillCallsPerMonth: config.skillCalls[plan],
    aiTokensPerMonth: config.aiTokens[plan],
    aiSpendUsdPerMonth: config.aiSpendUsd[plan],
  };
}

/** The monthly cap for one kind of interaction, or null when that plan does not cap it. */
export function limitFor(
  plan: Plan,
  kind: BillingUsageKind,
  config: BillingConfig = DEFAULT_BILLING_CONFIG,
): number | null {
  const limits = limitsFor(plan, config);
  return kind === 'chat' ? limits.chatMessagesPerMonth : limits.skillCallsPerMonth;
}

/** The stored subscription price, including legacy AI and Founding Core terms. */
export function pricePenceFor(tier: BillingTier, founding: boolean): number {
  if (tier === 'ai') return TIER_PRICES_PENCE.ai;
  if (tier === 'rhodium') return TIER_PRICES_PENCE.rhodium;
  if (tier === 'iridium') return TIER_PRICES_PENCE.iridium;
  return founding ? TIER_PRICES_PENCE.founding_core : TIER_PRICES_PENCE.core;
}

/** The UTC calendar month a usage count is measured over. */
export function usagePeriodStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
