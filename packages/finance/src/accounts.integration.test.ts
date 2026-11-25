import { isIntegrationDatabaseAvailable } from '@hominem/db/test/utils';
import { expect } from 'vitest';

import {
  countOwnedAccounts,
  createAccount,
  createOrGetAccount,
  createTransaction,
  deleteAccount,
  getAccountById,
  getFinanceAccountList,
  listAccounts,
  listImportAccountSnapshots,
  updateAccount,
} from './index';
import { financeIntegrationTest } from './test-utils';

const describeIntegration = (await isIntegrationDatabaseAvailable())
  ? financeIntegrationTest.describe
  : financeIntegrationTest.describe.skip;

describeIntegration('finance accounts integration', () => {
  let ownerId: string;
  let otherUserId: string;

  financeIntegrationTest.beforeEach(async ({ financeFixture }) => {
    ownerId = financeFixture.ownerId;
    otherUserId = financeFixture.otherUserId;
  });

  financeIntegrationTest(
    'lists import snapshots with the resolution fields and counts owned accounts',
    async () => {
      const checking = await createAccount({
        userId: ownerId,
        name: 'Checking',
        accountType: 'depository',
        metadata: {},
      });
      const stranger = await createAccount({
        userId: otherUserId,
        name: 'Stranger',
        accountType: 'depository',
        metadata: {},
      });

      const snapshots = await listImportAccountSnapshots(ownerId);
      expect(snapshots).toEqual([
        {
          id: checking.id,
          name: 'Checking',
          mask: null,
          csvImportKey: null,
        },
      ]);

      expect(await countOwnedAccounts(ownerId, [checking.id])).toBe(1);
      expect(await countOwnedAccounts(ownerId, [checking.id, stranger.id])).toBe(1);
      expect(await countOwnedAccounts(ownerId, [])).toBe(0);
    },
  );

  financeIntegrationTest(
    'creates, lists, and fetches accounts, deriving balance from posted transactions',
    async () => {
      const created = await createAccount({
        userId: ownerId,
        name: 'Checking',
        accountType: 'depository',
      });

      expect(created.userId).toBe(ownerId);
      expect(created.name).toBe('Checking');
      expect(created.accountType).toBe('depository');
      expect(created.currentBalance).toBe(0);

      await createTransaction({
        userId: ownerId,
        accountId: created.id,
        amount: 2500.55,
      });

      const listed = await listAccounts(ownerId);
      expect(listed).toHaveLength(1);
      expect(listed[0]?.id).toBe(created.id);
      expect(Number(listed[0]?.currentBalance)).toBe(2500.55);

      const fetched = await getAccountById(created.id, ownerId);
      expect(fetched?.id).toBe(created.id);
      expect(Number(fetched?.currentBalance)).toBe(2500.55);
    },
  );

  financeIntegrationTest(
    'returns the shared account-list response in cents with owner-scoped totals',
    async () => {
      const created = await createOrGetAccount({
        userId: ownerId,
        name: 'Multicurrency Checking',
        currencyCode: 'USD',
        allowedCurrencies: ['GBP'],
        accountType: 'depository',
      });
      const accountId = created.id;
      if (!accountId) throw new Error('Expected account creation to return an id');
      await createAccount({
        userId: otherUserId,
        name: 'Private Account',
        accountType: 'depository',
      });
      await createTransaction({ userId: ownerId, accountId, amount: 12.34 });

      await expect(getFinanceAccountList(ownerId)).resolves.toEqual({
        accounts: [
          {
            id: accountId,
            name: 'Multicurrency Checking',
            accountType: 'depository',
            currencyCode: 'USD',
            allowedCurrencies: ['USD', 'GBP'],
            lifecycleStatus: 'open',
            includeInNetWorth: true,
            balanceCents: 1234,
          },
        ],
        count: 1,
        totalCount: 1,
      });
    },
  );

  financeIntegrationTest(
    'returns every account to HTTP callers while supporting an explicit bounded list',
    async () => {
      await Promise.all(
        Array.from({ length: 51 }, (_, index) =>
          createAccount({
            userId: ownerId,
            name: `Account ${String(index).padStart(2, '0')}`,
            accountType: 'checking',
          }),
        ),
      );

      const complete = await getFinanceAccountList(ownerId);
      const bounded = await getFinanceAccountList(ownerId, { limit: 50 });

      expect(complete).toMatchObject({ count: 51, totalCount: 51 });
      expect(bounded).toMatchObject({ count: 50, totalCount: 51 });
    },
  );

  financeIntegrationTest('enforces owner scope for update and delete', async () => {
    const created = await createAccount({
      userId: ownerId,
      name: 'Protected',
      accountType: 'depository',
    });

    const deniedUpdate = await updateAccount({
      id: created.id,
      userId: otherUserId,
      name: 'Hijacked',
    });
    expect(deniedUpdate).toBeNull();

    const deniedDelete = await deleteAccount(created.id, otherUserId);
    expect(deniedDelete).toBe(false);

    const stillExists = await getAccountById(created.id, ownerId);
    expect(stillExists?.name).toBe('Protected');
  });
});
