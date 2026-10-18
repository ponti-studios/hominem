/**
 * Thames credit, for testing and support (docs/prd/top-up.md in the Thames repo).
 *
 * Usage (run against the environment you mean; it prints the database host first):
 *   pnpm credit balance --email dana@work.com          (the ledger, and what the person can spend)
 *   pnpm credit link    --email dana@work.com          (a signed top-up link, valid for 7 days)
 *   pnpm credit add     --email dana@work.com --pence 500   (a manual correction; negative takes away)
 *
 * Needs DATABASE_URL, BETTER_AUTH_SECRET and the rest of the API environment; `balance` also needs
 * OPENROUTER_MANAGEMENT_KEY.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';

function die(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function main() {
  const { positionals, values } = parseArgs({
    options: { email: { type: 'string' }, pence: { type: 'string' } },
    allowPositionals: true,
    strict: true,
  });
  const command = positionals[0];
  const email = values.email?.trim().toLowerCase();
  if (!command || !email || !/^\S+@\S+\.\S+$/.test(email)) {
    die('Usage: credit <balance|link|add> --email <email> [--pence <n>]');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) die('DATABASE_URL is required.');
  console.log(`database: ${new URL(databaseUrl).host}`);

  const { db, pool } = await import('@hominem/db/core');
  try {
    const user = await db
      .selectFrom('user')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst();
    if (!user) die(`No account for ${email}; they need to sign in once first.`);

    if (command === 'link') {
      const { topUpLink } = await import('../src/application/credit-email');
      console.log(topUpLink(user.id));
      return;
    }
    if (command === 'add') {
      const pence = Number(values.pence);
      if (!Number.isInteger(pence) || pence === 0) die('--pence must be a non-zero whole number.');
      await db
        .insertInto('app.creditLedger')
        .values({ userId: user.id, kind: 'adjust', amountPence: pence })
        .execute();
      console.log(`added ${pence}p for ${email}`);
      return;
    }
    if (command === 'balance') {
      const { creditDeps, personInCreditMode } = await import('../src/application/credit.runtime');
      const { creditSnapshot } = await import('../src/application/credit');
      console.log(`in credit mode: ${personInCreditMode(email)}`);
      const deps = creditDeps();
      if (!deps) die('OPENROUTER_MANAGEMENT_KEY is required for balance.');
      const snapshot = await creditSnapshot(deps, user.id);
      console.log(`balance: ${snapshot.balancePence}p (last added ${snapshot.lastAddedPence}p)`);
      return;
    }
    die('Usage: credit <balance|link|add> --email <email> [--pence <n>]');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
