import { randomUUID } from 'node:crypto';

import { isIntegrationDatabaseAvailable } from '@hominem/db/test/utils';
import { expect } from 'vitest';

import {
  createAccount,
  createTransaction,
  getTransactionTagIds,
  queryTransactionsByContract,
  replaceTransactionTags,
} from './index';
import { seedTag } from './test/factory';
import { financeIntegrationTest } from './test/fixtures';

const describeIntegration = (await isIntegrationDatabaseAvailable())
  ? financeIntegrationTest.describe
  : financeIntegrationTest.describe.skip;

describeIntegration('finance tags integration', () => {
  let ownerId: string;
  let otherUserId: string;
  let ownerAccountId: string;
  let txOneId: string;
  let txTwoId: string;
  let ownerFoodTagId: string;
  let ownerTravelTagId: string;
  let otherTagId: string;

  financeIntegrationTest.beforeEach(async ({ financeFixture }) => {
    ownerId = financeFixture.ownerId;
    otherUserId = financeFixture.otherUserId;
    ownerFoodTagId = randomUUID();
    ownerTravelTagId = randomUUID();
    otherTagId = randomUUID();

    await seedTag({ id: ownerFoodTagId, ownerUserid: ownerId, name: 'food' });
    await seedTag({ id: ownerTravelTagId, ownerUserid: ownerId, name: 'travel' });
    await seedTag({ id: otherTagId, ownerUserid: otherUserId, name: 'foreign-tag' });

    const account = await createAccount({
      userId: ownerId,
      name: 'Tag Checking',
      accountType: 'depository',
    });
    ownerAccountId = account.id;

    const txOne = await createTransaction({
      userId: ownerId,
      accountId: ownerAccountId,
      amount: -25,
      description: 'Lunch',
      postedOn: '2026-03-01',
    });
    const txTwo = await createTransaction({
      userId: ownerId,
      accountId: ownerAccountId,
      amount: -60,
      description: 'Flight',
      postedOn: '2026-03-02',
    });
    txOneId = txOne.id;
    txTwoId = txTwo.id;
  });

  financeIntegrationTest(
    'replaces transaction tags idempotently and filters transactions by tag',
    async () => {
      await replaceTransactionTags(txOneId, ownerId, [ownerFoodTagId]);
      await replaceTransactionTags(txTwoId, ownerId, [ownerTravelTagId]);

      const foodFiltered = await queryTransactionsByContract({
        userId: ownerId,
        tagIds: [ownerFoodTagId],
        limit: 10,
        offset: 0,
      });
      expect(foodFiltered).toHaveLength(1);
      expect(foodFiltered[0]?.id).toBe(txOneId);

      const travelFiltered = await queryTransactionsByContract({
        userId: ownerId,
        tagNames: ['travel'],
        limit: 10,
        offset: 0,
      });
      expect(travelFiltered).toHaveLength(1);
      expect(travelFiltered[0]?.id).toBe(txTwoId);

      await replaceTransactionTags(txOneId, ownerId, [ownerFoodTagId, ownerFoodTagId]);
      const txOneTags = await getTransactionTagIds(txOneId, ownerId);
      expect(txOneTags).toEqual([ownerFoodTagId]);
    },
  );

  financeIntegrationTest('rejects cross-tenant tags on transaction tagging', async () => {
    await expect(replaceTransactionTags(txOneId, ownerId, [otherTagId])).rejects.toThrow(
      'One or more tags are invalid for this user',
    );
  });

  financeIntegrationTest(
    'serializes concurrent replacement so tag sets cannot interleave',
    async () => {
      await Promise.all([
        replaceTransactionTags(txOneId, ownerId, [ownerFoodTagId]),
        replaceTransactionTags(txOneId, ownerId, [ownerTravelTagId]),
      ]);
      const tags = await getTransactionTagIds(txOneId, ownerId);
      expect([[ownerFoodTagId], [ownerTravelTagId]]).toContainEqual(tags);
    },
  );
});
