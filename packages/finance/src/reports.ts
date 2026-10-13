import { db, sql } from '@hominem/db/core';

import { FINANCE_TRANSACTION_ENTITY_TYPE } from './contracts';
import { toCents } from './utils';

function fallbackDate(daysAgo: number, now: Date): string {
  return new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export async function getFinanceNetWorth(ownerUserId: string, includeClosed: boolean) {
  const now = new Date();

  const accounts = await db
    .selectFrom('app.financeAccounts as account')
    .leftJoin('app.financeInstitutions as institution', 'institution.id', 'account.institutionId')
    .select([
      'account.id',
      'account.name',
      'account.accountType',
      'account.currencyCode',
      'account.lifecycleStatus',
      'institution.name as institution',
      'account.includeInNetWorth',
    ])
    .where('account.userId', '=', ownerUserId)
    .where('account.includeInNetWorth', '=', true)
    .$if(!includeClosed, (qb) => qb.where('account.lifecycleStatus', '!=', 'closed'))
    .orderBy('account.name', 'asc')
    .execute();

  const warnings: string[] = [];
  const balances = await Promise.all(
    accounts.map(async (account) => {
      const ledgerDelta: { delta: number | null; latestPostedOn: string | null } | undefined =
        await db
          .selectFrom('app.financeTransactions')
          .select((eb) => [
            eb.fn.sum<number>('amount').as('delta'),
            eb.fn.max('postedOn').as('latestPostedOn'),
          ])
          .where('accountId', '=', account.id)
          .where('userId', '=', ownerUserId)
          .where('pending', '=', false)
          .executeTakeFirst();

      const balanceCents = toCents(ledgerDelta?.delta ?? 0);
      const balanceAsOf = ledgerDelta?.latestPostedOn ?? null;

      if (!ledgerDelta?.latestPostedOn) {
        warnings.push(`Account "${account.name}" has no transactions.`);
      }

      return {
        accountId: account.id,
        name: account.name,
        institution: account.institution,
        accountType: account.accountType,
        currencyCode: account.currencyCode,
        balanceCents,
        balanceAsOf,
      };
    }),
  );

  const totalsByCurrency = new Map<string, { totalCents: number; accountCount: number }>();
  for (const balance of balances) {
    const existing = totalsByCurrency.get(balance.currencyCode) ?? {
      totalCents: 0,
      accountCount: 0,
    };
    existing.totalCents += balance.balanceCents;
    existing.accountCount += 1;
    totalsByCurrency.set(balance.currencyCode, existing);
  }

  return {
    asOf: now.toISOString(),
    totals: [...totalsByCurrency.entries()].map(([code, t]) => ({
      currencyCode: code,
      ...t,
    })),
    accounts: balances,
    warnings,
  };
}

export async function getFinanceRecentTransactions(
  ownerUserId: string,
  opts: { accountId?: string; from?: string; to?: string; limit: number },
) {
  const { accountId, from, to, limit } = opts;

  let query = db
    .selectFrom('app.financeTransactions as t')
    .innerJoin('app.financeAccounts as a', 'a.id', 't.accountId')
    .leftJoin('app.financeCategories as c', 'c.id', 't.categoryId')
    .select([
      't.id',
      't.accountId',
      'a.name as accountName',
      't.postedOn',
      't.description',
      't.merchantName',
      't.amount',
      't.currencyCode',
      't.transactionType',
      't.categoryId',
      'c.name as categoryName',
      't.notes',
      't.source',
      't.recurring',
      't.excluded',
    ])
    .where('t.userId', '=', ownerUserId)
    .where('t.pending', '=', false);

  if (accountId !== undefined) {
    query = query.where('t.accountId', '=', accountId);
  }
  if (from !== undefined) {
    query = query.where('t.postedOn', '>=', from);
  }
  if (to !== undefined) {
    query = query.where('t.postedOn', '<=', to);
  }

  const rows = await query
    .orderBy('t.postedOn', 'desc')
    .orderBy('t.id', 'desc')
    .limit(limit)
    .execute();

  const tagNames = await getTransactionTagNames(
    ownerUserId,
    rows.map((row) => row.id),
  );

  const transactions = rows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    accountName: row.accountName,
    postedOn: row.postedOn,
    description: row.description ?? null,
    merchantName: row.merchantName ?? null,
    amountCents: toCents(row.amount),
    currencyCode: row.currencyCode,
    transactionType: row.transactionType,
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    tags: tagNames.get(row.id) ?? [],
    notes: row.notes ?? null,
    source: row.source,
    recurring: row.recurring === true,
    pending: false,
    excluded: row.excluded === true,
  }));

  return { transactions, count: transactions.length };
}

/** Tag names per transaction, owner-scoped, for a bounded set of transaction ids. */
export async function getTransactionTagNames(
  ownerUserId: string,
  ids: readonly string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .selectFrom('app.tagAssignments as ta')
    .innerJoin('app.tags as g', 'g.id', 'ta.tagId')
    .select(['ta.entityId', 'g.name'])
    .where('g.ownerUserid', '=', ownerUserId)
    .where('ta.entityTable', '=', sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`)
    .where('ta.entityId', 'in', ids as string[])
    .execute();
  for (const row of rows) {
    const list = map.get(row.entityId) ?? [];
    list.push(row.name);
    map.set(row.entityId, list);
  }
  return map;
}

export async function getFinanceSpendingByCategory(
  ownerUserId: string,
  opts: { from?: string; to?: string; limit: number },
) {
  const { from, to, limit } = opts;
  const now = new Date();
  const fromDate = from ?? fallbackDate(30, now);
  const toDate = to ?? now.toISOString().slice(0, 10);

  const currencyRows: Array<{ currencyCode: string }> = await db
    .selectFrom('app.financeTransactions')
    .select('currencyCode')
    .distinct()
    .where('userId', '=', ownerUserId)
    .where('pending', '=', false)
    .where(sql<boolean>`amount < 0`)
    .where('excluded', '=', false)
    .where('transactionType', '!=', 'transfer')
    .where('postedOn', '>=', fromDate)
    .where('postedOn', '<=', toDate)
    .execute();

  const warnings: string[] = [];
  let currencyCode: string | null = null;
  if (currencyRows.length === 1) {
    currencyCode = currencyRows[0]?.currencyCode ?? null;
  } else if (currencyRows.length > 1) {
    warnings.push(
      'Spending spans multiple currencies; amounts were not converted or summed across currencies.',
    );
  }

  const rows: Array<{
    categoryId: string;
    categoryName: string;
    netAmount: number | null;
    transactionCount: number;
  }> = await db
    .selectFrom('app.financeTransactions as t')
    .innerJoin('app.financeCategories as c', 'c.id', 't.categoryId')
    .select((eb) => [
      'c.id as categoryId',
      'c.name as categoryName',
      eb.fn.sum<number>('t.amount').as('netAmount'),
      eb.fn.countAll<number>().as('transactionCount'),
    ])
    .where('t.userId', '=', ownerUserId)
    .where('t.pending', '=', false)
    .where(sql<boolean>`t.amount < 0`)
    .where('t.excluded', '=', false)
    .where('t.transactionType', '!=', 'transfer')
    .where('t.postedOn', '>=', fromDate)
    .where('t.postedOn', '<=', toDate)
    .groupBy(['c.id', 'c.name'])
    .orderBy('netAmount', 'asc')
    .limit(limit)
    .execute();

  const categories = rows.map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    spentCents: Math.abs(toCents(row.netAmount)),
    transactionCount: Number(row.transactionCount),
  }));

  return {
    from: fromDate,
    to: toDate,
    currencyCode,
    categories,
    warnings,
  };
}
