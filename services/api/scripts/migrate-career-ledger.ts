/**
 * Runs the prototype-ledger migration (WL-001, WL-002) against `DATABASE_URL`.
 *
 * Dry-run is the default and writes nothing; it prints the exact rows and the
 * skill-link change it would apply. `--execute` performs the inserts.
 *
 *   pnpm --filter @hominem/api migrate:career-ledger
 *   pnpm --filter @hominem/api migrate:career-ledger -- --execute
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';

import { pool } from '@hominem/db/core';

import { runCareerLedgerMigration } from '../src/migrations/career-ledger';

async function main() {
  const { values } = parseArgs({
    options: { execute: { type: 'boolean', default: false } },
    strict: true,
  });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('✗ DATABASE_URL is required.');
    process.exitCode = 1;
    return;
  }
  const target = new URL(databaseUrl);
  console.log(`database: ${target.host}${target.pathname}`);
  console.log(values.execute ? 'mode: EXECUTE' : 'mode: DRY RUN (pass --execute to write)');

  try {
    const result = await runCareerLedgerMigration({ execute: values.execute });
    console.log(JSON.stringify(result, null, 2));
    if (!values.execute) {
      console.log('dry run: nothing written.');
    } else {
      console.log(
        `inserted ${result.inserted.length} entr${result.inserted.length === 1 ? 'y' : 'ies'}, skipped ${result.skipped}, skill link ${result.skillUpdated ? 'updated' : 'already current'}.`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
