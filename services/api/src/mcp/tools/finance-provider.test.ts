import { db } from '@hominem/db/core';
import { removeUsers, resetUsers, seedAccount } from '@hominem/finance-services/test/factory';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { getSyncDoctrine } from '../../application/finance.doctrine.service';
import { createToolRegistry } from '../tool-registry';
import { financeProviderSlice } from './finance/provider';

const userId = 'f2000132-0000-4000-8000-000000000001';
const otherUserId = 'f2000132-0000-4000-8000-000000000002';
const registry = createToolRegistry([financeProviderSlice]);
const accounts = [
  { accountUid: 'bank-a', name: 'Synthetic Current', accountType: 'PRIMARY', currency: 'GBP' },
  { accountUid: 'bank-b', name: 'Synthetic Saver', accountType: 'SAVINGS', currency: 'GBP' },
];
const doctrine = {
  version: 1,
  merchantRules: [],
  tagRules: [],
  amountRules: [],
  transferMerchants: [],
  incomePatterns: [],
  coffeePatterns: [],
  lenses: [],
};

beforeEach(() => resetUsers(userId, otherUserId));

afterAll(() => removeUsers(userId, otherUserId));

describe('finance provider tools', () => {
  it('seeds each owner once by provider identity and imports their doctrine', async () => {
    const first = await registry.callTool(userId, 'finance_seed', { accounts, doctrine });
    expect(first.structuredContent).toMatchObject({
      ok: true,
      doctrine: { status: 'created' },
      accounts: [
        { provider_account_id: 'bank-a', created: true },
        { provider_account_id: 'bank-b', created: true },
      ],
    });
    const replay = await registry.callTool(userId, 'finance_seed', { accounts, doctrine });
    expect(replay.structuredContent).toMatchObject({
      doctrine: { status: 'unchanged' },
      accounts: [{ created: false }, { created: false }],
    });
    const other = await registry.callTool(otherUserId, 'finance_seed', { accounts });
    expect(other.structuredContent).toMatchObject({
      doctrine: null,
      doctrine_note: expect.stringContaining('WEALTH_SEED_DOCTRINE'),
      accounts: [{ created: true }, { created: true }],
    });
    const saved = await db
      .selectFrom('app.financeAccounts')
      .select(['userId', 'providerAccountId', 'accountType'])
      .where('userId', 'in', [userId, otherUserId])
      .orderBy('userId')
      .orderBy('providerAccountId')
      .execute();
    expect(saved).toEqual([
      { userId, providerAccountId: 'bank-a', accountType: 'checking' },
      { userId, providerAccountId: 'bank-b', accountType: 'savings' },
      { userId: otherUserId, providerAccountId: 'bank-a', accountType: 'checking' },
      { userId: otherUserId, providerAccountId: 'bank-b', accountType: 'savings' },
    ]);
    expect((await getSyncDoctrine(otherUserId)).doctrine).toBeNull();
  });

  it('does not claim or attach an identity to a same-named existing account', async () => {
    await seedAccount({ userId, name: accounts[0].name, currencyCode: 'GBP' });
    await expect(
      registry.callTool(userId, 'finance_seed', { accounts: [accounts[0]] }),
    ).rejects.toThrow('link it explicitly before seeding');
    const saved = await db
      .selectFrom('app.financeAccounts')
      .select(['provider', 'providerAccountId'])
      .where('userId', '=', userId)
      .executeTakeFirstOrThrow();
    expect(saved).toEqual({ provider: null, providerAccountId: null });
  });

  it('normalizes and totals live balances by currency, with partial-provider notes', async () => {
    const result = await registry.callTool(userId, 'finance_balances', {
      at: '2026-01-05T12:00:00.000Z',
      accounts: [
        {
          account: accounts[0],
          balance: {
            clearedBalance: { minorUnits: 12000 },
            effectiveBalance: { minorUnits: 11500 },
            pendingTransactions: { minorUnits: -500 },
          },
          savingsGoalList: [
            {
              savingsGoalUid: 'space-1',
              name: 'Rainy day',
              totalSaved: { minorUnits: '3000' },
              target: { minorUnits: 5000 },
            },
          ],
        },
        {
          account: { accountUid: 'bank-c', currency: 'USD' },
          balance: { clearedBalance: { minorUnits: 750 } },
          savingsGoalList: [],
        },
      ],
      notes: ['balance unavailable for another account'],
    });
    expect(result.structuredContent).toMatchObject({
      accounts: [
        {
          accountUid: 'bank-a',
          cleared: 120,
          effective: 115,
          pending: -5,
          spaces: [{ name: 'Rainy day', saved: 30, target: 50 }],
        },
        { accountUid: 'bank-c', cleared: 7.5 },
      ],
      totals: [
        { currency: 'GBP', total: 150 },
        { currency: 'USD', total: 7.5 },
      ],
      notes: ['balance unavailable for another account'],
      text: expect.stringContaining('GBP: £150.00'),
    });
  });
});
