import { db } from '@hominem/db/core';

import {
  computeSheetExternalId,
  importSheetTransactions,
  normalizeSource,
  validateSheetBatch,
  type SheetImportSummary,
  type SheetTransactionInput,
} from './sheet-import';

/**
 * Append-only import for bank feeds. A re-sync never rewrites what's already in
 * the ledger: the bank's copy only ever creates rows that are missing.
 *
 * Each incoming row is matched against stored rows on the same account:
 *   1. same provider ID: already here, leave it alone.
 *   2. same date, amount, currency and description, no provider ID yet: that's
 *      the same transaction from an older import, so stamp the provider ID on it.
 *      A row's original `sheet:` ID counts too, so editing it doesn't spawn a twin.
 *   3. same date, amount and currency, no provider ID yet: same deal, someone
 *      renamed it or typed it in by hand. Stamp the ID, keep their words.
 *   4. nothing: insert.
 * Every stored row can only be claimed once, and exact matches claim first.
 */

interface StoredRow {
  id: string;
  accountId: string;
  externalId: string | null;
  source: string | null;
  postedOn: string;
  amountCents: number;
  currencyCode: string;
  description: string | null;
}

interface IncomingRow {
  index: number;
  input: SheetTransactionInput;
  accountId: string;
  externalId: string;
}

function moneyKey(row: {
  accountId: string;
  postedOn: string;
  amountCents: number;
  currencyCode: string;
}): string {
  return JSON.stringify([row.accountId, row.postedOn, row.amountCents, row.currencyCode]);
}

function incomingNaturalId({ input, accountId }: IncomingRow): string {
  return computeSheetExternalId(
    input.postedOn,
    accountId,
    input.description,
    input.amountCents,
    input.currencyCode.toUpperCase(),
  );
}

function isUnclaimed(row: StoredRow): boolean {
  return row.externalId === null || row.externalId.startsWith('sheet:');
}

async function storedRows(userId: string, incoming: IncomingRow[]): Promise<StoredRow[]> {
  if (!incoming.length) return [];
  const accountIds = [...new Set(incoming.map((row) => row.accountId))];
  const dates = incoming.map((row) => row.input.postedOn).sort();
  // Provider IDs, plus the `sheet:` IDs an older import would've given these rows.
  const externalIds = incoming.flatMap((row) => [row.externalId, incomingNaturalId(row)]);
  const rows = await db
    .selectFrom('app.financeTransactions')
    .select([
      'id',
      'accountId',
      'externalId',
      'source',
      'postedOn',
      'amount',
      'currencyCode',
      'description',
    ])
    .where('userId', '=', userId)
    .where('accountId', 'in', accountIds)
    // A stored row can drift out of the date window (the user moved it, or the
    // bank restated it), so IDs are looked up regardless of date.
    .where((expression) =>
      expression.or([
        expression.and([
          expression('postedOn', '>=', dates[0]),
          expression('postedOn', '<=', dates[dates.length - 1]),
        ]),
        expression('externalId', 'in', externalIds),
      ]),
    )
    .orderBy('id')
    .execute();
  return rows.map((row) => ({
    ...row,
    postedOn: String(row.postedOn).slice(0, 10),
    amountCents: Math.round(Number(row.amount) * 100),
  }));
}

function planMatches(incoming: IncomingRow[], stored: StoredRow[]) {
  const known = new Map<string, StoredRow>();
  const unclaimedByNaturalId = new Map<string, StoredRow[]>();
  const unclaimedByMoney = new Map<string, StoredRow[]>();
  for (const row of stored) {
    if (!isUnclaimed(row)) {
      known.set(JSON.stringify([row.accountId, row.externalId]), row);
      continue;
    }
    const naturalId = computeSheetExternalId(
      row.postedOn,
      row.accountId,
      row.description ?? '',
      row.amountCents,
      row.currencyCode,
    );
    // Current values and the original import ID usually agree; edits split them.
    const naturalIds = new Set([naturalId, row.externalId ?? naturalId]);
    for (const [map, key] of [
      ...[...naturalIds].map((id) => [unclaimedByNaturalId, id] as const),
      [unclaimedByMoney, moneyKey(row)] as const,
    ]) {
      const group = map.get(key) ?? [];
      group.push(row);
      map.set(key, group);
    }
  }

  const claimed = new Set<string>();
  const take = (rows: StoredRow[] | undefined) => {
    const row = rows?.find((candidate) => !claimed.has(candidate.id));
    if (row) claimed.add(row.id);
    return row;
  };
  const existing: Array<{ incoming: IncomingRow; stored: StoredRow }> = [];
  const adopt: Array<{ incoming: IncomingRow; stored: StoredRow; exact: boolean }> = [];
  const unseen: IncomingRow[] = [];
  for (const row of incoming) {
    const match = known.get(JSON.stringify([row.accountId, row.externalId]));
    if (match) existing.push({ incoming: row, stored: match });
    else unseen.push(row);
  }
  const leftover: IncomingRow[] = [];
  for (const row of unseen) {
    const match = take(unclaimedByNaturalId.get(incomingNaturalId(row)));
    if (match) adopt.push({ incoming: row, stored: match, exact: true });
    else leftover.push(row);
  }
  const insert: IncomingRow[] = [];
  for (const row of leftover) {
    const match = take(
      unclaimedByMoney.get(
        moneyKey({
          accountId: row.accountId,
          postedOn: row.input.postedOn,
          amountCents: row.input.amountCents,
          currencyCode: row.input.currencyCode.toUpperCase(),
        }),
      ),
    );
    if (match) adopt.push({ incoming: row, stored: match, exact: false });
    else insert.push(row);
  }
  return { existing, adopt, insert };
}

export async function appendProviderTransactions(
  userId: string,
  options: { transactions: SheetTransactionInput[]; dryRun?: boolean },
): Promise<SheetImportSummary & { warnings: string[] }> {
  const { transactions, dryRun = false } = options;
  const { valid, rejected } = await validateSheetBatch(userId, transactions);
  // Only rows carrying a real provider ID can be matched this way; the rest keep
  // the natural-key import, which also leaves annotations alone.
  const identified: IncomingRow[] = [];
  const anonymous: IncomingRow[] = [];
  for (const row of valid) {
    (row.input.externalId?.trim() ? identified : anonymous).push(row);
  }
  const plan = planMatches(identified, await storedRows(userId, identified));

  const warnings: string[] = [];
  const changed = [...plan.existing, ...plan.adopt.filter(({ exact }) => exact)].filter(
    ({ incoming, stored }) =>
      incoming.input.amountCents !== stored.amountCents ||
      incoming.input.currencyCode.toUpperCase() !== stored.currencyCode,
  );
  for (const { incoming, stored } of changed) {
    warnings.push(
      `Kept the stored ${stored.postedOn} ${stored.description ?? ''} (${stored.amountCents} ${stored.currencyCode}); the bank now reports ${incoming.input.amountCents} ${incoming.input.currencyCode.toUpperCase()}.`,
    );
  }
  for (const { incoming, stored, exact } of plan.adopt) {
    if (exact) continue;
    warnings.push(
      `Matched bank transaction ${incoming.input.postedOn} ${incoming.input.description} to the stored row "${stored.description ?? ''}" (same date and amount); nothing was added.`,
    );
  }

  const summary: SheetImportSummary & { warnings: string[] } = {
    received: transactions.length,
    upserted: plan.existing.length,
    created: 0,
    updated: 0,
    rejected,
    accountsAutoProvisioned: [],
    warnings,
  };

  const inserts = [...plan.insert, ...anonymous];
  for (const { incoming, stored } of plan.adopt) {
    if (dryRun) {
      summary.updated += 1;
      summary.upserted += 1;
      continue;
    }
    // Compare-and-set: if another run claimed this row first, treat ours as new.
    const result = await db
      .updateTable('app.financeTransactions')
      .set({
        externalId: incoming.externalId,
        source: normalizeSource(incoming.input.source),
      })
      .where('userId', '=', userId)
      .where('id', '=', stored.id)
      .where((expression) =>
        stored.externalId === null
          ? expression('externalId', 'is', null)
          : expression('externalId', '=', stored.externalId),
      )
      .executeTakeFirst();
    if (result.numUpdatedRows > 0n) {
      summary.updated += 1;
      summary.upserted += 1;
    } else {
      inserts.push(incoming);
    }
  }

  // A dry run already knows what the plan inserts. Asking the importer would
  // undercount, since the rows we're about to claim aren't stamped yet.
  const pending = dryRun ? anonymous : inserts;
  const appended = await importSheetTransactions(userId, {
    transactions: pending.map((row) => row.input),
    mode: 'append',
    dryRun,
    existingRows: 'keep',
  });
  const planned = dryRun ? plan.insert.length : 0;
  summary.created = planned + appended.created;
  summary.upserted += planned + appended.upserted;
  summary.rejected.push(
    ...appended.rejected.map((row) => ({ ...row, index: pending[row.index].index })),
  );
  return summary;
}
