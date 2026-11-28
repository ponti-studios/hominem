// Fake HOMINEM_HOME, Hominem API, Starling and Plaid for the wealth client cases.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test, vi } from 'vitest';

const API_ORIGIN = 'https://api.test';

/** An unsigned JWT-shaped access token; the CLI only reads who it's for. */
export function fakeAccessToken(sub = 'synthetic-user'): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none' })}.${part({ sub })}.fixture-signature`;
}

type Handler = (url: URL, init?: RequestInit) => Response | undefined;
type Tools = Record<string, (args: Record<string, unknown>) => unknown>;

/** A signed-in, throwaway HOMINEM_HOME per test. Stubs and mocks get undone with it. */
export const wealthTest = test.extend<{ home: string }>({
  home: async ({ task: _task }, use) => {
    const home = await mkdtemp(join(tmpdir(), 'hominem-wealth-test-'));
    vi.stubEnv('HOMINEM_HOME', home);
    vi.stubEnv('HOMINEM_API_URL', API_ORIGIN);
    vi.stubEnv('HOMINEM_AGENT_ENV_FILE', join(home, 'env'));
    await mkdir(join(home, 'wealth'), { recursive: true });
    await writeFile(
      join(home, 'hominem_oauth.json'),
      JSON.stringify({
        api_url: API_ORIGIN,
        token_endpoint: `${API_ORIGIN}/token`,
        client_id: 'synthetic-oauth-client',
        access_token: fakeAccessToken(),
        refresh_token: 'fixture-oauth-refresh',
        expires_at: Date.now() + 3_600_000,
      }),
      { mode: 0o600 },
    );
    try {
      await use(home);
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      await rm(home, { recursive: true, force: true });
    }
  },
});

export const emptySyncResponse = {
  ok: true,
  added: 0,
  updated: 0,
  by_source: {},
  held: [],
  new_labels: [],
  unmapped: [],
  linked: [],
  rejected: [],
  watermarks: { starling_max: null, plaid_max: null },
  warnings: [],
};

/** The checkpoint file of the signed-in synthetic user. */
async function syncStatePath(home: string): Promise<string> {
  vi.resetModules();
  const { accountKey } = await import('../wealth-state.js');
  const dir = join(home, 'wealth');
  const token = JSON.parse(await readFile(join(home, 'hominem_oauth.json'), 'utf8'));
  return join(dir, `sync-${await accountKey(dir, token)}.json`);
}

export async function writeSyncState(home: string, state: Record<string, string>) {
  await writeFile(await syncStatePath(home), JSON.stringify(state));
}

export async function readSyncState(home: string): Promise<unknown> {
  return JSON.parse(await readFile(await syncStatePath(home), 'utf8'));
}

export function stubStarlingCredentials() {
  vi.stubEnv('STARLING_API_TOKEN', 'fixture-starling-secret');
}

export function stubPlaidCredentials() {
  vi.stubEnv('PLAID_CLIENT_ID', 'fixture-client');
  vi.stubEnv('PLAID_SECRET', 'fixture-plaid-secret');
  vi.stubEnv('PLAID_ACCESS_TOKEN', 'fixture-plaid-access');
  vi.stubEnv('PLAID_ENV', 'sandbox');
}

/**
 * Replaces `fetch`: provider handlers get first dibs, then the Hominem MCP endpoint answers with
 * `tools`. Anything else is "offline". Returns the tool calls made and the fetch mock.
 */
export function stubWealthFetch(tools: Tools = {}, ...providers: Handler[]) {
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    for (const provider of providers) {
      const handled = provider(url, init);
      if (handled) return handled;
    }
    if (url.origin !== API_ORIGIN) throw new TypeError('offline');
    const request = JSON.parse(String(init?.body));
    if (request.method === 'initialize') {
      return Response.json({ result: { protocolVersion: '2025-06-18' } });
    }
    if (request.method === 'notifications/initialized') {
      return new Response(null, { status: 202 });
    }
    calls.push(request.params);
    const tool = tools[request.params.name];
    if (!tool) throw new Error(`Unexpected tool call: ${request.params.name}`);
    return Response.json({ result: { structuredContent: tool(request.params.arguments) } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export function fakeStarling(data: {
  accounts: object[];
  feedItems?: object[];
  balance?: object;
  savingsGoals?: object[];
  onRequest?: (url: URL, init?: RequestInit) => void;
}): Handler {
  return (url, init) => {
    if (url.hostname !== 'api.starlingbank.com') return undefined;
    data.onRequest?.(url, init);
    if (url.pathname === '/api/v2/accounts') return Response.json({ accounts: data.accounts });
    if (url.pathname.endsWith('/balance')) return Response.json(data.balance ?? {});
    if (url.pathname.endsWith('/savings-goals')) {
      return Response.json({ savingsGoalList: data.savingsGoals ?? [] });
    }
    return Response.json({ feedItems: data.feedItems ?? [] });
  };
}

/** `pages` come back in offset order; liabilities are refused, like an item without the product. */
export function fakePlaid(data: {
  accounts: object[];
  pages: object[][];
  onTransactions?: (body: Record<string, unknown>) => void;
}): Handler {
  const total = data.pages.reduce((sum, page) => sum + page.length, 0);
  return (url, init) => {
    if (url.hostname !== 'sandbox.plaid.com') return undefined;
    if (url.pathname === '/accounts/get') return Response.json({ accounts: data.accounts });
    if (url.pathname === '/liabilities/get') return new Response('{}', { status: 400 });
    const body = JSON.parse(String(init?.body));
    data.onTransactions?.(body);
    let offset = 0;
    const page = data.pages.find((entry) => {
      const found = offset === body.options.offset;
      offset += entry.length;
      return found;
    });
    return Response.json({ transactions: page ?? [], total_transactions: total });
  };
}
