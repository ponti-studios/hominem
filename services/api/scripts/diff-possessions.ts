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
 *   - existing possessions and containers whose mapped sheet values differ from the live
 *     record (the fields an import would overwrite, including parent links — the
 *     "live data wins" review surface),
 *   - item/parent references to a sheet-only container as pending link changes (the
 *     importer creates the container in the same run),
 *   - Hominem-only records absent from the sheet (reconcile — keep unless told otherwise),
 *   - item container references that resolve nowhere (the CON-036 orphan class),
 *   - references to a container the sheet lacks but Hominem has (the CON-024 class),
 *   - the next free CON-xxx id, for a Hominem-native container that needs one.
 *
 * Writes `diff-report.json` (full lists incl. field deltas and the next CON id) into the
 * CSV directory. Read-only: never writes to the database.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { db } from '@hominem/db/core';
import {
  ContainerRepository,
  PossessionRepository,
  type ContainerInput,
  type ContainerRecord,
  type PossessionInput,
  type PossessionRecord,
} from '@hominem/db/possessions';
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
  // Resolution mirroring import-possessions.ts: the live registry first, then sheet
  // containers (the importer upserts those and links against the result within the run).
  const containerIdByExternalId = new Map<string, string>();
  for (const c of liveContainers) if (c.externalId) containerIdByExternalId.set(c.externalId, c.id);

  // A ref to a sheet-only container is not "resolves nowhere": the importer creates the
  // container in the same run and links against it, so it is a pending link change.
  const resolveLink = (
    externalId: string | null,
  ): { id: string | null; pending: string | null } => {
    if (!externalId) return { id: null, pending: null };
    const id = containerIdByExternalId.get(externalId);
    if (id) return { id, pending: null };
    if (sheetContainerIds.has(externalId)) return { id: null, pending: externalId };
    return { id: null, pending: null };
  };

  const missingItems = possessions.filter((p) => !livePossessionIds.has(p.externalId));
  const missingContainers = containers.filter((c) => !liveContainerIds.has(c.externalId));
  const hominemOnlyPossessions = livePossessions
    .filter((p) => p.externalId === null || !sheetPossessionIds.has(p.externalId))
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

  // Existing rows whose mapped sheet values differ from the live record: the importer
  // upserts every sheet row, so these are the non-new rows it will overwrite. This is the
  // "live data wins" review surface the plan wants before any --apply.
  const same = (a: unknown, b: unknown): boolean => {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
    return a === b;
  };
  const DELTA_FIELDS = [
    'name',
    'category',
    'subCategory',
    'brand',
    'model',
    'status',
    'isArchived',
    'acquiredDate',
    'retiredDate',
    'priceCents',
    'sellPriceCents',
    'currencyCode',
    'color',
    'size',
    'serialNumber',
    'placement',
    'url',
    'notes',
    'weightKg',
    'volumeCbm',
    'moveAction',
    'acquisitionType',
    'purchaseCurrency',
    'retirementMethod',
    'ownershipType',
  ] as const satisfies ReadonlyArray<keyof PossessionInput & keyof PossessionRecord>;
  const liveByExternalId = new Map(livePossessions.map((p) => [p.externalId, p]));
  const modifiedRows: Array<{ externalId: string; name: string; changed: string[] }> = [];
  for (const possession of possessions) {
    const live = possession.externalId ? liveByExternalId.get(possession.externalId) : undefined;
    if (!live) continue;
    const input = possession.input;
    const changed: string[] = [];
    for (const field of DELTA_FIELDS) {
      if (!same(input[field], live[field])) changed.push(field);
    }
    const link = resolveLink(possession.containerExternalId);
    if (link.pending) changed.push(`containerId (pending link to ${link.pending})`);
    else if (!same(link.id, live.containerId)) changed.push('containerId');
    if (JSON.stringify(input.metadata ?? {}) !== JSON.stringify(live.metadata ?? {}))
      changed.push('metadata');
    if (changed.length)
      modifiedRows.push({ externalId: possession.externalId, name: live.name, changed });
  }
  modifiedRows.sort((a, b) => a.externalId.localeCompare(b.externalId));

  // Existing containers the importer will overwrite, field by field, including the parent
  // link (a sheet-only parent is a pending link; an empty parent clears the live parent).
  const CONTAINER_DELTA_FIELDS = [
    'name',
    'containerType',
    'containerKind',
    'status',
    'description',
    'currentLocation',
    'weightKg',
    'volumeCbm',
    'trackingReference',
  ] as const satisfies ReadonlyArray<keyof ContainerInput & keyof ContainerRecord>;
  const liveContainerById = new Map(liveContainers.map((c) => [c.externalId, c]));
  const modifiedContainers: Array<{ externalId: string; name: string; changed: string[] }> = [];
  for (const container of containers) {
    const live = container.externalId ? liveContainerById.get(container.externalId) : undefined;
    if (!live) continue;
    const input = container.input;
    const changed: string[] = [];
    for (const field of CONTAINER_DELTA_FIELDS) {
      if (!same(input[field], live[field])) changed.push(field);
    }
    if (JSON.stringify(input.metadata ?? {}) !== JSON.stringify(live.metadata ?? {}))
      changed.push('metadata');
    const parent = resolveLink(container.parentExternalId);
    if (parent.pending) changed.push(`parentContainerId (pending link to ${parent.pending})`);
    else if (!same(parent.id, live.parentContainerId)) changed.push('parentContainerId');
    if (changed.length)
      modifiedContainers.push({ externalId: container.externalId, name: live.name, changed });
  }
  modifiedContainers.sort((a, b) => a.externalId.localeCompare(b.externalId));

  console.log(`User: ${user.email}`);
  console.log(`Sheet: ${possessions.length} items, ${containers.length} containers`);
  console.log(`Live: ${livePossessions.length} possessions, ${liveContainers.length} containers`);

  console.log(`\n== To import (in sheet, missing from Hominem) ==`);
  console.log(`  items: ${missingItems.length}`);
  for (const item of missingItems) console.log(`    ${item.externalId} — ${item.input.name}`);
  console.log(`  containers: ${missingContainers.length}`);
  for (const c of missingContainers) console.log(`    ${c.externalId} — ${c.input.name}`);

  console.log(`\n== Will modify existing rows (fields the import overwrites) ==`);
  console.log(`  possessions: ${modifiedRows.length}`);
  for (const row of modifiedRows.slice(0, 20))
    console.log(`    ${row.externalId} — ${row.name}: ${row.changed.join(', ')}`);
  if (modifiedRows.length > 20)
    console.log(`    … and ${modifiedRows.length - 20} more (full list in diff-report.json)`);
  console.log(`  containers: ${modifiedContainers.length}`);
  for (const row of modifiedContainers.slice(0, 20))
    console.log(`    ${row.externalId} — ${row.name}: ${row.changed.join(', ')}`);
  if (modifiedContainers.length > 20)
    console.log(`    … and ${modifiedContainers.length - 20} more (full list in diff-report.json)`);

  console.log(`\n== Hominem-only (in Hominem, absent from sheet) — keep unless told otherwise ==`);
  console.log(`  containers: ${hominemOnlyContainers.length}`);
  for (const c of hominemOnlyContainers)
    console.log(`    ${c.externalId ?? '(no externalId)'} — ${c.name}`);
  console.log(`  possessions: ${hominemOnlyPossessions.length}`);
  for (const p of hominemOnlyPossessions)
    console.log(
      `    ${p.externalId ?? '(no externalId)'} — ${p.name} (${p.status}${p.archived ? ', archived' : ''})`,
    );

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
    resolvesOnlyInHominem: resolvesOnlyInHominem.map((r) => `${r.item}->${r.container}`),
    nextCon,
    modifiedRows,
    modifiedContainers,
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
