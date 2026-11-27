import type { Route } from './mock-server.ts';

export const plaidRoutes: Route = (url) => {
  if (url.pathname === '/link/token/create') {
    return [200, { link_token: 'link-synthetic', expiration: '2030-01-01T00:00:00Z' }];
  }
  if (url.pathname === '/item/public_token/exchange') {
    return [200, { access_token: 'access-synthetic', item_id: 'item-synthetic' }];
  }
  if (url.pathname === '/accounts/get') {
    return [
      200,
      {
        institutions: [{ display_name: 'Synth Bank', credential_id: 'item-synthetic' }],
        accounts: [
          {
            account_id: 'account-synthetic',
            name: 'Checking',
            mask: '1234',
            type: 'depository',
            balances: { current: 42.5, iso_currency_code: 'USD' },
          },
        ],
      },
    ];
  }
  if (url.pathname === '/transactions/get') {
    return [
      200,
      {
        accounts: [],
        transactions: [
          {
            account_id: 'account-synthetic',
            date: '2026-11-20',
            pending: false,
            merchant_name: 'Synthetic Coffee',
            amount: 4.25,
            iso_currency_code: 'USD',
          },
        ],
        total_transactions: 1,
      },
    ];
  }
  return [404, { error_code: 'NOT_FOUND', error_message: 'synthetic route missing' }];
};

export function plaidEnv(
  serverUrl: string,
  dbFile: string,
  envFile: string,
): Record<string, string> {
  return {
    HOMINEM_AGENT_DB: dbFile,
    HOMINEM_AGENT_ENV_FILE: envFile,
    PLAID_CLIENT_ID: 'test-client',
    PLAID_SECRET: 'test-secret',
    PLAID_ACCESS_TOKEN: 'test-access',
    PLAID_ITEM_ID: 'item-synthetic',
    PLAID_ENV: 'sandbox',
    PLAID_API_BASE: serverUrl,
  };
}
