import { createHash, randomUUID } from 'node:crypto';

import { db, runInTransaction, sql } from '@hominem/db/core';
import { FinanceRulingRepository } from '@hominem/db/finance';
import { normalizeRulingMerchant } from '@hominem/finance-services/rulings';

import { ValidationError } from '../errors';
import { rulingRulebookSchema } from '../schemas/finance.rulings.schema';

type BatchAction =
  | { action: 'category'; categoryId: string; tagIds?: string[] }
  | { action: 'tags'; tagIds: string[] }
  | { action: 'merchant'; value: string | null }
  | { action: 'notes'; value: string | null }
  | { action: 'exclude' | 'restore' }
  | { action: 'move'; accountId: string }
  | { action: 'delete' };

async function assertRows(userId: string, ids: string[]) {
  const rows = await db
    .selectFrom('app.financeTransactions')
    .select([
      'id',
      'merchantName',
      'description',
      'counterpartId',
      'currencyCode',
      'accountId',
      'amount',
    ])
    .where('userId', '=', userId)
    .where('id', 'in', ids)
    .execute();
  if (rows.length !== new Set(ids).size)
    throw new ValidationError('One or more transactions were not found.');
  return rows;
}

async function updateMerchantRules(
  trx: Parameters<typeof FinanceRulingRepository.latestRulebook>[0],
  userId: string,
  merchants: string[],
  category: string,
  tags: string[],
) {
  const [latest, options] = await Promise.all([
    FinanceRulingRepository.latestRulebook(trx, userId),
    FinanceRulingRepository.listOptions(trx, userId),
  ]);
  const base = latest
    ? rulingRulebookSchema.parse(latest.contents)
    : {
        categories: [],
        tags: [],
        merchantRules: [],
        categoryRules: [],
        tagRules: [],
        coffeePatterns: [],
      };
  const rules = merchants.map((merchant) => ({ merchant, category, tags }));
  const keys = new Set(rules.map((rule) => normalizeRulingMerchant(rule.merchant)));
  const contents = {
    ...base,
    categories: [...new Set([...base.categories, ...options.categories.map(({ name }) => name)])],
    tags: [...new Set([...base.tags, ...options.tags.map(({ name }) => name)])],
    merchantRules: [
      ...base.merchantRules.filter((rule) => !keys.has(normalizeRulingMerchant(rule.merchant))),
      ...rules,
    ],
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(contents)).digest('hex');
  await FinanceRulingRepository.saveLiveRulebook(trx, userId, fingerprint, contents);
}

export async function updateFinanceTransactions(userId: string, ids: string[], input: BatchAction) {
  const rows = await assertRows(userId, ids);
  const uniqueIds = [...new Set(ids)];
  if (input.action === 'move') {
    const account = await db
      .selectFrom('app.financeAccounts')
      .select(['id', 'currencyCode', 'allowedCurrencies'])
      .where('id', '=', input.accountId)
      .where('userId', '=', userId)
      .executeTakeFirst();
    if (!account) throw new ValidationError('Account not found.');
    const allowed = new Set(
      [account.currencyCode, ...account.allowedCurrencies].map((code) => code.toUpperCase()),
    );
    if (rows.some((row) => !allowed.has(row.currencyCode.toUpperCase())))
      throw new ValidationError('Currency mismatch.');
    const counterpartIds = rows.flatMap((row) => (row.counterpartId ? [row.counterpartId] : []));
    const counterparts = counterpartIds.length
      ? await db
          .selectFrom('app.financeTransactions')
          .select(['id', 'accountId'])
          .where('userId', '=', userId)
          .where('id', 'in', counterpartIds)
          .execute()
      : [];
    const counterpartAccounts = new Map(
      counterparts.map(({ id, accountId: existingAccountId }) => [id, existingAccountId]),
    );
    if (
      rows.some(
        (row) => row.counterpartId && counterpartAccounts.get(row.counterpartId) === account.id,
      )
    ) {
      throw new ValidationError(
        'Moving this transaction would place both sides of its transfer in one account.',
      );
    }
    if (rows.some((row) => row.counterpartId && uniqueIds.includes(row.counterpartId))) {
      throw new ValidationError('Move one side of a linked transfer at a time.');
    }
  }
  if (input.action === 'category') {
    const category = await db
      .selectFrom('app.financeCategories')
      .select(['id', 'name'])
      .where('id', '=', input.categoryId)
      .where('userId', '=', userId)
      .executeTakeFirst();
    if (!category) throw new ValidationError('Category not found.');
    if (input.tagIds?.length) {
      const tags = await db
        .selectFrom('app.tags')
        .select('id')
        .where('ownerUserid', '=', userId)
        .where('id', 'in', input.tagIds)
        .execute();
      if (tags.length !== new Set(input.tagIds).size)
        throw new ValidationError('One or more tags were not found.');
    }
    return runInTransaction(async (trx) => {
      const tagNames = input.tagIds?.length
        ? (
            await trx
              .selectFrom('app.tags')
              .select('name')
              .where('ownerUserid', '=', userId)
              .where('id', 'in', input.tagIds)
              .execute()
          ).map(({ name }) => name)
        : [];
      for (const id of uniqueIds)
        await FinanceRulingRepository.applyClassification(trx, userId, id, category.name, tagNames);
      const byMerchant = new Map<string, string>();
      for (const row of rows) {
        const merchant = row.merchantName?.trim() || row.description?.trim();
        if (merchant) byMerchant.set(normalizeRulingMerchant(merchant), merchant);
      }
      await updateMerchantRules(trx, userId, [...byMerchant.values()], category.name, tagNames);
      return { updated: uniqueIds.length };
    });
  }
  return runInTransaction(async (trx) => {
    if (input.action === 'tags') {
      const tags = await trx
        .selectFrom('app.tags')
        .select('id')
        .where('ownerUserid', '=', userId)
        .where('id', 'in', input.tagIds)
        .execute();
      if (tags.length !== new Set(input.tagIds).size)
        throw new ValidationError('One or more tags were not found.');
      for (const id of uniqueIds) {
        await trx
          .deleteFrom('app.tagAssignments')
          .where('entityTable', '=', sql<string>`'app.finance_transactions'::regclass`)
          .where('entityId', '=', id)
          .execute();
        for (const tagId of input.tagIds)
          await trx
            .insertInto('app.tagAssignments')
            .values({
              id: randomUUID(),
              tagId,
              entityTable: 'app.finance_transactions',
              entityId: id,
            })
            .execute();
      }
    } else if (input.action === 'merchant') {
      await trx
        .updateTable('app.financeTransactions')
        .set({ merchantName: input.value })
        .where('userId', '=', userId)
        .where('id', 'in', uniqueIds)
        .execute();
    } else if (input.action === 'notes') {
      await trx
        .updateTable('app.financeTransactions')
        .set({ notes: input.value })
        .where('userId', '=', userId)
        .where('id', 'in', uniqueIds)
        .execute();
    } else if (input.action === 'exclude' || input.action === 'restore') {
      await trx
        .updateTable('app.financeTransactions')
        .set({ excluded: input.action === 'exclude' })
        .where('userId', '=', userId)
        .where('id', 'in', uniqueIds)
        .execute();
    } else if (input.action === 'move') {
      await trx
        .updateTable('app.financeTransactions')
        .set({ accountId: input.accountId })
        .where('userId', '=', userId)
        .where('id', 'in', uniqueIds)
        .execute();
    } else if (input.action === 'delete') {
      await trx
        .updateTable('app.financeTransactions')
        .set({ counterpartId: null })
        .where('userId', '=', userId)
        .where('counterpartId', 'in', uniqueIds)
        .execute();
      await trx
        .deleteFrom('app.financeTransactions')
        .where('userId', '=', userId)
        .where('id', 'in', uniqueIds)
        .execute();
    }
    return { updated: uniqueIds.length };
  });
}

export async function pairFinanceTransfers(userId: string, ids: string[]) {
  if (new Set(ids).size !== 2)
    throw new ValidationError('Select exactly two transactions to link as a transfer.');
  const rows = await assertRows(userId, ids);
  const [first, second] = rows;
  if (!first || !second || first.id === second.id)
    throw new ValidationError('Select two different transactions.');
  if (first.currencyCode !== second.currencyCode || Number(first.amount) !== -Number(second.amount))
    throw new ValidationError('Transfer amounts and currencies must match.');
  if (first.accountId === second.accountId)
    throw new ValidationError('Transfers must belong to different accounts.');
  if (first.counterpartId || second.counterpartId)
    throw new ValidationError('Unlink existing transfer pairs first.');
  await runInTransaction(async (trx) => {
    await trx
      .updateTable('app.financeTransactions')
      .set({ counterpartId: second.id, transactionType: 'transfer' })
      .where('userId', '=', userId)
      .where('id', '=', first.id)
      .execute();
    await trx
      .updateTable('app.financeTransactions')
      .set({ counterpartId: first.id, transactionType: 'transfer' })
      .where('userId', '=', userId)
      .where('id', '=', second.id)
      .execute();
  });
  return { linked: ids };
}

export async function unlinkFinanceTransfer(userId: string, id: string) {
  return runInTransaction(async (trx) => {
    const row = await trx
      .selectFrom('app.financeTransactions')
      .select(['id', 'counterpartId', 'amount'])
      .where('userId', '=', userId)
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) throw new ValidationError('Transaction not found.');
    if (!row.counterpartId) return { unlinked: false };
    const ids = [id, row.counterpartId];
    const paired = await trx
      .selectFrom('app.financeTransactions')
      .select(['id', 'amount'])
      .where('userId', '=', userId)
      .where('id', 'in', ids)
      .execute();
    for (const transaction of paired)
      await trx
        .updateTable('app.financeTransactions')
        .set({
          counterpartId: null,
          transactionType: Number(transaction.amount) < 0 ? 'debit' : 'credit',
        })
        .where('userId', '=', userId)
        .where('id', '=', transaction.id)
        .execute();
    return { unlinked: true };
  });
}

export async function listFinanceTransactionOptions(userId: string) {
  return FinanceRulingRepository.listOptions(db, userId);
}
