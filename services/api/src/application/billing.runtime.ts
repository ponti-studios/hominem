/** The billing rules' real dependencies: the environment's caps, the database store, and Stripe. */
import { logger } from '@hominem/telemetry';

import { env } from '../env';
import { DEFAULT_BILLING_CONFIG, type BillingConfig } from './billing';
import type { BillingDeps, BillingRulesDeps } from './billing.service';
import { dbBillingStore } from './billing.store';
import { devBase } from './credit.runtime';
import { createStripeClient, type StripeSubscriptionsClient } from './stripe';

/**
 * The monthly caps. The numbers come from the "Hominem — Paid Tier Plan" sheet; the defaults here
 * are overridable so the sheet can change without a deploy of new rules.
 */
export function billingConfig(): BillingConfig {
  return {
    chatMessages: {
      taster: env.BILLING_TASTER_CHAT_MESSAGES,
      core: null,
      ai: null,
      founding_core: null,
      rhodium: DEFAULT_BILLING_CONFIG.chatMessages.rhodium,
      iridium: DEFAULT_BILLING_CONFIG.chatMessages.iridium,
      osmium: null,
    },
    skillCalls: {
      taster: env.BILLING_TASTER_SKILL_CALLS,
      core: DEFAULT_BILLING_CONFIG.skillCalls.core,
      ai: DEFAULT_BILLING_CONFIG.skillCalls.ai,
      founding_core: DEFAULT_BILLING_CONFIG.skillCalls.founding_core,
      rhodium: DEFAULT_BILLING_CONFIG.skillCalls.rhodium,
      iridium: DEFAULT_BILLING_CONFIG.skillCalls.iridium,
      osmium: null,
    },
    aiTokens: DEFAULT_BILLING_CONFIG.aiTokens,
    aiSpendUsd: DEFAULT_BILLING_CONFIG.aiSpendUsd,
  };
}

/** What enforcement needs: the stored account state and the caps. No Stripe key required. */
export function billingRules(): BillingRulesDeps {
  return { store: dbBillingStore, config: billingConfig() };
}

export function billingStripeClient(): StripeSubscriptionsClient | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return createStripeClient(env.STRIPE_SECRET_KEY, fetch, devBase(env.STRIPE_API_BASE_URL));
}

/** The billing dependencies, or null when Stripe is not configured. */
export function billingDeps(): BillingDeps | null {
  const stripe = billingStripeClient();
  if (!stripe) {
    logger.error('billing_stripe_unavailable', { problem: 'STRIPE_SECRET_KEY is not set' });
    return null;
  }
  return {
    store: dbBillingStore,
    stripe,
    config: billingConfig(),
    log: (event, fields) => logger.error(event, fields),
  };
}

/** The endpoint's signing secret; a dedicated one when set, otherwise the existing Stripe secret. */
export function billingWebhookSecret(): string | null {
  const secret = env.BILLING_STRIPE_WEBHOOK_SECRET || env.STRIPE_WEBHOOK_SECRET;
  return secret && secret.length > 0 ? secret : null;
}
