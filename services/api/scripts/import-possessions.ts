/**
 * One-time import of the "possessions" spreadsheet into Hominem for a single user.
 *
 * Export the sheet's tabs as CSV into a directory (File > Download > CSV per tab), named
 * `master.csv` and `containers.csv` (plus an optional `shopping.csv` from the shopping sheet), then:
 *
 *   pnpm --filter @hominem/api exec tsx scripts/import-possessions.ts \
 *     --email you@example.com --dir ~/Downloads/possessions            # dry run
 *   ... --apply                                                        # writes
 *
 * Safe to re-run: rows are matched on the sheet's own ids (ITM-*, CON-*), so a second run
 * updates instead of duplicating. Point DATABASE_URL at the database you mean to change.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { db } from '@hominem/db/core';
import { ContainerRepository, PossessionRepository } from '@hominem/db/possessions';
import { runInTransaction } from '@hominem/db/transaction';
import { parse } from 'csv-parse/sync';

import {
  mapContainerRow,
  mapPossessionRow,
  mapShoppingRow,
  type MappedContainer,
  type MappedPossession,
  type MappedShopping,
  type SheetRow,
} from '../src/application/possession-import';

function die(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

function readCsv(dir: string, file: string): SheetRow[] {
  try {
    const rows: SheetRow[] = parse(readFileSync(join(dir, file), 'utf8'), {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    });
    return rows;
  } catch (error) {
    return die(
      `Could not read ${join(dir, file)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function main() {
  const email = arg('email');
  const dir = arg('dir')?.replace(/^~/, process.env.HOME ?? '~');
  const apply = process.argv.includes('--apply');
  if (!email || !dir) die('Usage: import-possessions.ts --email <email> --dir <folder> [--apply]');

  const user = await db
    .selectFrom('user')
    .select(['id', 'email'])
    .where('email', '=', email)
    .executeTakeFirst();
  if (!user) die(`No user with email ${email}`);

  const containers = readCsv(dir, 'containers.csv')
    .map(mapContainerRow)
    .filter((c): c is MappedContainer => c !== null);
  const seen = new Set<string>();
  const possessions = readCsv(dir, 'master.csv')
    .map(mapPossessionRow)
    .filter(
      (p): p is MappedPossession =>
        p !== null && !seen.has(p.externalId) && !!seen.add(p.externalId),
    );

  const shoppingRows = existsSync(join(dir, 'shopping.csv')) ? readCsv(dir, 'shopping.csv') : [];
  const repeats = new Map<string, number>();
  const shopping = shoppingRows
    .map((row): MappedShopping | null => {
      const first = mapShoppingRow(row, 1);
      if (!first) return null;
      const n = (repeats.get(first.externalId) ?? 0) + 1;
      repeats.set(first.externalId, n);
      return n === 1 ? first : mapShoppingRow(row, n);
    })
    .filter((item): item is MappedShopping => item !== null);
  const shoppingByStatus = shopping.reduce<Record<string, number>>((acc, item) => {
    const key = item.input.status ?? 'none';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const knownContainers = new Set(containers.map((c) => c.externalId));
  const missing = possessions.filter(
    (p) => p.containerExternalId && !knownContainers.has(p.containerExternalId),
  );
  const warnings = possessions.flatMap((p) => p.warnings);
  const byStatus = possessions.reduce<Record<string, number>>((acc, p) => {
    const key = p.input.status ?? 'none';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`User: ${user.email}`);
  console.log(`Containers: ${containers.length}`);
  console.log(`Possessions: ${possessions.length}`, byStatus);
  if (shoppingRows.length) console.log(`Shopping rows: ${shopping.length}`, shoppingByStatus);
  if (missing.length)
    console.log(`⚠ ${missing.length} items point at unknown containers (left unassigned)`);
  warnings.slice(0, 20).forEach((w) => console.log(`⚠ ${w}`));

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write.');
    return;
  }

  await runInTransaction(async (trx) => {
    const containerIds = new Map<string, string>();
    for (const container of containers) {
      const saved = await ContainerRepository.upsertByExternalId(trx, user.id, container.input);
      containerIds.set(container.externalId, saved.id);
    }
    // Parents need every container to exist first.
    for (const container of containers) {
      const parentId = container.parentExternalId
        ? containerIds.get(container.parentExternalId)
        : undefined;
      await ContainerRepository.update(trx, user.id, containerIds.get(container.externalId)!, {
        parentContainerId: parentId ?? null,
      });
    }
    for (const possession of possessions) {
      const containerId = possession.containerExternalId
        ? containerIds.get(possession.containerExternalId)
        : undefined;
      await PossessionRepository.upsertByExternalId(trx, user.id, {
        ...possession.input,
        containerId: containerId ?? null,
      });
    }
    for (const item of shopping) {
      await PossessionRepository.upsertByExternalId(trx, user.id, item.input);
    }
  });
  console.log('\n✓ Imported.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
