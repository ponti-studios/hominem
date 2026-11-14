import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';

import type { DbHandle, TransactionHandle } from '../../transaction';

export type RulingLockedTransaction = {
  id: string;
  accountId: string;
  amount: number;
  categoryId: string | null;
  currencyCode: string;
  description: string | null;
  merchantName: string | null;
  excluded: boolean;
  externalId: string | null;
  pending: boolean;
  postedOn: string;
  source: string | null;
  notes: string | null;
  orderNumber: string | null;
  counterpartId: string | null;
  recurring: boolean;
  transactionType: string;
};

/** Preparations retain the exact rows reviewed when a verdict is made. */
export const FinanceRulingRepository = {
  async lockVerdict(handle: TransactionHandle, userId: string, verdictId: string) {
    return (
      (await handle
        .selectFrom('app.financeRulingVerdicts')
        .select(['id', 'verdict', 'category', 'tags', 'rows'])
        .where('userId', '=', userId)
        .where('id', '=', verdictId)
        .forUpdate()
        .executeTakeFirst()) ?? null
    );
  },

  async lockTransaction(
    handle: TransactionHandle,
    userId: string,
    transactionId: string,
  ): Promise<RulingLockedTransaction | null> {
    const row = await handle
      .selectFrom('app.financeTransactions')
      .select([
        'id',
        'accountId',
        'amount',
        'categoryId',
        'currencyCode',
        'description',
        'merchantName',
        'excluded',
        'externalId',
        'pending',
        'postedOn',
        'source',
        'notes',
        'orderNumber',
        'counterpartId',
        'recurring',
        'transactionType',
      ])
      .where('userId', '=', userId)
      .where('id', '=', transactionId)
      .forUpdate()
      .executeTakeFirst();
    return row ? { ...row, amount: Number(row.amount), postedOn: String(row.postedOn) } : null;
  },

  async transactionTags(handle: TransactionHandle, userId: string, transactionId: string) {
    return handle
      .selectFrom('app.tagAssignments as assignment')
      .innerJoin('app.tags as tag', 'tag.id', 'assignment.tagId')
      .select(['tag.id', 'tag.name'])
      .where('tag.ownerUserid', '=', userId)
      .where('assignment.entityTable', '=', sql<string>`'app.finance_transactions'::regclass`)
      .where('assignment.entityId', '=', transactionId)
      .orderBy('tag.name')
      .execute();
  },

  async appendEvent(
    handle: TransactionHandle,
    userId: string,
    verdictId: string,
    eventType: string,
    details: unknown,
  ) {
    await handle
      .insertInto('app.financeRulingEvents')
      .values({
        userId,
        verdictId,
        eventType,
        details: sql`${JSON.stringify(details)}::jsonb`,
      })
      .execute();
  },

  async applyClassification(
    handle: TransactionHandle,
    userId: string,
    transactionId: string,
    category: string,
    tags: string[],
  ) {
    let categoryRow = await handle
      .selectFrom('app.financeCategories')
      .select('id')
      .where('userId', '=', userId)
      .where(sql<boolean>`lower(name) = lower(${category})`)
      .executeTakeFirst();
    if (!categoryRow) {
      categoryRow = await handle
        .insertInto('app.financeCategories')
        .values({ id: randomUUID(), userId, name: category })
        .returning('id')
        .executeTakeFirstOrThrow();
    }
    const tagIds: string[] = [];
    for (const name of tags) {
      let tag = await handle
        .selectFrom('app.tags')
        .select('id')
        .where('ownerUserid', '=', userId)
        .where(sql<boolean>`lower(name) = lower(${name})`)
        .executeTakeFirst();
      if (!tag) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const path = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        tag = await handle
          .insertInto('app.tags')
          .values({ id: randomUUID(), ownerUserid: userId, name, slug, path })
          .returning('id')
          .executeTakeFirstOrThrow();
      }
      tagIds.push(tag.id);
    }
    await handle
      .updateTable('app.financeTransactions')
      .set({ categoryId: categoryRow.id })
      .where('userId', '=', userId)
      .where('id', '=', transactionId)
      .executeTakeFirstOrThrow();
    await handle
      .deleteFrom('app.tagAssignments')
      .where('entityTable', '=', sql<string>`'app.finance_transactions'::regclass`)
      .where('entityId', '=', transactionId)
      .execute();
    for (const tagId of tagIds)
      await handle
        .insertInto('app.tagAssignments')
        .values({
          id: randomUUID(),
          tagId,
          entityTable: 'app.finance_transactions',
          entityId: transactionId,
        })
        .execute();
    return categoryRow.id;
  },

  async excludeTransaction(handle: TransactionHandle, userId: string, transactionId: string) {
    await handle
      .updateTable('app.financeTransactions')
      .set({ excluded: true })
      .where('userId', '=', userId)
      .where('id', '=', transactionId)
      .executeTakeFirstOrThrow();
  },

  async listEvents(handle: DbHandle, userId: string) {
    return handle
      .selectFrom('app.financeRulingEvents')
      .select(['verdictId', 'eventType', 'details', 'createdAt'])
      .where('userId', '=', userId)
      .orderBy('id', 'asc')
      .execute();
  },
  async listOptions(handle: DbHandle, userId: string) {
    const [categories, tags] = await Promise.all([
      handle
        .selectFrom('app.financeCategories')
        .select(['id', 'name'])
        .where('userId', '=', userId)
        .orderBy('name', 'asc')
        .orderBy('id', 'asc')
        .execute(),
      handle
        .selectFrom('app.tags')
        .select(['id', 'name'])
        .where('ownerUserid', '=', userId)
        .orderBy('name', 'asc')
        .orderBy('id', 'asc')
        .execute(),
    ]);
    return {
      categories: categories
        .filter(
          (category) => !['uncategorized', 'adjustment'].includes(category.name.toLowerCase()),
        )
        .map(({ id, name }) => ({ id, name })),
      tags: tags.map(({ id, name }) => ({ id, name })),
    };
  },
  async saveReferenceRulebook(
    handle: DbHandle,
    userId: string,
    fingerprint: string,
    contents: unknown,
  ) {
    const row = await handle
      .insertInto('app.financeRulingRulebooks')
      .values({
        userId,
        fingerprint,
        source: 'reference',
        contents: sql`${JSON.stringify(contents)}::jsonb`,
      })
      .onConflict((conflict) =>
        conflict.columns(['userId', 'fingerprint']).doUpdateSet({
          source: 'reference',
          contents: sql`${JSON.stringify(contents)}::jsonb`,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  },
  async saveLiveRulebook(handle: DbHandle, userId: string, fingerprint: string, contents: unknown) {
    const row = await handle
      .insertInto('app.financeRulingRulebooks')
      .values({
        userId,
        fingerprint,
        source: 'live',
        contents: sql`${JSON.stringify(contents)}::jsonb`,
      })
      .onConflict((conflict) =>
        conflict.columns(['userId', 'fingerprint']).doUpdateSet({
          source: 'live',
          contents: sql`${JSON.stringify(contents)}::jsonb`,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  },
  async latestRulebook(handle: DbHandle, userId: string) {
    const row = await handle
      .selectFrom('app.financeRulingRulebooks')
      .select(['fingerprint', 'contents'])
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .executeTakeFirst();
    return row ?? null;
  },
  async createPreparation(handle: DbHandle, userId: string, snapshot: unknown): Promise<string> {
    const row = await handle
      .insertInto('app.financeRulingPreparations')
      .values({ userId, snapshot: sql`${JSON.stringify(snapshot)}::jsonb` })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  },

  async latestPreparation(
    handle: DbHandle,
    userId: string,
  ): Promise<{ id: string; snapshot: unknown } | null> {
    const row = await handle
      .selectFrom('app.financeRulingPreparations')
      .select(['id', 'snapshot'])
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .executeTakeFirst();
    return row ? { id: row.id, snapshot: row.snapshot } : null;
  },

  async findPreparation(
    handle: DbHandle,
    userId: string,
    id: string,
  ): Promise<{ id: string; snapshot: unknown } | null> {
    const row = await handle
      .selectFrom('app.financeRulingPreparations')
      .select(['id', 'snapshot'])
      .where('userId', '=', userId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? { id: row.id, snapshot: row.snapshot } : null;
  },

  async listVerdicts(
    handle: DbHandle,
    userId: string,
  ): Promise<
    Array<{
      id: string;
      preparationId: string;
      clusterId: string;
      merchant: string;
      verdict: string;
      category: string | null;
      tags: unknown;
      rows: unknown;
      createdAt: string;
    }>
  > {
    return handle
      .selectFrom('app.financeRulingVerdicts')
      .select([
        'id',
        'preparationId',
        'clusterId',
        'merchant',
        'verdict',
        'category',
        'tags',
        'rows',
        'createdAt',
      ])
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .execute();
  },

  async createVerdict(
    handle: DbHandle,
    userId: string,
    input: {
      preparationId: string;
      clusterId: string;
      merchant: string;
      verdict: 'kill' | 'file' | 'change';
      category?: string | null;
      tags?: string[];
      rows: unknown;
    },
  ): Promise<string> {
    const row = await handle
      .insertInto('app.financeRulingVerdicts')
      .values({
        userId,
        preparationId: input.preparationId,
        clusterId: input.clusterId,
        merchant: input.merchant,
        verdict: input.verdict,
        category: input.category ?? null,
        tags: sql`${JSON.stringify(input.tags ?? [])}::jsonb`,
        rows: sql`${JSON.stringify(input.rows)}::jsonb`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await handle
      .insertInto('app.financeRulingEvents')
      .values({
        userId,
        verdictId: row.id,
        eventType: 'queued',
      })
      .execute();
    return row.id;
  },
};
