import { db } from '@hominem/db/core';
import { FinanceRulingRepository } from '@hominem/db/finance';
import {
  patchTransactions,
  seedTag,
  seedTransactions,
} from '@hominem/finance-services/test/factory';
import { describe, expect } from 'vitest';

import { rulingsTest } from '../testkit/fixtures/finance-rulings';
import { applyRulingRow, prepareRulings } from './finance.rulings.service';

describe('Rulings guarded execution', () => {
  rulingsTest(
    'excludes the reviewed row, preserves other fields, and retries without another write',
    async ({ rulings }) => {
      const f = await rulings.verdict('kill');
      await expect(applyRulingRow(f.userId, f.verdictId, f.transactionId)).resolves.toEqual({
        status: 'applied',
      });
      await expect(applyRulingRow(f.userId, f.verdictId, f.transactionId)).resolves.toEqual({
        status: 'already_applied',
      });
      const row = await db
        .selectFrom('app.financeTransactions')
        .select(['excluded', 'notes'])
        .where('id', '=', f.transactionId)
        .executeTakeFirstOrThrow();
      expect(row).toEqual({ excluded: true, notes: 'Keep this note' });
      const events = await FinanceRulingRepository.listEvents(db, f.userId);
      expect(events.map((event) => event.eventType)).toEqual(['queued', 'row_applied']);
      expect(events[1]?.details).toMatchObject({
        rowId: f.transactionId,
        before: { excluded: false },
        after: { excluded: true },
      });
    },
  );

  rulingsTest(
    'files the approved category and tag while preserving unrelated details',
    async ({ rulings }) => {
      const f = await rulings.verdict('file');
      await expect(applyRulingRow(f.userId, f.verdictId, f.transactionId)).resolves.toEqual({
        status: 'applied',
      });
      const row = await db
        .selectFrom('app.financeTransactions as t')
        .innerJoin('app.financeCategories as c', 'c.id', 't.categoryId')
        .select(['c.name', 't.notes', 't.excluded'])
        .where('t.id', '=', f.transactionId)
        .executeTakeFirstOrThrow();
      expect(row).toEqual({ name: 'Utilities', notes: 'Keep this note', excluded: false });
      const events = await FinanceRulingRepository.listEvents(db, f.userId);
      expect(events[1]?.details).toMatchObject({ after: { tags: ['Water'] } });
    },
  );

  rulingsTest(
    'prepares both Uncategorized rows and transactions with no category',
    async ({ rulings }) => {
      const { userId, accountId, categoryId } = await rulings.ledger();
      await seedTransactions(userId, [
        {
          accountId,
          categoryId,
          amount: -12,
          description: 'Uncategorized merchant',
          postedOn: '2026-10-01',
          currencyCode: 'GBP',
          externalId: 'external-uncategorized',
          source: 'sheet',
        },
        {
          accountId,
          categoryId: null,
          amount: -13,
          description: 'No category merchant',
          postedOn: '2026-10-02',
          currencyCode: 'GBP',
          externalId: 'external-null',
          source: 'sheet',
        },
      ]);

      const prepared = await prepareRulings(userId);

      expect(prepared.clusters.map((cluster) => cluster.merchant).sort()).toEqual([
        'no category merchant',
        'uncategorized merchant',
      ]);
    },
  );

  rulingsTest(
    'stops when the row changed or the verdict belongs to another user',
    async ({ rulings }) => {
      const f = await rulings.verdict('kill');
      const other = await rulings.verdict('kill');
      await expect(applyRulingRow(other.userId, f.verdictId, f.transactionId)).rejects.toThrow(
        'Verdict not found',
      );
      await patchTransactions([f.transactionId], { amount: -20 });
      await expect(applyRulingRow(f.userId, f.verdictId, f.transactionId)).resolves.toEqual({
        status: 'conflict',
      });
      expect(
        (
          await db
            .selectFrom('app.financeTransactions')
            .select('excluded')
            .where('id', '=', f.transactionId)
            .executeTakeFirstOrThrow()
        ).excluded,
      ).toBe(false);
      expect(
        (await FinanceRulingRepository.listEvents(db, f.userId)).map((event) => event.eventType),
      ).toEqual(['queued', 'failed']);
    },
  );

  rulingsTest(
    'serializes duplicate workers and records one row application',
    async ({ rulings }) => {
      const f = await rulings.verdict('kill');
      const results = await Promise.all([
        applyRulingRow(f.userId, f.verdictId, f.transactionId),
        applyRulingRow(f.userId, f.verdictId, f.transactionId),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual(['already_applied', 'applied']);
      expect(
        (await FinanceRulingRepository.listEvents(db, f.userId)).map((event) => event.eventType),
      ).toEqual(['queued', 'row_applied']);
    },
  );

  rulingsTest('rolls back the entire row when a tag cannot be created', async ({ rulings }) => {
    const f = await rulings.verdict('file');
    await seedTag({ ownerUserid: f.userId, name: 'Other tag', slug: 'water', path: 'other_tag' });
    await expect(applyRulingRow(f.userId, f.verdictId, f.transactionId)).rejects.toThrow();
    const row = await db
      .selectFrom('app.financeTransactions as t')
      .innerJoin('app.financeCategories as c', 'c.id', 't.categoryId')
      .select(['c.name', 't.notes'])
      .where('t.id', '=', f.transactionId)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ name: 'Uncategorized', notes: 'Keep this note' });
    expect(
      (await FinanceRulingRepository.listEvents(db, f.userId)).map((event) => event.eventType),
    ).toEqual(['queued']);
  });
});
