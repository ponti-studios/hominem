import { describe, expect, it } from 'vitest';

import {
  clusterRulingTransactions,
  normalizeRulingMerchant,
  proposeRuling,
  type RulingTransaction,
} from './rulings';

function transaction(description: string, id: string): RulingTransaction {
  return {
    id,
    externalId: id,
    description,
    postedOn: '2026-10-01',
    amountCents: -100,
    currencyCode: 'GBP',
    excluded: false,
  };
}

function filedTransaction(
  description: string,
  id: string,
  categoryName: string,
  tags: string[],
): RulingTransaction {
  return {
    ...transaction(description, id),
    before: {
      accountId: 'account-1',
      accountName: 'Checking',
      categoryId: 'category-1',
      categoryName,
      tags,
      source: 'bank',
      pending: false,
    },
  };
}

describe('rulings preparation', () => {
  it('normalizes processor prefixes while keeping distinct merchant text', () => {
    expect(normalizeRulingMerchant(' SQ *Climpson & Son ')).toBe('climpson son');
    expect(normalizeRulingMerchant('TST*The Cock Taver')).toBe('the cock taver');
    expect(normalizeRulingMerchant('The Cock Tavern London')).toBe('the cock tavern london');
  });

  it('groups reviewed rows, preserves currency totals, and excludes killed rows', () => {
    const rows = [
      {
        ...transaction('Balance normalization', '1'),
        amountCents: -200,
      },
      {
        ...transaction('BALANCE NORMALIZATION', '2'),
        amountCents: 100,
        currencyCode: 'USD',
      },
      {
        ...transaction('Balance normalization', '3'),
        amountCents: 500,
        excluded: true,
      },
    ];
    const [cluster] = clusterRulingTransactions(rows);

    expect(cluster).toMatchObject({
      merchant: 'balance normalization',
      lane: 'live',
      totals: { GBP: -200, USD: 100 },
      firstDate: '2026-10-01',
      lastDate: '2026-10-01',
      canFile: true,
    });
    expect(cluster?.rows).toHaveLength(2);
  });

  it('requires three matching past filings and an 80 percent agreement', () => {
    const [cluster] = clusterRulingTransactions([transaction('Unknown Cafe', 'current')]);
    const matching = Array.from({ length: 4 }, (_, index) =>
      filedTransaction('Unknown Cafe', `history-${index}`, 'Food', ['Coffee']),
    );

    expect(proposeRuling(cluster!, null, matching.slice(0, 2))).toBeNull();
    expect(proposeRuling(cluster!, null, matching)).toMatchObject({
      category: 'Food',
      tags: ['Coffee'],
      source: 'history',
    });
    expect(
      proposeRuling(cluster!, null, [
        ...matching.slice(0, 3),
        filedTransaction('Unknown Cafe', 'different', 'Dining', []),
      ]),
    ).toBeNull();
  });

  it('ignores pending, excluded, and uncategorized history', () => {
    const [cluster] = clusterRulingTransactions([transaction('Unknown Cafe', 'current')]);
    const ineligible = Array.from({ length: 3 }, (_, index) =>
      filedTransaction('Unknown Cafe', `history-${index}`, 'Uncategorized', []),
    );

    expect(proposeRuling(cluster!, null, ineligible)).toBeNull();
  });

  it('prefers an exact merchant rule and applies coffee tag patterns', () => {
    const [cluster] = clusterRulingTransactions([transaction('SQ *Coffee House', 'current')]);
    const rulebook = {
      categories: ['Food'],
      tags: ['Coffee'],
      merchantRules: [{ merchant: 'Coffee House', category: 'Food', tags: [] }],
      categoryRules: [],
      tagRules: [],
      coffeePatterns: ['coffee'],
    };

    expect(proposeRuling(cluster!, rulebook, [])).toMatchObject({
      category: 'Food',
      tags: [],
      source: 'rulebook',
    });
    expect(
      proposeRuling(
        cluster!,
        {
          ...rulebook,
          merchantRules: [],
          categoryRules: [{ pattern: 'coffee', category: 'Food' }],
        },
        [],
      ),
    ).toMatchObject({ category: 'Food', tags: ['Coffee'], source: 'rulebook' });
  });
});
