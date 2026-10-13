/**
 * Read-only Phase 3 verification (plan §9): is the live registry a faithful mirror of the
 * imported sheet? Re-runnable; never writes.
 *
 *   pnpm --filter @hominem/api exec tsx scripts/verify-possessions-phase3.ts \
 *     --email you@ponti.io --dir ~/Downloads/possessions
 *
 * Checks, scoped to the owner:
 *   1. Counts & exactly-once: every sheet item/container id present in Hominem exactly
 *      once by externalId; duplicates detected on the raw source rows (not pre-deduped).
 *   2. Field parity: embeds the field deltas computed by diff-possessions.ts (run it on
 *      the same dir first) and says so explicitly when it has not been run.
 *   3. Spot samples: the plan's required cases — one `created_from_existing_item`, one
 *      serial number with leading zeros, one item in CON-024 — plus every one of the 20
 *      highest-value items, each compared field-by-field against the sheet.
 *   4. possession_validate findings, paged to completion, grouped for triage
 *      (CON-036 is expected + pre-triaged).
 *   5. possession_summary totals (compare against the finance sheet's expectations).
 *   6. vessel_weight_report, including every per-vessel row (compare against the weights
 *      tab, row by row).
 *
 * Writes `verify-report.json` beside the CSVs. Everything is read-only.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { db } from '@hominem/db/core';
import {
  ContainerRepository,
  PossessionRepository,
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
import {
  summarizePossessions,
  validatePossessions,
  vesselWeightReport,
  type PossessionFinding,
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
  // Keep every mapped row for duplicate detection; de-duplicate only for the presence and
  // parity comparisons, so the exactly-once check sees the source file as written.
  const rawSheetItems = readCsv(dir, 'master.csv')
    .map(mapPossessionRow)
    .filter((p): p is MappedPossession => p !== null);
  const seen = new Set<string>();
  const sheetItems = rawSheetItems.filter(
    (p) => !seen.has(p.externalId) && !!seen.add(p.externalId),
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
  const dupSheet = duplicates(rawSheetItems.map((p) => p.externalId));
  const dupLive = duplicates(liveExternalIds);

  const liveContainerById = new Map(liveContainers.map((c) => [c.externalId, c]));
  const missingContainers = sheetContainers.filter((c) => !liveContainerById.has(c.externalId));
  const dupContainers = duplicates(sheetContainers.map((c) => c.externalId));
  const dupContainersLive = duplicates(liveContainers.map((c) => c.externalId));

  // ── 2. Field parity (diff-possessions.ts output on the same dir) ──
  const diffPath = join(dir, 'diff-report.json');
  const diffExists = existsSync(diffPath);
  const diff: {
    modifiedRows?: Array<{ externalId: string; changed: string[] }>;
    modifiedContainers?: Array<{ externalId: string; changed: string[] }>;
  } = diffExists ? JSON.parse(readFileSync(diffPath, 'utf8')) : {};
  const fieldParity = {
    available: diffExists,
    note: diffExists
      ? null
      : 'run diff-possessions.ts --dir <same dir> first to establish field parity',
    modifiedPossessions: diff.modifiedRows ?? [],
    modifiedContainers: diff.modifiedContainers ?? [],
  };

  // ── 3. Spot samples: compare values, not mere existence ───────────
  const same = (a: unknown, b: unknown) =>
    typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;
  const compareField = (
    possession: MappedPossession | undefined,
    field: keyof PossessionInput & keyof PossessionRecord,
  ) => {
    if (!possession) return null;
    const live = liveItemById.get(possession.externalId);
    return {
      externalId: possession.externalId,
      field,
      expected: possession.input[field] ?? null,
      actual: live ? (live[field] ?? null) : null,
      matches: live ? same(possession.input[field], live[field]) : false,
    };
  };
  const spotAquisition = sheetItems.find(
    (p) => p.input.acquisitionType === 'created_from_existing_item',
  );
  const spotSerial = sheetItems.find((p) => (p.input.serialNumber ?? '').startsWith('0'));
  const con024 = liveContainers.find((c) => c.externalId === 'CON-024');
  const spotCon024 = sheetItems.find((p) => p.containerExternalId === 'CON-024');

  const SPOT_FIELDS = [
    'name',
    'status',
    'category',
    'subCategory',
    'brand',
    'model',
    'acquiredDate',
    'retiredDate',
    'priceCents',
    'sellPriceCents',
    'currencyCode',
    'color',
    'size',
    'serialNumber',
    'notes',
    'weightKg',
    'moveAction',
    'acquisitionType',
    'purchaseCurrency',
    'retirementMethod',
    'ownershipType',
  ] as const satisfies ReadonlyArray<keyof PossessionInput & keyof PossessionRecord>;
  const sheetItemById = new Map(sheetItems.map((p) => [p.externalId, p]));
  const topValueChecks = [...liveItems]
    .filter((p) => (p.priceCents ?? 0) > 0)
    .sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0))
    .slice(0, 20)
    .map((live): { externalId: string | null; inSheet: boolean; mismatches: string[] } => {
      const sheet = live.externalId ? sheetItemById.get(live.externalId) : undefined;
      if (!sheet) return { externalId: live.externalId, inSheet: false, mismatches: [] };
      const mismatches = SPOT_FIELDS.filter((field) => !same(sheet.input[field], live[field]));
      return { externalId: live.externalId, inSheet: true, mismatches };
    });

  // ── 4. validate (paged to completion) ─────────────────────────────
  const findings: PossessionFinding[] = [];
  let findingsTotal = 0;
  for (let offset = 0; ;) {
    const page = await validatePossessions(user.id, { limit: 1000, offset });
    findings.push(...page.findings);
    findingsTotal = page.total;
    offset += page.findings.length;
    if (page.findings.length === 0 || offset >= findingsTotal) break;
  }
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
      sheetItems: rawSheetItems.length,
      sheetItemsUnique: sheetItems.length,
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
    fieldParity,
    spotSample: {
      createdFromExistingItem: compareField(spotAquisition, 'acquisitionType'),
      serialWithLeadingZero: compareField(spotSerial, 'serialNumber'),
      inCon024: spotCon024
        ? {
            externalId: spotCon024.externalId,
            expectedContainer: 'CON-024',
            actualContainerId: liveItemById.get(spotCon024.externalId)?.containerId ?? null,
            matches: liveItemById.get(spotCon024.externalId)?.containerId === con024?.id,
          }
        : null,
      con024InLive: Boolean(con024),
      topValueFieldChecks: topValueChecks,
    },
    validate: { total: findingsTotal, byCode, codes: [...new Set(findings.map((f) => f.code))] },
    summary: { total: summary.total, valueByCurrency: summary.valueByCurrency },
    vesselReport: {
      vessels: report.vessels,
      groups: report.groups,
      unassigned: report.unassigned,
      truncated: report.truncated,
    },
  };
  writeFileSync(join(dir, 'verify-report.json'), JSON.stringify(out, null, 2));

  const parityLabel = fieldParity.available
    ? `${fieldParity.modifiedPossessions.length} item + ${fieldParity.modifiedContainers.length} container deltas`
    : `NOT RUN (${fieldParity.note})`;
  const spotMismatches = topValueChecks.reduce((n, c) => n + c.mismatches.length, 0);
  console.log(`User: ${user.email}`);
  console.log(
    `Counts: ${out.counts.liveItems} live possessions / ${out.counts.sheetItems} sheet items` +
      ` | ${out.counts.liveContainers} live containers / ${out.counts.sheetContainers} sheet containers`,
  );
  console.log(
    `  missing: ${out.counts.missingItems.length} items, ${out.counts.missingContainers.length} containers` +
      ` | duplicate ids: live ${out.counts.duplicateLiveItemIds.length}/${out.counts.duplicateLiveContainerIds.length}, sheet ${out.counts.duplicateSheetItemIds.length}/${out.counts.duplicateSheetContainerIds.length}`,
  );
  console.log(`Field parity: ${parityLabel}`);
  const verdict = (result: { matches: boolean } | null) =>
    result ? (result.matches ? 'match' : 'MISMATCH') : 'n/a (no such item)';
  console.log(
    `Spot sample: created_from_existing_item=${verdict(out.spotSample.createdFromExistingItem)}` +
      ` serial-leading-zero=${verdict(out.spotSample.serialWithLeadingZero)}` +
      ` in-CON-024=${verdict(out.spotSample.inCon024)}` +
      ` top-20 mismatched fields=${spotMismatches}`,
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
