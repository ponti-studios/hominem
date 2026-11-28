import type { Route } from './mock-server.ts';

export const starlingRoutes: Route = (url, req) => {
  if (req.headers.authorization !== 'Bearer test-token') {
    return [401, { error: 'missing synthetic token' }];
  }
  if (req.method === 'GET' && url.pathname === '/api/v2/accounts') {
    return [
      200,
      {
        accounts: [
          {
            accountUid: 'acc-current',
            defaultCategory: 'cat-current',
            currency: 'GBP',
            accountType: 'PRIMARY',
            name: 'Synthetic Current',
          },
        ],
      },
    ];
  }
  if (req.method === 'GET' && url.pathname === '/api/v2/accounts/acc-current/balance') {
    return [
      200,
      {
        currency: 'GBP',
        clearedBalance: { minorUnits: 12500 },
        effectiveBalance: { minorUnits: 12000 },
        pendingTransactions: { minorUnits: -500 },
        acceptedOverdraft: { minorUnits: 0 },
      },
    ];
  }
  if (req.method === 'GET' && url.pathname === '/api/v2/account/acc-current/savings-goals') {
    return [
      200,
      {
        savingsGoalList: [
          {
            savingsGoalUid: 'goal-bills',
            name: 'Bills',
            totalSaved: { minorUnits: 3000 },
            target: { minorUnits: 5000 },
          },
        ],
      },
    ];
  }
  if (
    req.method === 'GET' &&
    url.pathname === '/api/v2/feed/account/acc-current/category/cat-current/transactions-between'
  ) {
    return [
      200,
      {
        feedItems: [
          {
            feedItemUid: 'feed-1',
            amount: { minorUnits: 1299, currency: 'GBP' },
            direction: 'OUT',
            transactionTime: '2026-11-24T12:00:00Z',
            counterPartyName: 'Synthetic Shop',
            reference: 'card',
            source: 'CARD',
            status: 'SETTLED',
          },
        ],
      },
    ];
  }
  if (
    req.method === 'GET' &&
    url.pathname === '/api/v2/feed/account/acc-current/category/goal-bills/transactions-between'
  ) {
    return [200, { feedItems: [] }];
  }
  return [404, { error: `no mock route for ${req.method} ${url.pathname}` }];
};

export function starlingEnv(serverUrl: string, dbFile: string): Record<string, string> {
  return {
    HOMINEM_AGENT_DB: dbFile,
    STARLING_API_TOKEN: 'test-token',
    STARLING_API_BASE: serverUrl,
  };
}
