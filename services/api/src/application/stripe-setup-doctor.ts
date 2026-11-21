/**
 * Pre-flight for the local Stripe verification loop (docs/billing.md). Pure diagnostics: the
 * calling script gathers facts from the machine and the ignored env, this module only judges
 * them, so every failure mode is testable without a Stripe account or any secret material.
 */
export interface StripeSetupFacts {
  cliInstalled: boolean;
  /** The `stripe` CLI is paired with the account (`stripe login` completed). */
  cliLoggedIn: boolean;
  /** The configured `STRIPE_SECRET_KEY` value; only its mode prefix is ever inspected. */
  secretKey: string;
  /** `STRIPE_API_BASE_URL` is set — a local fake that must not be used for subscriptions. */
  apiBaseUrlSet: boolean;
  /** `BILLING_STRIPE_WEBHOOK_SECRET` (or the `STRIPE_WEBHOOK_SECRET` fallback) value. */
  webhookSecret: string;
}

export interface StripeSetupFinding {
  ok: boolean;
  label: string;
  fix: string;
}

const isTestKey = (key: string): boolean => key.startsWith('sk_test_');

export function diagnoseStripeSetup(facts: StripeSetupFacts): StripeSetupFinding[] {
  return [
    {
      ok: facts.cliInstalled,
      label: 'Stripe CLI installed',
      fix: 'Install the stripe CLI: brew install stripe/stripe-cli/stripe (or see https://docs.stripe.com/stripe-cli)',
    },
    {
      ok: facts.cliLoggedIn,
      label: 'Stripe CLI logged in',
      fix: 'Pair the CLI with the account: stripe login',
    },
    {
      ok: isTestKey(facts.secretKey),
      label: 'Test Mode API key',
      fix: facts.secretKey.startsWith('sk_live_')
        ? 'A live key is configured — replace STRIPE_SECRET_KEY in services/api/.env with a Test Mode key (sk_test_...). Never run this flow against the live account.'
        : 'Set STRIPE_SECRET_KEY to a Test Mode key (sk_test_...) in the ignored services/api/.env',
    },
    {
      ok: !facts.apiBaseUrlSet,
      label: 'Real Stripe endpoint',
      fix: 'Unset STRIPE_API_BASE_URL: the local fake only supports Thames top-ups, not subscription billing (docs/billing.md).',
    },
    {
      ok: facts.webhookSecret.startsWith('whsec_'),
      label: 'Billing webhook secret',
      fix: 'Run just billing stripe-listen in another terminal, set the printed whsec_... as BILLING_STRIPE_WEBHOOK_SECRET in services/api/.env, then restart the API.',
    },
  ];
}
