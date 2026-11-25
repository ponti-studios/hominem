import { describe, expect, it } from 'vitest';

import type { SyncDoctrine } from './finance.doctrine.schema';
import {
  categorize,
  classifyRow,
  EMPTY_DOCTRINE,
  normalizeMerchant,
  plaidBodySchema,
  plaidItemsToRows,
  routeRow,
  starlingFeedsToItems,
  starlingItemsToRows,
  tagsFor,
  type FinanceAccountRoute,
  type StarlingItem,
} from './ingest';

const doctrine: SyncDoctrine = {
  ...EMPTY_DOCTRINE,
  amountRules: [{ merchant: 'Synth Sub', amountMinorUnits: [-1899], category: 'Subscriptions' }],
  merchantRules: [{ pattern: 'synth', category: 'Food' }],
  transferMerchants: [{ pattern: 'synth transfer', unlessAccountContains: 'transfer' }],
  incomePatterns: [{ pattern: 'synth payroll' }],
  tagRules: [{ pattern: 'synth', tags: ['Dining Out'] }],
  coffeePatterns: ['roasters'],
};

const accounts: FinanceAccountRoute[] = [
  {
    id: 'starling',
    name: 'Current',
    accountType: 'checking',
    currencyCode: 'GBP',
    lifecycleStatus: 'open',
    balance: 0,
    provider: 'starling',
    providerAccountId: 'account-a',
    accountNumber: null,
  },
  {
    id: 'card',
    name: 'Card',
    accountType: 'credit',
    currencyCode: 'USD',
    lifecycleStatus: 'open',
    balance: 0,
    provider: 'plaid',
    providerAccountId: null,
    accountNumber: '4242',
  },
];

describe('wealth-manager ingest', () => {
  it('preserves ordered doctrine classification and tag behavior', () => {
    expect(normalizeMerchant('SYNTH-ROASTERS.COM')).toBe('synth roasters com');
    expect(categorize('Synth Sub', -1899, doctrine)).toBe('Subscriptions');
    expect(categorize('Synth Sub', -899, doctrine)).toBe('Food');
    expect(classifyRow('Synth Transfer', -100, 'Current', doctrine)).toBe('Transfers');
    expect(classifyRow('Synth Transfer', -100, 'Transfer account', doctrine)).toBe('');
    expect(classifyRow('Synth Payroll', 100, 'Current', doctrine)).toBe('Income');
    expect(classifyRow('Synth Payroll', -100, 'Current', doctrine)).toBe('');
    expect(tagsFor('Synth Roasters', 'Food', doctrine)).toEqual(['Coffee']);
  });

  it('routes only unique provider identities', () => {
    const row = {
      date: '2026-01-01',
      label: 'Starling',
      route: { provider: 'starling' as const, providerAccountId: 'account-a' },
      merchant: 'Synthetic',
      amount: -1,
      currency: 'GBP',
      tags: [],
      source: 'Starling API',
      orderNumber: '',
      category: '',
    };
    expect(routeRow(row, accounts).account?.id).toBe('starling');
    expect(
      routeRow({ ...row, route: { provider: 'plaid', mask: '4242' } }, accounts).account?.id,
    ).toBe('card');
    expect(routeRow(row, [accounts[0], { ...accounts[0], id: 'other' }]).reason).toMatch(
      /ambiguous/,
    );
    expect(routeRow({ ...row, route: undefined }, accounts).reason).toMatch(/no routing identity/);
  });

  it('keeps settled Starling IDs and internal-transfer behavior', () => {
    const item: StarlingItem = {
      feedItemUid: 'feed-1',
      date: '2026-01-01',
      merchant: 'Synthetic',
      amount: -5,
      currency: 'GBP',
      direction: 'OUT',
      status: 'SETTLED',
      reference: null,
      accountUid: 'account-a',
      src: 'INTERNAL_TRANSFER',
      space: 'Bills',
    };
    expect(starlingItemsToRows([item, { ...item, status: 'PENDING' }], doctrine)).toMatchObject([
      {
        externalId: 'feed-1',
        route: { provider: 'starling', providerAccountId: 'account-a' },
        merchant: 'Bills',
        category: 'Transfers',
      },
    ]);
  });

  it('normalizes raw Starling feed amounts and retains their bank identity', () => {
    const items = starlingFeedsToItems([
      {
        accountUid: 'account-a',
        currency: 'GBP',
        space: null,
        feedItems: [
          {
            feedItemUid: 'feed-1',
            transactionTime: '2026-01-01T10:00:00Z',
            counterPartyName: 'Synthetic',
            amount: { minorUnits: '1234', currency: 'GBP' },
            direction: 'OUT',
            status: 'SETTLED',
          },
        ],
      },
    ]);
    expect(starlingItemsToRows(items, doctrine)[0]).toMatchObject({
      amount: -12.34,
      externalId: 'feed-1',
      route: { provider: 'starling', providerAccountId: 'account-a' },
    });
  });

  it('keeps settled Plaid IDs, negates outflow, and holds missing masks', () => {
    const body = plaidBodySchema.parse({
      accounts: [{ account_id: 'p1', name: 'Card', mask: '4242' }],
      transactions: [
        {
          account_id: 'p1',
          transaction_id: 'txn-1',
          date: '2026-01-01',
          name: 'Synth Sub',
          amount: 18.99,
          iso_currency_code: 'USD',
        },
        {
          account_id: 'missing',
          transaction_id: 'txn-2',
          date: '2026-01-01',
          name: 'Other',
          amount: 1,
          iso_currency_code: 'USD',
        },
        {
          account_id: 'p1',
          transaction_id: 'pending',
          date: '2026-01-01',
          name: 'Pending',
          amount: 1,
          pending: true,
        },
      ],
    });
    const rows = plaidItemsToRows(body, doctrine);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      externalId: 'txn-1',
      amount: -18.99,
      category: 'Subscriptions',
      route: { provider: 'plaid', mask: '4242' },
    });
    expect(routeRow(rows[1], accounts).ok).toBe(false);
  });
});
