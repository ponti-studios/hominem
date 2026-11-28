/** One Starling feed, shaped like the provider payload `finance_sync` accepts. */
export function starlingFeed(
  overrides: Partial<{
    feedItemUid: string;
    merchant: string;
    amount: number;
    accountUid: string;
  }> = {},
) {
  const item = {
    feedItemUid: 'feed-1',
    date: '2026-01-02',
    merchant: 'Synth Coffee',
    amount: -5,
    currency: 'USD',
    accountUid: 'bank-a',
    ...overrides,
  };
  return {
    accountUid: item.accountUid,
    currency: item.currency,
    space: null,
    feedItems: [
      {
        feedItemUid: item.feedItemUid,
        transactionTime: `${item.date}T12:00:00Z`,
        counterPartyName: item.merchant,
        amount: { minorUnits: Math.round(Math.abs(item.amount) * 100), currency: item.currency },
        direction: item.amount < 0 ? 'OUT' : 'IN',
        status: 'SETTLED',
      },
    ],
  };
}
