import { randomUUID } from 'node:crypto';

import { db } from '@hominem/db/core';
import { FinanceRulingRepository } from '@hominem/db/finance';
import {
  seedAccount,
  seedCategory,
  seedTransaction,
  removeUsers,
  seedUser,
} from '@hominem/finance-services/test/factory';
import { test } from 'vitest';

/** A fresh user with a checking account and the `Uncategorized` category. */
async function seedLedger() {
  const { id: userId } = await seedUser();
  const account = await seedAccount({ userId, name: 'Checking' });
  const category = await seedCategory({ userId, name: 'Uncategorized' });
  return { userId, accountId: account.id, categoryId: category.id };
}

/** One reviewed row with a recorded verdict, ready for `applyRulingRow`. */
async function seedVerdict(
  ledger: Awaited<ReturnType<typeof seedLedger>>,
  verdict: 'kill' | 'file',
) {
  const { userId, accountId, categoryId } = ledger;
  const { id: transactionId } = await seedTransaction({
    userId,
    accountId,
    categoryId,
    amount: -12.34,
    description: 'Example merchant',
    merchantName: 'Example merchant',
    postedOn: '2026-10-01',
    currencyCode: 'GBP',
    externalId: 'external-1',
    source: 'sheet',
    notes: 'Keep this note',
  });
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
  return { ...ledger, transactionId, verdictId };
}

type Ledger = Awaited<ReturnType<typeof seedLedger>>;

/** `ledger()` and `verdict()` each make a fresh owner; every owner is removed after the test. */
export const rulingsTest = test.extend<{
  rulings: {
    ledger: () => Promise<Ledger>;
    verdict: (verdict: 'kill' | 'file') => ReturnType<typeof seedVerdict>;
  };
}>({
  rulings: async ({}, use) => {
    const owners: string[] = [];
    const ledger = async () => {
      const seeded = await seedLedger();
      owners.push(seeded.userId);
      return seeded;
    };
    await use({ ledger, verdict: async (verdict) => seedVerdict(await ledger(), verdict) });
    await removeUsers(...owners);
  },
});
