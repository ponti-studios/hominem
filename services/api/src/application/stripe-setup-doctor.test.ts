import { describe, expect, it } from 'vitest';

import { diagnoseStripeSetup, type StripeSetupFacts } from './stripe-setup-doctor';

function facts(overrides: Partial<StripeSetupFacts> = {}): StripeSetupFacts {
  return {
    cliInstalled: true,
    cliLoggedIn: true,
    secretKey: 'sk_test_example_not_real',
    apiBaseUrlSet: false,
    webhookSecret: 'whsec_example_not_real',
    ...overrides,
  };
}

describe('diagnoseStripeSetup', () => {
  it('reports every check green when local Stripe verification is ready', () => {
    const findings = diagnoseStripeSetup(facts());

    expect(findings).toHaveLength(5);
    expect(findings.every((finding) => finding.ok)).toBe(true);
  });

  it('keeps one labeled finding per check, so a failure is attributable', () => {
    const findings = diagnoseStripeSetup(facts());

    expect(new Set(findings.map((finding) => finding.label)).size).toBe(5);
  });

  it('fails when the Stripe CLI is missing and says how to install it', () => {
    const [finding] = diagnoseStripeSetup(facts({ cliInstalled: false }));

    expect(finding.ok).toBe(false);
    expect(finding.fix).toContain('stripe CLI');
  });

  it('fails when the CLI is not paired with the account and says to log in', () => {
    const finding = diagnoseStripeSetup(facts({ cliLoggedIn: false })).find((f) => !f.ok);

    expect(finding?.ok).toBe(false);
    expect(finding?.fix).toContain('stripe login');
  });

  it('fails on a live secret key and asks for a Test Mode key instead', () => {
    const finding = diagnoseStripeSetup(facts({ secretKey: 'sk_live_example_not_real' })).find(
      (f) => !f.ok,
    );

    expect(finding?.ok).toBe(false);
    expect(finding?.fix).toContain('Test Mode');
    expect(finding?.fix).toContain('live');
  });

  it('fails on a placeholder key that only looks like a Stripe key', () => {
    const finding = diagnoseStripeSetup(facts({ secretKey: 'sk_local_render_check' })).find(
      (f) => !f.ok,
    );

    expect(finding?.ok).toBe(false);
  });

  it('fails when no secret key is configured and points at the ignored env file', () => {
    const finding = diagnoseStripeSetup(facts({ secretKey: '' })).find((f) => !f.ok);

    expect(finding?.ok).toBe(false);
    expect(finding?.fix).toContain('services/api/.env');
  });

  it('fails when a local Stripe fake is configured for subscription testing', () => {
    const finding = diagnoseStripeSetup(facts({ apiBaseUrlSet: true })).find((f) => !f.ok);

    expect(finding?.ok).toBe(false);
    expect(finding?.fix).toContain('STRIPE_API_BASE_URL');
  });

  it('fails without a webhook secret and points at the listen recipe', () => {
    const finding = diagnoseStripeSetup(facts({ webhookSecret: '' })).find((f) => !f.ok);

    expect(finding?.ok).toBe(false);
    expect(finding?.fix).toContain('just billing stripe-listen');
  });

  it('never echoes the key or webhook secret values into its findings', () => {
    const findings = diagnoseStripeSetup(
      facts({ secretKey: 'sk_test_canary_value', webhookSecret: 'whsec_canary_value' }),
    );

    const text = findings.map((finding) => `${finding.label} ${finding.fix}`).join(' ');
    expect(text).not.toContain('canary_value');
  });
});
