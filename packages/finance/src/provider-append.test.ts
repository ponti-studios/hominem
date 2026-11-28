import { randomUUID } from 'node:crypto';

import { appendProviderTransactions } from './provider-append';
import { computeSheetExternalId } from './sheet-import';
import {
  patchTransactions,
  removeUsers,
  seedAccount,
  seedTransaction,
  seedUser,
} from './test/factory';
import { transactionsByIds } from './test/readers';

describe('appendProviderTransactions', () => {
  const userIds: string[] = [];
  afterAll(() => removeUsers(...userIds));

  it.each(['manual', 'starling'])(
    'claims an edited %s import by its original ID instead of adding a twin',
    async (source) => {
      const user = await seedUser();
      userIds.push(user.id);
      // The importer only reads v4-style account IDs, which is what real account creation makes.
      const account = await seedAccount({ id: randomUUID(), userId: user.id, currencyCode: 'GBP' });
      // Imported as -10.00 on the 1st, then edited to -12.00 on the 20th.
      const stored = await seedTransaction({
        userId: user.id,
        accountId: account.id,
        amount: -12,
        description: 'Bus fare',
        postedOn: '2026-11-20',
        currencyCode: 'GBP',
      });
      await patchTransactions([stored.id], {
        source,
        externalId: computeSheetExternalId('2026-11-01', account.id, 'Bus fare', -1000, 'GBP'),
      });
      const transactions = [
        {
          postedOn: '2026-11-01',
          account: account.id,
          description: 'Bus fare',
          amountCents: -1000,
          currencyCode: 'GBP',
          source: 'starling',
          externalId: 'feed-1',
        },
      ];

      for (const dryRun of [true, false, false]) {
        const result = await appendProviderTransactions(user.id, { transactions, dryRun });
        expect(result).toMatchObject({ created: 0, rejected: [] });
        expect(result.warnings).toHaveLength(1);
      }

      const [row] = await transactionsByIds([stored.id]);
      expect(row).toMatchObject({ externalId: 'feed-1', source: 'starling' });
      expect(Number(row.amount)).toBe(-12);
    },
  );
});
