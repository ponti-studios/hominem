import {
  EMPTY_DOCTRINE,
  getFinanceAccountList,
  linkTransferPair,
  naturalKey,
  plaidItemsToRows,
  routeRow,
  starlingFeedsToItems,
  starlingItemsToRows,
  toCents,
  type FinanceAccountRoute,
  type SheetTransactionInput,
  type SyncRow,
} from '@hominem/finance-services';
import type { z } from 'zod';

import type { financeSyncInputSchema } from '../schemas/finance.sync.schema';
import { getSyncDoctrine } from './finance.doctrine.service';
import { importFinanceTransactions, searchTransactions } from './finance.service';

async function linkTransfers(
  userId: string,
  from: string,
  to: string,
): Promise<{ linked: string[]; warning?: string }> {
  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 3);
  const transactions: Awaited<ReturnType<typeof searchTransactions>>['data'] = [];
  let cursor: string | null = null;
  let scanned = 0;
  do {
    const page = await searchTransactions(userId, {
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: to,
      categoryName: 'Transfers',
      limit: 500,
      cursor: cursor ?? undefined,
    });
    scanned += page.data.length;
    transactions.push(...page.data.filter((transaction) => !transaction.counterpartId));
    cursor = page.nextCursor;
    if (scanned >= 10_000 && cursor) {
      return {
        linked: [],
        warning:
          'Transfer linking skipped because the sync window contains more than 10,000 transfers.',
      };
    }
  } while (cursor);

  const linked: string[] = [];
  const linkedIds = new Set<string>();
  const byKey = new Map<string, typeof transactions>();
  for (const transaction of transactions) {
    const key = JSON.stringify([toCents(transaction.amount), transaction.currencyCode]);
    const group = byKey.get(key) ?? [];
    group.push(transaction);
    byKey.set(key, group);
  }
  const candidatesFor = (transaction: (typeof transactions)[number]) =>
    (
      byKey.get(JSON.stringify([-toCents(transaction.amount), transaction.currencyCode])) ?? []
    ).filter(
      (other) =>
        other.accountId !== transaction.accountId &&
        !linkedIds.has(other.id) &&
        Math.abs(Date.parse(other.postedOn) - Date.parse(transaction.postedOn)) <= 3 * 86_400_000,
    );
  for (const transaction of transactions) {
    if (linked.length === 1000) {
      return {
        linked,
        warning:
          'Transfer linking reached its 1,000-pair limit; rerun sync to process remaining pairs.',
      };
    }
    if (linkedIds.has(transaction.id)) continue;
    const candidates = candidatesFor(transaction);
    if (candidates.length !== 1) continue;
    const counterpart = candidates[0];
    const reverse = candidatesFor(counterpart);
    if (reverse.length !== 1 || reverse[0].id !== transaction.id) continue;
    if (!(await linkTransferPair(userId, transaction.id, counterpart.id))) continue;
    linkedIds.add(transaction.id);
    linkedIds.add(counterpart.id);
    linked.push(
      `linked ${transaction.postedOn} ${(transaction.description ?? '').slice(0, 26)} ${toCents(transaction.amount)} (${transaction.accountName}) <-> ${(counterpart.description ?? '').slice(0, 26)} (${counterpart.accountName})`,
    );
  }
  return { linked };
}

export async function financeSync(userId: string, input: z.output<typeof financeSyncInputSchema>) {
  const [accountsResult, doctrineResult] = await Promise.all([
    getFinanceAccountList(userId),
    getSyncDoctrine(userId),
  ]);
  const accounts: FinanceAccountRoute[] = accountsResult.accounts.map((account) => ({
    ...account,
    balance: account.balanceCents / 100,
  }));
  const doctrine = doctrineResult.doctrine ?? EMPTY_DOCTRINE;
  const warnings: string[] = [];
  if (!doctrineResult.doctrine) {
    warnings.push('No sync doctrine is configured; unmatched merchants remain Uncategorized.');
  }
  if (accounts.length === 0) {
    warnings.push('No open finance accounts are configured; provider rows are held for mapping.');
  }

  const starling = starlingItemsToRows(starlingFeedsToItems(input.starling), doctrine);
  const plaid = input.plaid ? plaidItemsToRows(input.plaid, doctrine) : [];
  const rows = [...starling, ...plaid];
  if (rows.some((row) => !row.externalId)) {
    warnings.push('Some provider transactions have no stable ID and use the natural-key fallback.');
  }
  const seen = new Set<string>();
  const held: SyncRow[] = [];
  const send: SyncRow[] = [];
  for (const row of rows) {
    const routing = routeRow(row, accounts);
    if (routing.account) {
      row.accountId = routing.account.id;
      row.label = routing.account.name;
    } else {
      row.holdoutReason = routing.reason;
    }
    const key = row.externalId
      ? JSON.stringify([row.source, row.accountId ?? row.route, row.externalId])
      : naturalKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    (row.accountId ? send : held).push(row);
  }

  const transactions: SheetTransactionInput[] = send.map((row) => ({
    postedOn: row.date,
    account: row.accountId!,
    description: row.merchant || '(no description)',
    amountCents: toCents(row.amount),
    currencyCode: row.currency,
    source: row.source === 'Starling API' ? 'starling' : 'plaid',
    category: row.category || undefined,
    tags: row.tags,
    externalId: row.externalId,
  }));
  const result = transactions.length
    ? await importFinanceTransactions(userId, {
        transactions,
        mode: 'append',
        dryRun: input.dryRun,
      })
    : {
        received: 0,
        upserted: 0,
        created: 0,
        updated: 0,
        rejected: [],
        accountsAutoProvisioned: [],
      };
  const by_source: Record<string, number> = {};
  for (const row of send) by_source[row.source] = (by_source[row.source] ?? 0) + 1;
  const fresh = new Date(`${input.windows.until}T00:00:00Z`);
  fresh.setUTCDate(fresh.getUTCDate() - 2);
  const unmapped = send
    .filter((row) => !row.category && row.date >= fresh.toISOString().slice(0, 10))
    .map((row) => ({
      date: row.date,
      account: row.label,
      description: row.merchant,
      amount: row.amount,
    }));
  const transferResult =
    !input.dryRun && input.linkTransfers && result.rejected.length === 0
      ? await linkTransfers(
          userId,
          input.windows.starling_since < input.windows.plaid_since
            ? input.windows.starling_since
            : input.windows.plaid_since,
          input.windows.until,
        )
      : { linked: [] };
  if (transferResult.warning) warnings.push(transferResult.warning);

  return {
    ...result,
    ok: result.rejected.length === 0,
    added: result.created,
    by_source,
    held,
    new_labels: [...new Set(held.filter((row) => row.source === 'Plaid').map((row) => row.label))],
    unmapped,
    linked: transferResult.linked,
    windows: input.windows,
    watermarks: {
      starling_max: starling.reduce<string | null>(
        (latest, row) => (!latest || row.date > latest ? row.date : latest),
        null,
      ),
      plaid_max: plaid.reduce<string | null>(
        (latest, row) => (!latest || row.date > latest ? row.date : latest),
        null,
      ),
    },
    warnings,
    dryRun: input.dryRun,
  };
}
