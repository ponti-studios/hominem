/**
 * Manages who may get a Thames provider key, and ends keys.
 *
 * Usage (run against the environment you mean; it prints the database host first):
 *   pnpm credentials allow   --email dana@work.com
 *   pnpm credentials disallow --email dana@work.com
 *   pnpm credentials allow   --domain work.com        (everyone at that domain; sign-in proves the address)
 *   pnpm credentials disallow --domain work.com
 *   pnpm credentials block   --email dana@work.com   (ends every live key and stops new ones)
 *   pnpm credentials unblock --email dana@work.com
 *   pnpm credentials reap    --email dana@work.com   (retries disabling keys that are revoked here)
 *
 * Needs DATABASE_URL, and OPENROUTER_MANAGEMENT_KEY for block and reap.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';

function die(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function main() {
  const { positionals, values } = parseArgs({
    options: { email: { type: 'string' }, domain: { type: 'string' } },
    allowPositionals: true,
    strict: true,
  });
  const command = positionals[0];
  const email = values.email?.trim().toLowerCase();
  const domain = values.domain?.trim().toLowerCase().replace(/^@/, '');
  const byDomain = (command === 'allow' || command === 'disallow') && domain !== undefined;
  if (
    byDomain ? !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) : !email || !/^\S+@\S+\.\S+$/.test(email)
  ) {
    die(
      'Usage: credentials <allow|disallow|block|unblock|reap> --email <email>  (allow and disallow also take --domain <domain>)',
    );
  }
  if (!command) die('Usage: credentials <allow|disallow|block|unblock|reap> --email <email>');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) die('DATABASE_URL is required.');
  console.log(`database: ${new URL(databaseUrl).host}`);

  const { db, pool } = await import('@hominem/db/core');
  const store = await import('../src/application/provider-credentials.store');
  const { allowDomain, disallowDomain, allowEmail, disallowEmail, blockUser, unblockUser } = store;
  const { revokeAllCredentials, reapCredentials } =
    await import('../src/application/provider-credentials');
  const { createOpenRouterKeys } = await import('../src/application/openrouter-keys');

  try {
    if (byDomain && domain) {
      if (command === 'allow') {
        await allowDomain(domain);
        console.log(`allowed everyone at @${domain}`);
      } else {
        await disallowDomain(domain);
        console.log(`removed @${domain} (existing keys keep working; use block to end them)`);
      }
      return;
    }
    if (!email) die('--email is required.');
    if (command === 'allow') {
      await allowEmail(email);
      console.log(`allowed ${email}`);
      return;
    }
    if (command === 'disallow') {
      await disallowEmail(email);
      console.log(
        `removed ${email} from the list (existing keys keep working; use block to end them)`,
      );
      return;
    }

    const user = await db
      .selectFrom('user')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst();
    if (!user) die(`No account for ${email}.`);

    if (command === 'unblock') {
      await unblockUser(user.id);
      console.log(`unblocked ${email}`);
      return;
    }

    const managementKey = process.env.OPENROUTER_MANAGEMENT_KEY;
    if (!managementKey) die('OPENROUTER_MANAGEMENT_KEY is required for block and reap.');
    const deps = {
      store: store.dbCredentialStore,
      keys: createOpenRouterKeys(managementKey),
      capUsd: Number(process.env.THAMES_MONTHLY_CAP_USD ?? 5),
      log: (event: string, fields: Record<string, unknown>) => console.error(event, fields),
    };

    if (command === 'block') {
      await blockUser(user.id);
      const ended = await revokeAllCredentials(deps, user.id);
      console.log(`blocked ${email}; ended ${ended} live key(s)`);
    } else if (command === 'reap') {
      console.log(`retried ${await reapCredentials(deps, user.id)} key(s)`);
    } else {
      die(`Unknown command: ${command}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
