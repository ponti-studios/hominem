/**
 * Read-only Phase 2 diff: the live spreadsheet tabs vs the live Hominem registry.
 *
 * Re-run this right before importing (plan §9: live data wins). It reports exactly
 * what a bulk-upsert would change, never writes.
 *
 *   pnpm --filter @hominem/api exec tsx scripts/diff-possessions.ts \
 *     --email you@ponti.io --dir ~/Downloads/possessions
 *
 * Reads `master.csv` and `containers.csv` (the Google Sheet tab exports), resolves the
 * owner by email, and prints, scoped to that owner:
 *   - sheet items/containers missing from Hominem (the candidate backlog to import),
 *   - Hominem-only records absent from the sheet (reconcile — keep unless told otherwise),
 *   - item container references that resolve nowhere (the CON-036 orphan class),
 *   - references to a container the sheet lacks but Hominem has (the CON-024 class),
 *   - the next free CON-xxx id, for a Hominem-native container that needs one.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { db } from '@hominem/db/core';
import { ContainerRepository, PossessionRepository } from '@hominem/db/possessions';
import { parse } from 'csv-parse/sync';

import {
  mapContainerRow,
  mapPossessionRow,
  type MappedContainer,
  type MappedPossession,
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

const nextConId = (existing: (string | null)[]): string => {
  let max = 0;
  for (const id of existing) {
    if (!id) continue;
    const match = /^CON-(\d+)$/i.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `CON-${String(max + 1).padStart(3, '0')}`;
};

async function main() {
  const email = arg('email');
  const dir = arg('dir')?.replace(/^~/, process.env.HOME ?? '~');
  if (!email || !dir) die('Usage: diff-possessions.ts --email <email> --dir <folder>');
  if (!existsSync(join(dir, 'master.csv'))) die(`Missing ${join(dir, 'master.csv')}`);
  if (!existsSync(join(dir, 'containers.csv'))) die(`Missing ${join(dir, 'containers.csv')}`);

  const user = await db
    .selectFrom('user')
    .select(['id', 'email'])
    .where('email', '=', email)
    .executeTakeFirst();
  if (!user) die(`No user with email ${email}`);

  const seen = new Set<string>();
  const possessions = readCsv(dir, 'master.csv')
    .map(mapPossessionRow)
    .filter(
      (p): p is MappedPossession =>
        p !== null && !seen.has(p.externalId) && !!seen.add(p.externalId),
    );
  const containers = readCsv(dir, 'containers.csv')
    .map(mapContainerRow)
    .filter((c): c is MappedContainer => c !== null);

  const [livePossessions, liveContainers] = await Promise.all([
    PossessionRepository.auditables(db, user.id),
    ContainerRepository.list(db, user.id),
  ]);

  const livePossessionIds = new Set(
    livePossessions.map((p) => p.externalId).filter((id): id is string => id !== null),
  );
  const liveContainerIds = new Set(
    liveContainers.map((c) => c.externalId).filter((id): id is string => id !== null),
  );
  const sheetPossessionIds = new Set(possessions.map((p) => p.externalId));
  const sheetContainerIds = new Set(containers.map((c) => c.externalId));

  const missingItems = possessions.filter((p) => !livePossessionIds.has(p.externalId));
  const missingContainers = containers.filter((c) => !liveContainerIds.has(c.externalId));
  const hominemOnlyPossessions = livePossessions
    .filter((p) => p.externalId && !sheetPossessionIds.has(p.externalId))
    .map((p) => ({
      externalId: p.externalId,
      name: p.name,
      status: p.status,
      archived: p.isArchived,
    }));
  const hominemOnlyContainers = liveContainers
    .filter((c) => c.externalId === null || !sheetContainerIds.has(c.externalId))
    .map((c) => ({ externalId: c.externalId, name: c.name }));

  const refs = possessions
    .filter((p) => p.containerExternalId)
    .map((p) => ({ item: p.externalId, container: p.containerExternalId! }));
  const orphanRefs = refs.filter(
    (r) => !liveContainerIds.has(r.container) && !sheetContainerIds.has(r.container),
  );
  const resolvesOnlyInHominem = refs.filter(
    (r) => !sheetContainerIds.has(r.container) && liveContainerIds.has(r.container),
  );

  console.log(`User: ${user.email}`);
  console.log(`Sheet: ${possessions.length} items, ${containers.length} containers`);
  console.log(`Live: ${livePossessions.length} possessions, ${liveContainers.length} containers`);

  console.log(`\n== To import (in sheet, missing from Hominem) ==`);
  console.log(`  items: ${missingItems.length}`);
  for (const item of missingItems) console.log(`    ${item.externalId} — ${item.input.name}`);
  console.log(`  containers: ${missingContainers.length}`);
  for (const c of missingContainers) console.log(`    ${c.externalId} — ${c.input.name}`);

  console.log(`\n== Hominem-only (in Hominem, absent from sheet) — keep unless told otherwise ==`);
  console.log(`  containers: ${hominemOnlyContainers.length}`);
  for (const c of hominemOnlyContainers)
    console.log(`    ${c.externalId ?? '(no externalId)'} — ${c.name}`);
  console.log(`  possessions: ${hominemOnlyPossessions.length}`);
  for (const p of hominemOnlyPossessions)
    console.log(`    ${p.externalId} — ${p.name} (${p.status}${p.archived ? ', archived' : ''})`);

  console.log(`\n== Item container references ==`);
  console.log(`  orphan (resolves nowhere, CON-036 class): ${orphanRefs.length}`);
  for (const r of orphanRefs) console.log(`    ${r.item} -> ${r.container}`);
  console.log(`  resolves only in Hominem (CON-024 class): ${resolvesOnlyInHominem.length}`);
  for (const r of resolvesOnlyInHominem) console.log(`    ${r.item} -> ${r.container}`);

  const nextCon = nextConId([...liveContainerIds, ...sheetContainerIds]);
  console.log(`\nNext free CON-xxx id: ${nextCon} (for a Hominem-native container needing one)`);

  const mapped = {
    itemsToImport: missingItems.map((p) => p.externalId),
    containersToImport: missingContainers.map((c) => c.externalId),
    hominemOnlyPossessions: hominemOnlyPossessions.map((p) => p.externalId),
    hominemOnlyContainers: hominemOnlyContainers.map((c) => c.externalId),
    orphanRefs: orphanRefs.map((r) => `${r.item}->${r.container}`),
  };
  writeFileSync(join(dir, 'diff-report.json'), JSON.stringify(mapped, null, 2));
  console.log(
    `\nMachine-readable report: ${join(dir, 'diff-report.json')} (read-only; nothing written to the database)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
