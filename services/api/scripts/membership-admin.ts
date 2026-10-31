/**
 * Assigns or removes an Osmium complimentary membership for a user.
 *
 * Usage:
 *   pnpm membership grant --email member@example.com --by operator@example.com
 *   pnpm membership revoke --email member@example.com --by operator@example.com
 *
 * Granting Osmium immediately cancels an active Stripe subscription before recording the membership.
 * Requires DATABASE_URL; STRIPE_SECRET_KEY is required when the target has a live paid plan.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';

function die(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function main() {
  const { positionals, values } = parseArgs({
    options: { email: { type: 'string' }, by: { type: 'string' } },
    allowPositionals: true,
    strict: true,
  });
  const command = positionals[0];
  const email = values.email?.trim().toLowerCase();
  const byEmail = values.by?.trim().toLowerCase();
  if (
    !['grant', 'revoke'].includes(command ?? '') ||
    !email ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    !byEmail ||
    !/^\S+@\S+\.\S+$/.test(byEmail)
  ) {
    die('Usage: membership <grant|revoke> --email <member> --by <operator>');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) die('DATABASE_URL is required.');
  console.log(`database: ${new URL(databaseUrl).host}`);

  const { db, pool } = await import('@hominem/db/core');
  const { billingRules, billingStripeClient } = await import('../src/application/billing.runtime');
  const { grantOsmiumMembership, revokeOsmiumMembership } =
    await import('../src/application/billing.service');

  try {
    const users = await db
      .selectFrom('user')
      .select(['id', 'email'])
      .where('email', 'in', [email, byEmail])
      .execute();
    const member = users.find((user) => user.email.toLowerCase() === email);
    const operator = users.find((user) => user.email.toLowerCase() === byEmail);
    if (!member) die(`No account for ${email}; they need to sign in once first.`);
    if (!operator) die(`No operator account for ${byEmail}.`);

    if (command === 'grant') {
      await grantOsmiumMembership(
        { ...billingRules(), stripe: billingStripeClient() },
        { userId: member.id, grantedByUserId: operator.id },
      );
      console.log(`granted Osmium membership to ${email}; operator: ${byEmail}`);
      return;
    }

    const revoked = await revokeOsmiumMembership(billingRules(), {
      userId: member.id,
      revokedByUserId: operator.id,
    });
    console.log(
      `${revoked ? 'revoked Osmium membership for' : 'no active Osmium membership for'} ${email}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
