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
      't.orderNumber',
      't.externalId',
      't.counterpartId',
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
    orderNumber: row.orderNumber,
    externalId: row.externalId,
    counterpartId: row.counterpartId ?? null,
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
    .where('ta.entityId', 'in', ids)
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

  const rows: Array<{
    categoryId: string;
    categoryName: string;
    currencyCode: string;
    netAmount: number | null;
    transactionCount: number;
  }> = await db
    .selectFrom('app.financeTransactions as t')
    .innerJoin('app.financeCategories as c', 'c.id', 't.categoryId')
    .select((eb) => [
      'c.id as categoryId',
      'c.name as categoryName',
      't.currencyCode as currencyCode',
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
    .groupBy(['c.id', 'c.name', 't.currencyCode'])
    .orderBy('netAmount', 'asc')
    .limit(limit + 1)
    .execute();

  const truncated = rows.length > limit;
  const categories = rows.slice(0, limit).map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    currencyCode: row.currencyCode,
    spentCents: Math.abs(toCents(row.netAmount)),
    transactionCount: Number(row.transactionCount),
  }));

  const currencyRows = await db
    .selectFrom('app.financeTransactions as t')
    .innerJoin('app.financeCategories as c', 'c.id', 't.categoryId')
    .select('t.currencyCode')
    .distinct()
    .where('t.userId', '=', ownerUserId)
    .where('t.pending', '=', false)
    .where(sql<boolean>`t.amount < 0`)
    .where('t.excluded', '=', false)
    .where('t.transactionType', '!=', 'transfer')
    .where('t.postedOn', '>=', fromDate)
    .where('t.postedOn', '<=', toDate)
    .execute();
  const currencies = currencyRows.map((row) => row.currencyCode);
  const currencyCode = currencies.length === 1 ? (currencies[0] ?? null) : null;
  const warnings = [
    ...(currencies.length > 1
      ? ['Spending spans multiple currencies; categories are reported separately by currency.']
      : []),
    ...(truncated
      ? [
          `Category results are truncated at the requested limit (${limit}); additional matching categories were omitted.`,
        ]
      : []),
  ];

  return {
    from: fromDate,
    to: toDate,
    currencyCode,
    categories,
    truncated,
    warnings,
  };
}
