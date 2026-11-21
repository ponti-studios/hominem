/**
 * Doctor for the local Stripe verification loop: reports what is missing before `just
 * stripe-listen` / `just stripe-test` can run. Judgement lives in the tested pure module; this
 * script only gathers facts and prints the findings.
 *
 * Usage: just billing stripe-setup
 */
import 'dotenv/config';
import { diagnoseStripeSetup } from '../src/application/stripe-setup-doctor';
import { gatherStripeSetupFacts } from './stripe-facts';

async function main(): Promise<void> {
  const findings = diagnoseStripeSetup(await gatherStripeSetupFacts());
  for (const finding of findings) {
    console.log(
      `${finding.ok ? '✓' : '✗'} ${finding.label}${finding.ok ? '' : ` — ${finding.fix}`}`,
    );
  }
  const failed = findings.filter((finding) => !finding.ok);
  if (failed.length > 0) {
    console.error(`\n✗ ${failed.length} of ${findings.length} checks failed.`);
    process.exit(1);
  }
  console.log(
    '\nReady. Run just billing stripe-listen in a second terminal, then just billing stripe-test <tier>.',
  );
}

void main();
