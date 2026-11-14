import { randomUUID } from 'node:crypto';

import { db, sql } from '@hominem/db/core';
import { FinanceRulingRepository } from '@hominem/db/finance';
import { afterEach, describe, expect, it } from 'vitest';

import { applyRulingRow, prepareRulings } from './finance.rulings.service';

describe('Rulings guarded execution', () => {
  const users: string[] = [];
  afterEach(async () => {
    for (const id of users.splice(0)) await sql`delete from "user" where id = ${id}`.execute(db);
  });

  async function fixture(verdict: 'kill' | 'file') {
    const userId = randomUUID();
    const accountId = randomUUID();
    const transactionId = randomUUID();
    const categoryId = randomUUID();
    users.push(userId);
    await sql`insert into "user" (id, name, email) values (${userId}, 'Rulings test', ${`${userId}@example.com`})`.execute(
      db,
    );
    await sql`insert into app.finance_accounts (id, user_id, name, account_type) values (${accountId}, ${userId}, 'Checking', 'checking')`.execute(
      db,
    );
    await sql`insert into app.finance_categories (id, user_id, name) values (${categoryId}, ${userId}, 'Uncategorized')`.execute(
      db,
    );
    await sql`insert into app.finance_transactions (id, user_id, account_id, amount, transaction_type, description, merchant_name, posted_on, currency_code, category_id, external_id, source, notes)
      values (${transactionId}, ${userId}, ${accountId}, -12.34, 'debit', 'Example merchant', 'Example merchant', '2026-10-01', 'GBP', ${categoryId}, 'external-1', 'sheet', 'Keep this note')`.execute(
      db,
    );
    const row = {
      id: transactionId,
      externalId: 'external-1',
      description: 'Example merchant',
      postedOn: '2026-10-01',
      amountCents: -1234,
      currencyCode: 'GBP',
      excluded: false,
      before: {
        accountId,
        accountName: 'Checking',
        categoryId,
        categoryName: 'Uncategorized',
        tags: [],
        source: 'sheet',
        pending: false,
      },
    };
    const preparationId = await FinanceRulingRepository.createPreparation(db, userId, {
      clusters: [],
    });
    const verdictId = await db.transaction().execute((trx) =>
      FinanceRulingRepository.createVerdict(trx, userId, {
        preparationId,
        clusterId: randomUUID(),
        merchant: 'example merchant',
        verdict,
        category: verdict === 'file' ? 'Utilities' : null,
        tags: verdict === 'file' ? ['Water'] : [],
        rows: [row],
      }),
    );
    return { userId, transactionId, verdictId };
  }

  it('excludes the reviewed row, preserves other fields, and retries without another write', async () => {
    const f = await fixture('kill');
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
  });

  it('files the approved category and tag while preserving unrelated details', async () => {
    const f = await fixture('file');
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
  });

  it('prepares both Uncategorized rows and transactions with no category', async () => {
    const userId = randomUUID();
    const accountId = randomUUID();
    const categoryId = randomUUID();
    users.push(userId);
    await sql`insert into "user" (id, name, email) values (${userId}, 'Rulings test', ${`${userId}@example.com`})`.execute(
      db,
    );
    await sql`insert into app.finance_accounts (id, user_id, name, account_type) values (${accountId}, ${userId}, 'Checking', 'checking')`.execute(
      db,
    );
    await sql`insert into app.finance_categories (id, user_id, name) values (${categoryId}, ${userId}, 'Uncategorized')`.execute(
      db,
    );
    await sql`insert into app.finance_transactions
      (id, user_id, account_id, amount, transaction_type, description, posted_on, currency_code, category_id, external_id, source)
      values
      (${randomUUID()}, ${userId}, ${accountId}, -12, 'debit', 'Uncategorized merchant', '2026-10-01', 'GBP', ${categoryId}, 'external-uncategorized', 'sheet'),
      (${randomUUID()}, ${userId}, ${accountId}, -13, 'debit', 'No category merchant', '2026-10-02', 'GBP', null, 'external-null', 'sheet')`.execute(
      db,
    );

    const prepared = await prepareRulings(userId);

    expect(prepared.clusters.map((cluster) => cluster.merchant).sort()).toEqual([
      'no category merchant',
      'uncategorized merchant',
    ]);
  });

  it('stops when the row changed or the verdict belongs to another user', async () => {
    const f = await fixture('kill');
    const other = await fixture('kill');
    await expect(applyRulingRow(other.userId, f.verdictId, f.transactionId)).rejects.toThrow(
      'Verdict not found',
    );
    await db
      .updateTable('app.financeTransactions')
      .set({ amount: -20 })
      .where('id', '=', f.transactionId)
      .execute();
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
  });

  it('serializes duplicate workers and records one row application', async () => {
    const f = await fixture('kill');
    const results = await Promise.all([
      applyRulingRow(f.userId, f.verdictId, f.transactionId),
      applyRulingRow(f.userId, f.verdictId, f.transactionId),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['already_applied', 'applied']);
    expect(
      (await FinanceRulingRepository.listEvents(db, f.userId)).map((event) => event.eventType),
    ).toEqual(['queued', 'row_applied']);
  });

  it('rolls back the entire row when a tag cannot be created', async () => {
    const f = await fixture('file');
    await sql`insert into app.tags (id, owner_userid, name, slug, path)
      values (${randomUUID()}, ${f.userId}, 'Other tag', 'water', 'other_tag')`.execute(db);
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
