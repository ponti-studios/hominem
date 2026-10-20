/**
 * The test user for exercising the API and MCP tools against production, so real data is never used.
 *
 * Usage (run against the environment you mean; it prints the database host first):
 *   pnpm test-user ensure --email cj+mcp-test@ponti.io
 *       Creates the account if it is missing (already verified, no email sent). Safe to repeat.
 *   pnpm test-user token --email cj+mcp-test@ponti.io --env-file ~/.localrc --var HOMINEM_MCP_TEST_TOKEN
 *       Mints a personal MCP token (hmt_...) and writes it to the file as VAR=value. The token is
 *       never printed: it cannot be read back from the database afterwards.
 *   pnpm test-user revoke --email cj+mcp-test@ponti.io
 *       Revokes every active token of the test user.
 *
 * Only accounts whose address contains "test" or "e2e" are accepted, so this can not mint a token for
 * a real person. Needs DATABASE_URL, BETTER_AUTH_SECRET and the rest of the API environment.
 */
import 'dotenv/config';
import { appendFileSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

function die(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function expandHome(path: string): string {
  return path.startsWith('~/') ? resolve(homedir(), path.slice(2)) : resolve(path);
}

// Replaces VAR=... when the file already has it, otherwise appends, always on its own line.
function writeEnvVar(file: string, name: string, value: string): void {
  const line = `${name}=${value}`;
  if (!existsSync(file)) {
    writeFileSync(file, `${line}\n`, { mode: 0o600 });
    return;
  }
  const text = readFileSync(file, 'utf8');
  const pattern = new RegExp(`^(export\\s+)?${name}=.*$`, 'm');
  if (pattern.test(text)) {
    writeFileSync(
      file,
      text.replace(pattern, (_, exported: string | undefined) => `${exported ?? ''}${line}`),
    );
    return;
  }
  appendFileSync(file, `${text.endsWith('\n') || text === '' ? '' : '\n'}${line}\n`);
  chmodSync(file, 0o600);
}

async function main() {
  const { positionals, values } = parseArgs({
    options: {
      email: { type: 'string' },
      'env-file': { type: 'string' },
      var: { type: 'string', default: 'HOMINEM_MCP_TEST_TOKEN' },
      name: { type: 'string', default: 'MCP test user' },
    },
    allowPositionals: true,
    strict: true,
  });
  const command = positionals[0];
  const email = values.email?.trim().toLowerCase();
  const usage = 'Usage: test-user <ensure|token|revoke> --email <test address> [--env-file <file>]';
  if (!command || !email || !/^\S+@\S+\.\S+$/.test(email)) die(usage);
  if (!/test|e2e/.test(email.split('@')[0] ?? '')) {
    die(
      `${email} does not look like a test account (the part before @ must contain "test" or "e2e").`,
    );
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) die('DATABASE_URL is required.');
  console.log(`database: ${new URL(databaseUrl).host}`);

  const { db, pool } = await import('@hominem/db/core');
  try {
    const existing = await db
      .selectFrom('user')
      .select(['id', 'email'])
      .where('email', '=', email)
      .executeTakeFirst();

    if (command === 'ensure') {
      if (existing) {
        console.log(`exists: ${email} (${existing.id})`);
        return;
      }
      const { betterAuthServer } = await import('../src/auth/better-auth');
      const context = await betterAuthServer.$context;
      const created = await context.internalAdapter.createUser({
        email,
        name: values.name ?? 'MCP test user',
        emailVerified: true,
      });
      console.log(`created: ${email} (${created.id})`);
      return;
    }

    if (!existing) die(`No account for ${email}; run "ensure" first.`);

    if (command === 'token') {
      const envFile = values['env-file'];
      if (!envFile) die('--env-file is required: the token is written there and never printed.');
      const variable = values.var ?? 'HOMINEM_MCP_TEST_TOKEN';
      if (!/^[A-Z][A-Z0-9_]*$/.test(variable)) die('--var must be an UPPER_SNAKE_CASE name.');
      const { createMcpToken } = await import('../src/application/mcp-tokens.service');
      const minted = await createMcpToken({
        ownerUserId: existing.id,
        name: `test-user ${new Date().toISOString().slice(0, 10)}`,
      });
      writeEnvVar(expandHome(envFile), variable, minted.token);
      console.log(`token ${minted.tokenPrefix}… for ${email} written to ${envFile} as ${variable}`);
      return;
    }

    if (command === 'revoke') {
      const { listMcpTokens, revokeMcpToken } =
        await import('../src/application/mcp-tokens.service');
      const tokens = await listMcpTokens({ ownerUserId: existing.id });
      for (const token of tokens) {
        await revokeMcpToken({ ownerUserId: existing.id, id: token.id });
      }
      console.log(`revoked ${tokens.length} token(s) for ${email}`);
      return;
    }

    die(usage);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
