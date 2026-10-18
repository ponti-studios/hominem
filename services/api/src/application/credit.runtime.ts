/**
 * Builds the real credit dependencies from the environment, in one place for the routes and the
 * admin script. The flag lives here: `CREDIT_MODE` and `CREDIT_TESTERS`.
 */
import { logger } from '@hominem/telemetry';

import { env } from '../env';
import {
  inCreditMode,
  parseTesters,
  type CreditConfig,
  type CreditDeps,
  type CreditMode,
} from './credit';
import { dbCreditStore } from './credit.store';
import { createOpenRouterKeys } from './openrouter-keys';
import { dbCredentialStore } from './provider-credentials.store';
import { createStripeClient, type StripeClient } from './stripe';

/** A local fake's address in development; always the real service in production. */
export function devBase(url: string | undefined): string | undefined {
  return env.NODE_ENV === 'production' ? undefined : url;
}

export function creditConfig(): CreditConfig {
  return {
    mode: env.CREDIT_MODE,
    testers: parseTesters(env.CREDIT_TESTERS),
    usdPerPound: env.CREDIT_USD_PER_POUND,
    grantPence: env.CREDIT_GRANT_PENCE,
    grantsPerDay: env.CREDIT_GRANTS_PER_DAY,
  };
}

export function personInCreditMode(email: string): boolean {
  return inCreditMode(creditConfig(), email);
}

/** The credit dependencies, or null when the provider management key is not set. */
export function creditDeps(): CreditDeps | null {
  if (!env.OPENROUTER_MANAGEMENT_KEY) return null;
  return {
    store: dbCreditStore,
    credentials: dbCredentialStore,
    keys: createOpenRouterKeys(
      env.OPENROUTER_MANAGEMENT_KEY,
      fetch,
      devBase(env.OPENROUTER_KEYS_BASE_URL),
    ),
    config: creditConfig(),
    log: (event, fields) => logger.error(event, fields),
  };
}

/**
 * Why Stripe cannot be used, or null when it can. The key must match the mode: a test key in
 * `test`, a live key only in `live`, so a test run can never move real money.
 */
export function stripeProblem(mode: CreditMode, secretKey: string | undefined): string | null {
  if (mode === 'off') return 'credit is off';
  if (!secretKey) return 'STRIPE_SECRET_KEY is not set';
  if (mode === 'test' && !secretKey.startsWith('sk_test_') && !secretKey.startsWith('rk_test_')) {
    return 'CREDIT_MODE=test needs a Stripe test key';
  }
  if (mode === 'live' && (secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_'))) {
    return 'CREDIT_MODE=live needs a live Stripe key';
  }
  return null;
}

/** The Stripe client for the current mode, or null (with the reason logged) when it cannot be used. */
export function stripeClient(): StripeClient | null {
  const problem = stripeProblem(env.CREDIT_MODE, env.STRIPE_SECRET_KEY);
  if (problem || !env.STRIPE_SECRET_KEY) {
    logger.error('credit_stripe_unavailable', { problem });
    return null;
  }
  return createStripeClient(env.STRIPE_SECRET_KEY, fetch, devBase(env.STRIPE_API_BASE_URL));
}
