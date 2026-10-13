/**
 * Read-only Phase 3 verification (plan §9): is the live registry a faithful mirror of the
 * imported sheet? Re-runnable; never writes.
 *
 *   pnpm --filter @hominem/api exec tsx scripts/verify-possessions-phase3.ts \
 *     --email you@ponti.io --dir ~/Downloads/possessions
 *
 * Checks, scoped to the owner:
 *   1. Counts & exactly-once: every sheet item/container id present in Hominem exactly
 *      once by externalId; no duplicates on either side.
 *   2. Field parity: existing-row deltas reported by diff-possessions.ts (run it on the
 *      same dir) — this script prints only the count plus the plan's spot sample.
 *   3. Spot sample: the plan's required cases — one `created_from_existing_item`, one
 *      serial number with leading zeros, one item in CON-024, and the highest-value items.
 *   4. possession_validate findings, grouped for triage (CON-036 is expected + pre-triaged).
 *   5. possession_summary totals (compare against the finance sheet's expectations).
 *   6. vessel_weight_report (compare against the weights tab, row by row).
 *
 * Writes `verify-report.json` beside the CSVs. Everything is read-only.
 */

import { readFileSync, writeFileSync } from 'node:fs';
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
import {
  summarizePossessions,
  validatePossessions,
  vesselWeightReport,
} from '../src/application/possessions.service';

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

const duplicates = (ids: (string | null)[]) => {
  const seen = new Map<string, number>();
  for (const id of ids) if (id) seen.set(id, (seen.get(id) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
};

async function main() {
  const email = arg('email');
  const dir = arg('dir')?.replace(/^~/, process.env.HOME ?? '~');
  if (!email || !dir) die('Usage: verify-possessions-phase3.ts --email <email> --dir <folder>');

  const user = await db
    .selectFrom('user')
    .select(['id', 'email'])
    .where('email', '=', email)
    .executeTakeFirst();
  if (!user) die(`No user with email ${email}`);

  // ── 1. Counts & exactly-once ─────────────────────────────────────
  const seen = new Set<string>();
  const sheetItems = readCsv(dir, 'master.csv')
    .map(mapPossessionRow)
    .filter(
      (p): p is MappedPossession =>
        p !== null && !seen.has(p.externalId) && !!seen.add(p.externalId),
    );
  const sheetContainers = readCsv(dir, 'containers.csv')
    .map(mapContainerRow)
    .filter((c): c is MappedContainer => c !== null);

  const [liveItems, liveContainers] = await Promise.all([
    PossessionRepository.auditables(db, user.id),
    ContainerRepository.list(db, user.id),
  ]);
  const liveExternalIds = liveItems.map((p) => p.externalId);
  const liveItemById = new Map(liveItems.map((p) => [p.externalId, p]));
  const missingItems = sheetItems.filter((p) => !liveItemById.has(p.externalId));
  const dupSheet = duplicates(sheetItems.map((p) => p.externalId));
  const dupLive = duplicates(liveExternalIds);

  const liveContainerById = new Map(liveContainers.map((c) => [c.externalId, c]));
  const missingContainers = sheetContainers.filter((c) => !liveContainerById.has(c.externalId));
  const dupContainers = duplicates(sheetContainers.map((c) => c.externalId));
  const dupContainersLive = duplicates(liveContainers.map((c) => c.externalId));

  // ── 3. Spot sample ───────────────────────────────────────────────
  const spotAquisition = sheetItems.find(
    (p) =>
      p.input.acquisitionType === 'created_from_existing_item' && liveItemById.has(p.externalId),
  );
  const spotSerial = sheetItems.find(
    (p) => (p.input.serialNumber ?? '').startsWith('0') && liveItemById.has(p.externalId),
  );
  const con024 = [...liveContainers].find((c) => c.externalId === 'CON-024');
  const spotCon024 = sheetItems.find((p) => p.containerExternalId === 'CON-024');
  const topValue = [...liveItems]
    .filter((p) => (p.priceCents ?? 0) > 0)
    .sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0))
    .slice(0, 5)
    .map((p) => p.externalId);

  // ── 4. validate ──────────────────────────────────────────────────
  const { findings, total: findingsTotal } = await validatePossessions(user.id);
  const byCode = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.code] = (acc[f.code] ?? 0) + 1;
    return acc;
  }, {});

  // ── 5. summary ───────────────────────────────────────────────────
  const summary = await summarizePossessions(user.id);

  // ── 6. vessel report ─────────────────────────────────────────────
  const report = await vesselWeightReport(user.id);

  const out = {
    counts: {
      sheetItems: sheetItems.length,
      sheetContainers: sheetContainers.length,
      liveItems: liveItems.length,
      liveContainers: liveContainers.length,
      missingItems: missingItems.map((p) => p.externalId),
      missingContainers: missingContainers.map((c) => c.externalId),
      duplicateSheetItemIds: dupSheet,
      duplicateLiveItemIds: dupLive,
      duplicateSheetContainerIds: dupContainers,
      duplicateLiveContainerIds: dupContainersLive,
    },
    spotSample: {
      createdFromExistingItem: spotAquisition
        ? { externalId: spotAquisition.externalId, name: spotAquisition.input.name }
        : null,
      serialWithLeadingZero: spotSerial
        ? { externalId: spotSerial.externalId, serial: spotSerial.input.serialNumber }
        : null,
      inCon024: spotCon024 ? { externalId: spotCon024.externalId } : null,
      con024InLive: Boolean(con024),
      topValueByPrice: topValue,
    },
    validate: { total: findingsTotal, byCode, codes: [...new Set(findings.map((f) => f.code))] },
    summary: {
      total: summary.total,
      valueByCurrency: summary.valueByCurrency,
    },
    vesselReport: {
      vessels: report.vessels.length,
      groups: report.groups,
      unassigned: report.unassigned,
      truncated: report.truncated,
    },
  };
  writeFileSync(join(dir, 'verify-report.json'), JSON.stringify(out, null, 2));

  console.log(`User: ${user.email}`);
  console.log(
    `Counts: ${out.counts.liveItems} live possessions / ${out.counts.sheetItems} sheet items` +
      ` | ${out.counts.liveContainers} live containers / ${out.counts.sheetContainers} sheet containers`,
  );
  console.log(
    `  missing: ${out.counts.missingItems.length} items, ${out.counts.missingContainers.length} containers` +
      ` | duplicate ids: live ${out.counts.duplicateLiveItemIds.length}/${out.counts.duplicateLiveContainerIds.length}, sheet ${out.counts.duplicateSheetItemIds.length}/${out.counts.duplicateSheetContainerIds.length}`,
  );
  console.log(
    `Spot sample: created_from_existing_item=${spotAquisition?.externalId}` +
      ` serial-leading-zero=${spotSerial?.externalId} in-CON-024=${spotCon024?.externalId}` +
      ` (CON-024 live=${con024 ? 'yes' : 'no'}) top-value=${topValue.slice(0, 3).join(',')}...`,
  );
  console.log(`Validate: ${findingsTotal} findings`, byCode);
  console.log(
    `Summary total: ${summary.total} — value by currency:`,
    summary.valueByCurrency
      .map((v) => `${v.currencyCode ?? '?'}=${(v.priceCents / 100).toFixed(2)}`)
      .join(', '),
  );
  console.log(
    `Vessel report: ${report.vessels.length} vessels, groups:`,
    report.groups.map((g) => `${g.group} ${g.totalKg.toFixed(2)}/limit ${g.limitKg}`).join(', '),
    `unassigned ${report.unassigned.count}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
