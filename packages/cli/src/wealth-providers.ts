import { z } from 'zod';

const starlingAccountsSchema = z.object({
  accounts: z.array(
    z.object({
      accountUid: z.string().min(1),
      defaultCategory: z.string().min(1).optional(),
      currency: z.string().min(1),
      accountType: z.string().optional(),
      name: z.string().optional(),
    }),
  ),
});
const starlingGoalsSchema = z.object({
  savingsGoalList: z.array(
    z.object({ savingsGoalUid: z.string().min(1), name: z.string().nullable().optional() }),
  ),
});
const feedSchema = z.object({ feedItems: z.array(z.unknown()) });
const plaidAccountsSchema = z.object({
  accounts: z.array(
    z.object({
      account_id: z.string(),
      name: z.string().optional(),
      mask: z.string().nullable().optional(),
      type: z.string().optional(),
      balances: z
        .object({
          current: z.number().nullable().optional(),
          iso_currency_code: z.string().nullable().optional(),
        })
        .optional(),
    }),
  ),
});
const plaidTransactionsSchema = z.object({
  transactions: z.array(z.unknown()),
  total_transactions: z.number().int().nonnegative(),
});

export class WealthProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WealthProviderError';
  }
}

interface StarlingConfig {
  token: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

function providerBase(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  ) {
    throw new WealthProviderError('Provider URLs must use HTTPS or loopback HTTP.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new WealthProviderError('Provider URLs cannot contain credentials, query, or fragment.');
  }
  return url.toString().replace(/\/$/, '');
}

function starlingRequest(options: StarlingConfig) {
  const base = providerBase(options.baseUrl ?? 'https://api.starlingbank.com');
  return async (path: string, params?: Record<string, string>) => {
    const url = new URL(base + path);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await (options.fetchImpl ?? fetch)(url, {
        headers: { accept: 'application/json', authorization: `Bearer ${options.token}` },
        signal: AbortSignal.timeout(30_000),
        redirect: 'error',
      });
    } catch (error) {
      if (error instanceof TypeError || error instanceof DOMException) {
        throw new WealthProviderError('Starling request could not be completed.');
      }
      throw error;
    }
    if (!response.ok)
      throw new WealthProviderError(`Starling request failed (HTTP ${response.status}).`);
    return response.json();
  };
}

export async function starlingAccounts(options: StarlingConfig) {
  return starlingAccountsSchema.parse(await starlingRequest(options)('/api/v2/accounts')).accounts;
}

export async function pullStarlingFeeds(since: string, until: string, options: StarlingConfig) {
  const request = starlingRequest(options);
  const accounts = starlingAccountsSchema.parse(await request('/api/v2/accounts')).accounts;
  const feeds: Array<{
    accountUid: string;
    currency: string;
    space: string | null;
    feedItems: unknown[];
  }> = [];
  const notes: string[] = [];
  const window = {
    minTransactionTimestamp: `${since}T00:00:00+00:00`,
    // `until` is inclusive, or today's spending never shows up.
    maxTransactionTimestamp: `${until}T23:59:59.999+00:00`,
  };
  for (const account of accounts) {
    if (!account.defaultCategory)
      throw new WealthProviderError('Starling account is missing its default category.');
    const accountUid = encodeURIComponent(account.accountUid);
    const collect = async (category: string, space: string | null) => {
      const body = feedSchema.parse(
        await request(
          `/api/v2/feed/account/${accountUid}/category/${encodeURIComponent(category)}/transactions-between`,
          window,
        ),
      );
      feeds.push({
        accountUid: account.accountUid,
        currency: account.currency,
        space,
        feedItems: body.feedItems,
      });
    };
    await collect(account.defaultCategory, null);
    try {
      const goals = starlingGoalsSchema.parse(
        await request(`/api/v2/account/${accountUid}/savings-goals`),
      );
      for (const goal of goals.savingsGoalList) {
        await collect(goal.savingsGoalUid, goal.name ?? null);
      }
    } catch (error) {
      if (!(error instanceof WealthProviderError)) throw error;
      notes.push(`Starling savings feeds could not be read: ${error.message}`);
    }
  }
  return { feeds, notes };
}

export async function starlingBalances(options: StarlingConfig) {
  const request = starlingRequest(options);
  const accounts = starlingAccountsSchema.parse(await request('/api/v2/accounts')).accounts;
  const balances: Array<{
    account: (typeof accounts)[number];
    balance: unknown;
    savingsGoalList: unknown[];
  }> = [];
  const notes: string[] = [];
  for (const account of accounts) {
    const accountUid = encodeURIComponent(account.accountUid);
    let balance: unknown;
    try {
      balance = await request(`/api/v2/accounts/${accountUid}/balance`);
    } catch (error) {
      if (!(error instanceof WealthProviderError)) throw error;
      notes.push(`balance unavailable for ${account.name ?? account.accountUid}: ${error.message}`);
      continue;
    }
    let savingsGoalList: unknown[] = [];
    try {
      savingsGoalList = z
        .object({ savingsGoalList: z.array(z.unknown()) })
        .parse(await request(`/api/v2/account/${accountUid}/savings-goals`)).savingsGoalList;
    } catch (error) {
      if (!(error instanceof WealthProviderError)) throw error;
      notes.push(
        `savings goals unavailable for ${account.name ?? account.accountUid}: ${error.message}`,
      );
    }
    balances.push({ account, balance, savingsGoalList });
  }
  return { accounts: balances, notes };
}

interface PlaidConfig {
  clientId: string;
  secret: string;
  accessToken: string;
  baseUrl?: string;
  environment?: 'sandbox' | 'production';
  fetchImpl?: typeof fetch;
}

function plaidRequest(options: PlaidConfig) {
  const base = providerBase(
    options.baseUrl ??
      (options.environment === 'production'
        ? 'https://production.plaid.com'
        : 'https://sandbox.plaid.com'),
  );
  return async (path: string, body: Record<string, unknown>) => {
    const response = await (options.fetchImpl ?? fetch)(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: options.clientId,
        secret: options.secret,
        access_token: options.accessToken,
        ...body,
      }),
      signal: AbortSignal.timeout(300_000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new WealthProviderError(`Plaid request failed (HTTP ${response.status}).`);
    return response.json();
  };
}

export async function pullPlaidTransactions(since: string, until: string, options: PlaidConfig) {
  const request = plaidRequest(options);
  const { accounts } = plaidAccountsSchema.parse(await request('/accounts/get', {}));
  const transactions: unknown[] = [];
  let total = Number.POSITIVE_INFINITY;
  while (transactions.length < total) {
    const page = plaidTransactionsSchema.parse(
      await request('/transactions/get', {
        start_date: since,
        end_date: until,
        options: { count: 500, offset: transactions.length },
      }),
    );
    if (page.transactions.length === 0 && transactions.length < page.total_transactions) {
      throw new WealthProviderError('Plaid returned an incomplete transactions page.');
    }
    transactions.push(...page.transactions);
    total = page.total_transactions;
  }
  return { accounts, transactions };
}

export async function pullPlaidLiabilities(options: PlaidConfig) {
  const body = z
    .object({
      accounts: z.array(z.unknown()),
      liabilities: z.object({ credit: z.array(z.unknown()).nullable().optional() }),
    })
    .parse(await plaidRequest(options)('/liabilities/get', {}));
  return { accounts: body.accounts, liabilities: { credit: body.liabilities.credit ?? [] } };
}
