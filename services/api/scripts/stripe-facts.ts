/**
 * Gathers the machine facts the setup doctor judges (stripe-setup-doctor.ts). I/O only: CLI
 * probes and env reads; every judgement lives in the tested pure module.
 */
import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { StripeSetupFacts } from '../src/application/stripe-setup-doctor';

const run = promisify(execFile);

/** True when the probe exits 0 — a missing CLI is a fact, not an exception to handle here. */
async function probe(command: string, args: string[]): Promise<boolean> {
  return run(command, args).then(
    () => true,
    () => false,
  );
}

/** True when `stripe config --list` shows a paired account (an `acct_...` reference). */
async function cliLoggedIn(): Promise<boolean> {
  const { stdout } = await run('stripe', ['config', '--list']).catch(() => ({ stdout: '' }));
  return /acct_|account_id/.test(stdout);
}

export async function gatherStripeSetupFacts(): Promise<StripeSetupFacts> {
  const cliInstalled = await probe('stripe', ['--version']);
  return {
    cliInstalled,
    cliLoggedIn: cliInstalled ? await cliLoggedIn() : false,
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    apiBaseUrlSet: Boolean(process.env.STRIPE_API_BASE_URL),
    webhookSecret:
      process.env.BILLING_STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET ?? '',
  };
}
