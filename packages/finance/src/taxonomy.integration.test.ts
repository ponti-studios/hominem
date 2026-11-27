import { db, sql } from '@hominem/db/core';
import { isIntegrationDatabaseAvailable } from '@hominem/db/test/utils';
import { expect } from 'vitest';

import {
  createFinanceRule,
  createOrGetFinanceCategory,
  getCategoryTagBreakdown,
  mergeCategoryTransactions,
  mergeFinanceCategories,
  queryTransactionsByContract,
} from './index';
import { seedBudget, seedMonthlyBudgets, seedTag } from './test/factory';
import { financeIntegrationTest } from './test/fixtures';
import {
  categoryByName,
  currencyTotals,
  tagNamesOnTransaction,
  transactionIdsInCategory,
} from './test/readers';
import { type Fixture, seedTaxonomyScenario } from './test/taxonomy-scenario';

const describeIntegration = (await isIntegrationDatabaseAvailable())
  ? financeIntegrationTest.describe
  : financeIntegrationTest.describe.skip;

describeIntegration('finance category taxonomy', () => {
  let fixture: Fixture;

  financeIntegrationTest.beforeEach(async ({ financeFixture }) => {
    fixture = await seedTaxonomyScenario(financeFixture.ownerId);
  });

  financeIntegrationTest(
    'preserves every source transaction under a tag whose filter reproduces the source set',
    async () => {
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
          expect(await tagNamesOnTransaction(ownerId, transactionId)).toContain(source.name);
        }
      }

      // The target's own rows are untouched and stay untagged.
      expect(await tagNamesOnTransaction(ownerId, transactions.food[0]!)).toEqual([]);
    },
  );

  financeIntegrationTest(
    'reuses an equivalent existing tag instead of creating another one',
    async () => {
      const { ownerId, categories } = fixture;

      await seedTag({ ownerUserid: ownerId, name: 'groceries' });
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
    },
  );

  financeIntegrationTest('keeps per-currency totals byte-identical across the merge', async () => {
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

  financeIntegrationTest(
    'adds source budgets in the target cadence and preserves monthly runway budgets',
    async () => {
      const { ownerId, categories } = fixture;
      await seedBudget({
        userId: ownerId,
        categoryId: categories.food.id,
        amountCents: 12_000,
        cadence: 'monthly',
      });
      await seedBudget({
        userId: ownerId,
        categoryId: categories.groceries.id,
        amountCents: 1_200,
        cadence: 'weekly',
      });
      await seedBudget({
        userId: ownerId,
        categoryId: categories.restaurants.id,
        amountCents: 3_000,
        cadence: 'quarterly',
      });

      await seedMonthlyBudgets([
        {
          userId: ownerId,
          categoryId: categories.food.id,
          currencyCode: 'USD',
          monthlyAmount: '50.00',
        },
        {
          userId: ownerId,
          categoryId: categories.groceries.id,
          currencyCode: 'USD',
          monthlyAmount: '10.25',
        },
        {
          userId: ownerId,
          categoryId: categories.restaurants.id,
          currencyCode: 'USD',
          monthlyAmount: '3.75',
        },
        {
          userId: ownerId,
          categoryId: categories.restaurants.id,
          currencyCode: 'EUR',
          monthlyAmount: '2.50',
        },
      ]);

      const preview = await mergeFinanceCategories(
        ownerId,
        {
          from: ['Groceries', 'Restaurants'],
          into: 'Food',
        },
        { dryRun: true },
      );
      expect(preview.dryRun).toBe(true);
      expect(
        await db
          .selectFrom('app.financeBudgets')
          .select(['categoryId', 'amountCents'])
          .where('userId', '=', ownerId)
          .orderBy('categoryId')
          .execute(),
      ).toHaveLength(3);

      const result = await mergeFinanceCategories(ownerId, {
        from: ['Groceries', 'Restaurants'],
        into: 'Food',
      });

      expect(result.reason).toBeNull();
      expect(result.budgetMerge).toEqual({
        budget: { amountCents: 18_200, cadence: 'monthly' },
        tagBudgets: [],
        sourceBudgetCount: 2,
        monthlyRunwayBudgets: [
          { currencyCode: 'EUR', amountCents: 250 },
          { currencyCode: 'USD', amountCents: 6_400 },
        ],
      });
      expect(
        await db
          .selectFrom('app.financeBudgets')
          .select(['categoryId', 'amountCents', 'cadence'])
          .where('userId', '=', ownerId)
          .execute(),
      ).toEqual([{ categoryId: categories.food.id, amountCents: 18_200, cadence: 'monthly' }]);

      const monthlyBudgets = await db
        .selectFrom('app.financeMonthlyBudgets')
        .select(['currencyCode', 'monthlyAmount'])
        .where('userId', '=', ownerId)
        .where('categoryId', '=', categories.food.id)
        .orderBy('currencyCode')
        .execute();
      expect(
        monthlyBudgets.map((budget) => ({
          currencyCode: budget.currencyCode,
          monthlyAmount: Number(budget.monthlyAmount),
        })),
      ).toEqual([
        { currencyCode: 'EUR', monthlyAmount: 2.5 },
        { currencyCode: 'USD', monthlyAmount: 64 },
      ]);
    },
  );

  financeIntegrationTest(
    'uses the first budgeted source cadence when the target has no budget',
    async () => {
      const { ownerId, categories } = fixture;
      await seedBudget({
        userId: ownerId,
        categoryId: categories.restaurants.id,
        amountCents: 3_000,
        cadence: 'quarterly',
      });
      await seedBudget({
        userId: ownerId,
        categoryId: categories.groceries.id,
        amountCents: 1_200,
        cadence: 'weekly',
      });

      const result = await mergeFinanceCategories(ownerId, {
        from: ['Restaurants', 'Groceries'],
        into: 'Food',
      });

      expect(result.budgetMerge).toEqual({
        budget: { amountCents: 18_600, cadence: 'quarterly' },
        tagBudgets: [],
        sourceBudgetCount: 2,
        monthlyRunwayBudgets: [],
      });
      expect(
        await db
          .selectFrom('app.financeBudgets')
          .select(['categoryId', 'amountCents', 'cadence'])
          .where('userId', '=', ownerId)
          .execute(),
      ).toEqual([{ categoryId: categories.food.id, amountCents: 18_600, cadence: 'quarterly' }]);
    },
  );

  financeIntegrationTest(
    'adds nested tag budgets by tag while preserving the target cadence',
    async () => {
      const { ownerId, categories } = fixture;
      const sharedTagId = (await seedTag({ ownerUserid: ownerId, name: 'Shared food tag' })).id;
      const sourceOnlyTagId = (
        await seedTag({ ownerUserid: ownerId, name: 'Source only food tag' })
      ).id;
      await seedBudget({
        userId: ownerId,
        categoryId: categories.food.id,
        amountCents: 12_000,
        cadence: 'monthly',
      });
      await seedBudget({
        userId: ownerId,
        categoryId: categories.groceries.id,
        amountCents: 30_000,
        cadence: 'quarterly',
      });
      await seedBudget({
        userId: ownerId,
        categoryId: categories.food.id,
        amountCents: 1_200,
        cadence: 'monthly',
        tagId: sharedTagId,
      });
      await seedBudget({
        userId: ownerId,
        categoryId: categories.groceries.id,
        amountCents: 600,
        cadence: 'weekly',
        tagId: sharedTagId,
      });
      await seedBudget({
        userId: ownerId,
        categoryId: categories.groceries.id,
        amountCents: 6_000,
        cadence: 'quarterly',
        tagId: sourceOnlyTagId,
      });

      const preview = await mergeFinanceCategories(
        ownerId,
        { from: 'Groceries', into: 'Food' },
        { dryRun: true },
      );
      expect(preview.budgetMerge).toEqual({
        budget: { amountCents: 22_000, cadence: 'monthly' },
        tagBudgets: [
          { tagId: sharedTagId, amountCents: 3_800, cadence: 'monthly' },
          { tagId: sourceOnlyTagId, amountCents: 6_000, cadence: 'quarterly' },
        ].sort((left, right) => left.tagId.localeCompare(right.tagId)),
        sourceBudgetCount: 1,
        monthlyRunwayBudgets: [],
      });
      expect(
        await db
          .selectFrom('app.financeBudgets')
          .select(['categoryId', 'tagId'])
          .where('userId', '=', ownerId)
          .where('tagId', 'is not', null)
          .execute(),
      ).toHaveLength(3);

      const result = await mergeFinanceCategories(ownerId, { from: 'Groceries', into: 'Food' });
      expect(result.budgetMerge).toEqual(preview.budgetMerge);
      const mergedBudgets = await db
        .selectFrom('app.financeBudgets')
        .select(['categoryId', 'tagId', 'amountCents', 'cadence'])
        .where('userId', '=', ownerId)
        .execute();
      expect(mergedBudgets).toHaveLength(3);
      expect(mergedBudgets).toEqual(
        expect.arrayContaining([
          {
            categoryId: categories.food.id,
            tagId: null,
            amountCents: 22_000,
            cadence: 'monthly',
          },
          {
            categoryId: categories.food.id,
            tagId: sharedTagId,
            amountCents: 3_800,
            cadence: 'monthly',
          },
          {
            categoryId: categories.food.id,
            tagId: sourceOnlyTagId,
            amountCents: 6_000,
            cadence: 'quarterly',
          },
        ]),
      );
    },
  );

  financeIntegrationTest(
    'repoints rules to the target, leaving no rule naming a merged-away category',
    async () => {
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
    },
  );

  financeIntegrationTest(
    'refuses to merge a source the preserve stage has not tagged',
    async () => {
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
    },
  );

  financeIntegrationTest(
    'blocks the merge on a seeded unrepointed rule, naming the rule',
    async () => {
      const { ownerId, categories, transactions } = fixture;

      await createFinanceRule(ownerId, {
        name: 'Coffee rule',
        category: 'Coffee',
        matchPattern: 'coffee',
      });

      // Stage 1 done, stage 2 skipped: this is the seeded unrepointed rule.
      await mergeFinanceCategories(
        ownerId,
        { from: 'Coffee', into: 'Food' },
        { stage: 'preserve' },
      );

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
    },
  );

  financeIntegrationTest('refuses sources that would share a single tag', async () => {
    const { ownerId } = fixture;

    // Both names normalise to the same tag slug, so one tag could not tell them apart.
    await createOrGetFinanceCategory(ownerId, 'Food & Drink');
    await createOrGetFinanceCategory(ownerId, 'Food Drink');

    await expect(
      mergeFinanceCategories(ownerId, { from: ['Food & Drink', 'Food Drink'], into: 'Food' }),
    ).rejects.toThrow(
      'duplicate_source_tag: "Food & Drink" and "Food Drink" would share one tag, so they could not be told apart after the merge. Rename one before merging.',
    );

    // Nothing was written or removed.
    expect(await categoryByName(ownerId, 'Food & Drink')).toBeDefined();
    expect(await categoryByName(ownerId, 'Food Drink')).toBeDefined();
    expect(await categoryByName(ownerId, 'Food')).toBeDefined();
    const tags = await db
      .selectFrom('app.tags')
      .select('id')
      .where('ownerUserid', '=', ownerId)
      .execute();
    expect(tags).toHaveLength(0);
  });

  financeIntegrationTest('runs preserve, repoint and merge as three reported stages', async () => {
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

  financeIntegrationTest('drills a merged category back into its source tags', async () => {
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

  financeIntegrationTest(
    'reports a dry run without writing tags, rules or categories',
    async () => {
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
    },
  );
});
