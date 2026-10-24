/**
 * Re-checks every stored file against the direct-upload rules, so old objects are held to the
 * same standard as new ones before the bucket goes private.
 *
 * For each ready file it HEADs + ranged-GETs the object, sniffs the magic bytes against the
 * declared mimetype, and (on --execute) rewrites the object's headers in place: locked
 * Content-Type, inline only for safe types, no-store cache. Keys don't change, so URLs persisted
 * in rows and chat messages keep working.
 *
 * Objects that fail are never deleted: on --execute they are parked under `rejected/` and the DB
 * row is removed so it stops pointing at nothing. Missing objects are reported only.
 *
 * Dry-run is the default and writes nothing.
 *
 *   pnpm --filter @hominem/api backfill:file-security
 *   pnpm --filter @hominem/api backfill:file-security -- --execute
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';

import { db, pool } from '@hominem/db/core';
import { fileStorageService } from '@hominem/storage';

const PAGE_SIZE = 200;

async function main() {
  const { values } = parseArgs({
    options: { execute: { type: 'boolean', default: false } },
    strict: true,
  });
  const dryRun = !values.execute;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('✗ DATABASE_URL is required.');
    process.exitCode = 1;
    return;
  }
  const target = new URL(databaseUrl);
  console.log(`database: ${target.host}${target.pathname}`);
  console.log(dryRun ? 'mode: dry-run (nothing is written)' : 'mode: EXECUTE');

  const totals = { checked: 0, ok: 0, rejected: 0, missing: 0, tooLarge: 0, skipped: 0 };
  let cursor = '00000000-0000-0000-0000-000000000000';

  for (;;) {
    const rows = await db
      .selectFrom('app.files')
      .select(['id', 'ownerUserid', 'storageKey', 'mimetype'])
      .where('status', '=', 'ready')
      .where('id', '>', cursor)
      .orderBy('id')
      .limit(PAGE_SIZE)
      .execute();
    if (rows.length === 0) break;

    for (const row of rows) {
      cursor = row.id;
      totals.checked += 1;

      // Rows with no key can't be checked; a key outside the user's own prefix is suspicious.
      if (!row.storageKey || !row.storageKey.startsWith(`users/${row.ownerUserid}/`)) {
        totals.skipped += 1;
        console.log(`skip     ${row.id} (no key or key outside owner prefix)`);
        continue;
      }

      const result = await fileStorageService.reverifyObject(row.storageKey, row.mimetype, {
        dryRun,
      });
      if (result.ok) {
        totals.ok += 1;
        continue;
      }

      if (result.reason === 'missing') {
        totals.missing += 1;
        console.log(`missing  ${row.id} ${row.storageKey}`);
        continue;
      }

      if (result.reason === 'too_large') totals.tooLarge += 1;
      else totals.rejected += 1;
      console.log(
        `reject   ${row.id} ${row.storageKey} (${result.reason}${result.detail ? `: ${result.detail}` : ''})`,
      );

      if (!dryRun) {
        await fileStorageService.moveToRejected(row.storageKey);
        await db.deleteFrom('app.files').where('id', '=', row.id).execute();
      }
    }
  }

  console.log('\nsummary', totals);
  if (dryRun) console.log('Re-run with --execute to apply.');
}

main()
  .catch((error) => {
    console.error('✗ backfill failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
