import { randomUUID } from 'node:crypto';

import { db, sql } from '@hominem/db/core';
import {
  createDeterministicIdFactory,
  ensureIntegrationUsers,
  isIntegrationDatabaseAvailable,
} from '@hominem/db/test/utils';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createFinanceRule,
  createOrGetFinanceCategory,
  getCategoryTagBreakdown,
  mergeCategoryTransactions,
  mergeFinanceCategories,
  queryTransactionsByContract,
} from './index';
import { cleanupIntegrationFinanceUser } from './test-utils';

const nextUserId = createDeterministicIdFactory('finance.taxonomy.integration');
const describeIntegration = (await isIntegrationDatabaseAvailable()) ? describe : describe.skip;

interface Fixture {
  ownerId: string;
  accountId: string;
  categories: Record<'coffee' | 'food' | 'groceries' | 'restaurants', { id: string; name: string }>;
  transactions: Record<'coffee' | 'food' | 'groceries' | 'restaurants', string[]>;
}

// Placeholder taxonomy only: a bucket and three components that are folded into it.
async function seedFixture(): Promise<Fixture> {
  const ownerId = nextUserId();
  await cleanupIntegrationFinanceUser(ownerId);
  await ensureIntegrationUsers([{ id: ownerId, name: 'Taxonomy User' }]);

  const accountId = randomUUID();
  await db
    .insertInto('app.financeAccounts')
    .values({
      id: accountId,
      userId: ownerId,
      name: 'Taxonomy Checking',
      accountType: 'checking',
      currencyCode: 'USD',
      lifecycleStatus: 'open',
      includeInNetWorth: true,
      metadata: {},
    })
    .execute();

  const groceries = await createOrGetFinanceCategory(ownerId, 'Groceries');
  const restaurants = await createOrGetFinanceCategory(ownerId, 'Restaurants');
  const coffee = await createOrGetFinanceCategory(ownerId, 'Coffee');
  const food = await createOrGetFinanceCategory(ownerId, 'Food');

  const rows: Array<{
    id: string;
    categoryId: string;
    amount: number;
    currencyCode: string;
    postedOn: string;
    description: string;
  }> = [
    {
      id: randomUUID(),
      categoryId: groceries.id!,
      amount: -25.5,
      currencyCode: 'USD',
      postedOn: '2026-05-01',
      description: 'Grocery row one',
    },
    {
      id: randomUUID(),
      categoryId: groceries.id!,
      amount: -10,
      currencyCode: 'USD',
      postedOn: '2026-05-02',
      description: 'Grocery row two',
    },
    {
      id: randomUUID(),
      categoryId: restaurants.id!,
      amount: -40,
      currencyCode: 'EUR',
      postedOn: '2026-05-03',
      description: 'Restaurant row',
    },
    {
      id: randomUUID(),
      categoryId: coffee.id!,
      amount: -3.5,
      currencyCode: 'USD',
      postedOn: '2026-05-04',
      description: 'Coffee row',
    },
    {
      id: randomUUID(),
      categoryId: food.id!,
      amount: -5,
      currencyCode: 'USD',
      postedOn: '2026-05-05',
      description: 'Food row already in the target',
    },
  ];

  await db
    .insertInto('app.financeTransactions')
    .values(
      rows.map((row) => ({
        id: row.id,
        userId: ownerId,
        accountId,
        postedOn: row.postedOn,
        description: row.description,
        amount: row.amount,
        currencyCode: row.currencyCode,
        transactionType: 'debit',
        pending: false,
        categoryId: row.categoryId,
        excluded: false,
        externalId: row.id,
        providerPayload: {},
      })),
    )
    .execute();

  return {
    ownerId,
    accountId,
    categories: {
      groceries: { id: groceries.id!, name: 'Groceries' },
      restaurants: { id: restaurants.id!, name: 'Restaurants' },
      coffee: { id: coffee.id!, name: 'Coffee' },
      food: { id: food.id!, name: 'Food' },
    },
    transactions: {
      groceries: [rows[0]!.id, rows[1]!.id],
      restaurants: [rows[2]!.id],
      coffee: [rows[3]!.id],
      food: [rows[4]!.id],
    },
  };
}

/** Integer cents per currency — the comparison the totals invariant is stated in. */
async function currencyTotals(userId: string, categoryIds: string[]) {
  const rows = await db
    .selectFrom('app.financeTransactions')
    .select(['currencyCode'])
    .select((eb) => eb.fn.sum<string>('amount').as('total'))
    .where('userId', '=', userId)
    .where('categoryId', 'in', categoryIds)
    .groupBy('currencyCode')
    .orderBy('currencyCode', 'asc')
    .execute();
  return rows.map((row) => ({
    currencyCode: row.currencyCode,
    cents: Math.round(Number(row.total) * 100),
  }));
}

async function transactionIdsInCategory(userId: string, categoryId: string): Promise<string[]> {
  const rows = await db
    .selectFrom('app.financeTransactions')
    .select('id')
    .where('userId', '=', userId)
    .where('categoryId', '=', categoryId)
    .execute();
  return rows.map((row) => row.id).sort();
}

async function categoryByName(userId: string, name: string) {
  return db
    .selectFrom('app.financeCategories')
    .select(['id', 'name'])
    .where('userId', '=', userId)
    .where(sql<boolean>`lower(name) = lower(${name})`)
    .executeTakeFirst();
}

async function tagsOnTransaction(userId: string, transactionId: string): Promise<string[]> {
  const rows = await sql<{ name: string }>`
    select tg.name
    from app.tag_assignments ti
    join app.tags tg on tg.id = ti.tag_id and tg.owner_userid = ${userId}
    where ti.entity_table = 'app.finance_transactions'::regclass
      and ti.entity_id = ${transactionId}
      and ti.removed_at is null
  `.execute(db);
  return rows.rows.map((row) => row.name).sort();
}

describeIntegration('finance category taxonomy', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await seedFixture();
  });

  it('preserves every source transaction under a tag whose filter reproduces the source set', async () => {
    const { ownerId, categories, transactions } = fixture;

    const result = await mergeFinanceCategories(ownerId, {
      from: ['Groceries', 'Restaurants'],
      into: 'Food',
    });

    expect(result.reason).toBeNull();
    expect(result.transactionsReassigned).toBe(3);
    expect(result.removedCategories.map((category) => category.name).sort()).toEqual([
      'Groceries',
      'Restaurants',
    ]);
    expect(result.category).toEqual(categories.food);

    // Tag coverage is 100% of the source transactions, and each source's tag splits the merged
    // category back into exactly the set it came from.
    const sourceSets = [
      { source: categories.groceries, expected: [...transactions.groceries].sort() },
      { source: categories.restaurants, expected: [...transactions.restaurants].sort() },
    ];
    for (const { source, expected } of sourceSets) {
      const preserved = result.steps?.preserveTags.tags.find(
        (entry) => entry.category.id === source.id,
      );
      expect(preserved).toMatchObject({ tagCreated: true, transactionsTagged: expected.length });
      expect(preserved?.tag.name).toBe(source.name);

      const tagged = await queryTransactionsByContract({
        userId: ownerId,
        tagNames: [source.name],
      });
      const inMergedCategory = tagged
        .filter((transaction) => transaction.categoryId === categories.food.id)
        .map((transaction) => transaction.id)
        .sort();
      expect(inMergedCategory).toEqual(expected);

      for (const transactionId of expected) {
        expect(await tagsOnTransaction(ownerId, transactionId)).toContain(source.name);
      }
    }

    // The target's own rows are untouched and stay untagged.
    expect(await tagsOnTransaction(ownerId, transactions.food[0]!)).toEqual([]);
  });

  it('reuses an equivalent existing tag instead of creating another one', async () => {
    const { ownerId, categories } = fixture;

    await sql`
      insert into app.tags (id, owner_userid, name, slug, path)
      values (${randomUUID()}, ${ownerId}, ${'groceries'}, ${'groceries'}, ${'groceries'})
    `.execute(db);
    const existing = await db
      .selectFrom('app.tags')
      .select(['id', 'name'])
      .where('ownerUserid', '=', ownerId)
      .executeTakeFirstOrThrow();

    const result = await mergeFinanceCategories(ownerId, { from: 'Groceries', into: 'Food' });

    const preserved = result.steps?.preserveTags.tags[0];
    expect(preserved).toMatchObject({ tagCreated: false, transactionsTagged: 2 });
    expect(preserved?.tag.id).toBe(existing.id);

    const tags = await db
      .selectFrom('app.tags')
      .select('id')
      .where('ownerUserid', '=', ownerId)
      .where(sql<boolean>`lower(name) = 'groceries'`)
      .execute();
    expect(tags).toHaveLength(1);
    expect(categories.groceries.id).toBeTruthy();
  });

  it('keeps per-currency totals byte-identical across the merge', async () => {
    const { ownerId, categories } = fixture;
    const affected = [
      categories.groceries.id,
      categories.restaurants.id,
      categories.coffee.id,
      categories.food.id,
    ];

    const before = await currencyTotals(ownerId, affected);
    const result = await mergeFinanceCategories(ownerId, {
      from: ['Groceries', 'Restaurants', 'Coffee'],
      into: 'Food',
    });
    const after = await currencyTotals(ownerId, [categories.food.id]);

    expect(before).toEqual([
      { currencyCode: 'EUR', cents: -4000 },
      { currencyCode: 'USD', cents: -4400 },
    ]);
    expect(after).toEqual(before);
    expect(result.totalsUnchanged).toBe(true);
    expect(result.currencyTotals).toEqual([
      { currencyCode: 'EUR', beforeCents: -4000, afterCents: -4000 },
      { currencyCode: 'USD', beforeCents: -4400, afterCents: -4400 },
    ]);
  });

  it('repoints rules to the target, leaving no rule naming a merged-away category', async () => {
    const { ownerId, categories } = fixture;

    await createFinanceRule(ownerId, {
      name: 'Grocery rule',
      category: 'Groceries',
      matchPattern: 'grocer',
    });
    await createFinanceRule(ownerId, {
      name: 'Coffee rule',
      category: 'Coffee',
      matchPattern: 'coffee',
    });
    await createFinanceRule(ownerId, {
      name: 'Food rule',
      category: 'Food',
      matchPattern: 'restaurant',
    });

    const result = await mergeFinanceCategories(ownerId, {
      from: ['Groceries', 'Coffee'],
      into: 'Food',
    });

    expect(result.steps?.repointRules.repointed.map((rule) => rule.name).sort()).toEqual([
      'Coffee rule',
      'Grocery rule',
    ]);

    const rules = await db
      .selectFrom('app.financeRules')
      .select(['name', 'actionCategoryId'])
      .where('userId', '=', ownerId)
      .orderBy('name', 'asc')
      .execute();
    expect(rules).toEqual([
      { name: 'Coffee rule', actionCategoryId: categories.food.id },
      { name: 'Food rule', actionCategoryId: categories.food.id },
      { name: 'Grocery rule', actionCategoryId: categories.food.id },
    ]);

    const stale = await db
      .selectFrom('app.financeRules')
      .select('id')
      .where('actionCategoryId', 'in', [categories.groceries.id, categories.coffee.id])
      .execute();
    expect(stale).toHaveLength(0);
  });

  it('refuses to merge a source the preserve stage has not tagged', async () => {
    const { ownerId, categories, transactions } = fixture;

    // Stage 3 on its own, with neither earlier stage run.
    const blocked = await mergeCategoryTransactions(ownerId, { from: 'Coffee', into: 'Food' });

    expect(blocked.reason).toBe('untagged_sources');
    expect(blocked.result.untaggedSources).toEqual([categories.coffee]);
    expect(blocked.result.transactionsReassigned).toBe(0);
    expect(await categoryByName(ownerId, 'Coffee')).toBeDefined();
    expect(await transactionIdsInCategory(ownerId, categories.coffee.id)).toEqual(
      transactions.coffee,
    );
  });

  it('blocks the merge on a seeded unrepointed rule, naming the rule', async () => {
    const { ownerId, categories, transactions } = fixture;

    await createFinanceRule(ownerId, {
      name: 'Coffee rule',
      category: 'Coffee',
      matchPattern: 'coffee',
    });

    // Stage 1 done, stage 2 skipped: this is the seeded unrepointed rule.
    await mergeFinanceCategories(ownerId, { from: 'Coffee', into: 'Food' }, { stage: 'preserve' });

    const blocked = await mergeFinanceCategories(
      ownerId,
      { from: 'Coffee', into: 'Food' },
      { stage: 'merge' },
    );

    expect(blocked.reason).toBe('unrepointed_rules');
    expect(blocked.blockedRules).toEqual([
      { id: expect.any(String), name: 'Coffee rule', category: categories.coffee },
    ]);
    expect(blocked.transactionsReassigned).toBe(0);

    // Nothing moved: the source category and its transactions are intact.
    expect(await categoryByName(ownerId, 'Coffee')).toBeDefined();
    expect(await transactionIdsInCategory(ownerId, categories.coffee.id)).toEqual(
      transactions.coffee,
    );

    // Repointing is what unblocks it.
    const repointed = await mergeFinanceCategories(
      ownerId,
      { from: 'Coffee', into: 'Food' },
      { stage: 'repoint' },
    );
    expect(repointed.steps?.repointRules.repointed.map((rule) => rule.name)).toEqual([
      'Coffee rule',
    ]);

    const merged = await mergeFinanceCategories(
      ownerId,
      { from: 'Coffee', into: 'Food' },
      { stage: 'merge' },
    );
    expect(merged.reason).toBeNull();
    expect(merged.blockedRules).toEqual([]);
    expect(merged.transactionsReassigned).toBe(1);
    expect(merged.removedCategories).toEqual([categories.coffee]);
    expect(await categoryByName(ownerId, 'Coffee')).toBeUndefined();
  });

  it('runs preserve, repoint and merge as three reported stages', async () => {
    const { ownerId, categories } = fixture;

    await createFinanceRule(ownerId, {
      name: 'Grocery rule',
      category: 'Groceries',
      matchPattern: 'grocer',
    });

    const merged = await mergeFinanceCategories(ownerId, { from: 'Groceries', into: 'Food' });

    expect(merged.reason).toBeNull();
    expect(merged.steps).toMatchObject({
      preserveTags: { transactionsTagged: 2, tags: [{ tagCreated: true, transactionsTagged: 2 }] },
      repointRules: { repointed: [{ name: 'Grocery rule' }] },
      merge: { transactionsReassigned: 2, removedCategories: [categories.groceries] },
    });
  });

  it('drills a merged category back into its source tags', async () => {
    const { ownerId } = fixture;

    await mergeFinanceCategories(ownerId, {
      from: ['Groceries', 'Restaurants'],
      into: 'Food',
    });

    const breakdown = await getCategoryTagBreakdown(ownerId, {
      category: 'Food',
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(breakdown).not.toBeNull();
    expect(breakdown?.currencyCode).toBeNull();

    const buckets = (breakdown?.tags ?? []).map((tag) => ({
      tagName: tag.tagName,
      currencyCode: tag.currencyCode,
      spentCents: tag.spentCents,
      transactionCount: tag.transactionCount,
    }));
    expect(buckets).toEqual([
      { tagName: 'Restaurants', currencyCode: 'EUR', spentCents: 4000, transactionCount: 1 },
      { tagName: 'Groceries', currencyCode: 'USD', spentCents: 3550, transactionCount: 2 },
      { tagName: '(untagged)', currencyCode: 'USD', spentCents: 500, transactionCount: 1 },
    ]);

    // The true category totals are the sum of the components, per currency.
    expect(breakdown?.totals).toEqual([
      { currencyCode: 'EUR', spentCents: 4000, transactionCount: 1 },
      { currencyCode: 'USD', spentCents: 4050, transactionCount: 3 },
    ]);
    expect(breakdown?.warnings).toEqual([
      'Spending spans multiple currencies; tag buckets are reported separately by currency.',
    ]);
  });

  it('reports a dry run without writing tags, rules or categories', async () => {
    const { ownerId, categories } = fixture;

    await createFinanceRule(ownerId, {
      name: 'Grocery rule',
      category: 'Groceries',
      matchPattern: 'grocer',
    });

    const preview = await mergeFinanceCategories(
      ownerId,
      { from: 'Groceries', into: 'Food' },
      { dryRun: true },
    );

    expect(preview.dryRun).toBe(true);
    expect(preview.reason).toBeNull();
    expect(preview.transactionsReassigned).toBe(2);
    expect(preview.steps?.preserveTags.tags[0]).toMatchObject({
      tagCreated: true,
      transactionsTagged: 2,
      tag: { id: null, name: 'Groceries' },
    });
    expect(preview.steps?.repointRules.repointed.map((rule) => rule.name)).toEqual([
      'Grocery rule',
    ]);
    expect(preview.steps?.merge.removedCategories).toEqual([]);

    expect(await categoryByName(ownerId, 'Groceries')).toBeDefined();
    expect(await transactionIdsInCategory(ownerId, categories.groceries.id)).toHaveLength(2);
    const tags = await db
      .selectFrom('app.tags')
      .select('id')
      .where('ownerUserid', '=', ownerId)
      .execute();
    expect(tags).toHaveLength(0);
    const rules = await db
      .selectFrom('app.financeRules')
      .select('actionCategoryId')
      .where('userId', '=', ownerId)
      .execute();
    expect(rules).toEqual([{ actionCategoryId: categories.groceries.id }]);
  });
});
