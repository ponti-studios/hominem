import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

let home = '';

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (home) await rm(home, { recursive: true, force: true });
  home = '';
});

describe('wealth sync client', () => {
  it('sends raw provider transactions to the owner-scoped service and keeps held rows retryable', async () => {
    home = await mkdtemp(join(tmpdir(), 'hominem-wealth-test-'));
    vi.stubEnv('HOMINEM_HOME', home);
    vi.stubEnv('HOMINEM_API_URL', 'https://api.test');
    vi.stubEnv('WEALTH_SYNC_TODAY', '2026-01-05');
    vi.stubEnv('STARLING_API_TOKEN', 'fixture-starling-secret');
    vi.stubEnv('PLAID_CLIENT_ID', 'fixture-client');
    vi.stubEnv('PLAID_SECRET', 'fixture-plaid-secret');
    vi.stubEnv('PLAID_ACCESS_TOKEN', 'fixture-plaid-access');
    vi.stubEnv('PLAID_ENV', 'sandbox');
    await mkdir(home, { recursive: true });
    await writeFile(
      join(home, 'hominem_oauth.json'),
      JSON.stringify({
        api_url: 'https://api.test',
        token_endpoint: 'https://api.test/token',
        client_id: 'synthetic-oauth-client',
        access_token: 'fixture-oauth-access',
        refresh_token: 'fixture-oauth-refresh',
        expires_at: Date.now() + 3_600_000,
      }),
      { mode: 0o600 },
    );

    const calls: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const response = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      if (url.hostname === 'api.starlingbank.com') {
        if (url.pathname === '/api/v2/accounts') {
          return response({
            accounts: [{ accountUid: 'bank-a', defaultCategory: 'main', currency: 'USD' }],
          });
        }
        if (url.pathname.endsWith('/savings-goals')) return response({ savingsGoalList: [] });
        return response({
          feedItems: [
            {
              feedItemUid: 'feed-1',
              transactionTime: '2026-01-03T10:00:00Z',
              counterPartyName: 'Synthetic',
              amount: { minorUnits: 500, currency: 'USD' },
              direction: 'OUT',
              status: 'SETTLED',
            },
          ],
        });
      }
      if (url.hostname === 'sandbox.plaid.com') {
        if (url.pathname === '/accounts/get') {
          return response({ accounts: [{ account_id: 'account-p', name: 'Card', mask: '4242' }] });
        }
        const request = JSON.parse(String(init?.body));
        if (request.options.offset === 0) {
          return response({
            transactions: [{ transaction_id: 'p-1', account_id: 'account-p' }],
            total_transactions: 2,
          });
        }
        return response({
          transactions: [{ transaction_id: 'p-2', account_id: 'account-p' }],
          total_transactions: 2,
        });
      }
      if (url.origin !== 'https://api.test') throw new Error('Unexpected test request');
      const request = JSON.parse(String(init?.body));
      if (request.method === 'initialize')
        return response({ result: { protocolVersion: '2025-06-18' } });
      if (request.method === 'notifications/initialized')
        return new Response(null, { status: 202 });
      expect(request.params.name).toBe('finance_sync');
      calls.push(request.params.arguments);
      const hasStarling = 'starling' in request.params.arguments;
      const hasPlaid = 'plaid' in request.params.arguments;
      return response({
        result: {
          structuredContent: {
            ok: true,
            added: hasPlaid ? 2 : 0,
            updated: 0,
            by_source: hasPlaid ? { Plaid: 2 } : {},
            held: hasStarling
              ? [{ source: 'Starling API', date: '2026-01-03', externalId: 'feed-1' }]
              : [],
            new_labels: [],
            unmapped: [],
            linked: [],
            rejected: [],
            watermarks: {
              starling_max: hasStarling ? '2026-01-03' : null,
              plaid_max: hasPlaid ? '2026-01-04' : null,
            },
            warnings: [],
          },
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.resetModules();
    const { sync } = await import('./wealth.js');
    expect(await sync()).toBe(0);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({
      starling: [{ accountUid: 'bank-a', feedItems: [{ feedItemUid: 'feed-1' }] }],
      windows: { starling_since: '2025-12-29', until: '2026-01-05' },
      linkTransfers: false,
    });
    expect(calls[1]).toMatchObject({
      plaid: { transactions: [{ transaction_id: 'p-1' }, { transaction_id: 'p-2' }] },
      linkTransfers: false,
    });
    expect(calls[2]).toMatchObject({ windows: { until: '2026-01-05' }, linkTransfers: true });
    expect(JSON.stringify(calls)).not.toContain('fixture-starling-secret');
    expect(JSON.stringify(calls)).not.toContain('fixture-plaid-secret');
    expect(JSON.stringify(calls)).not.toContain('fixture-plaid-access');
    const envelope = JSON.parse(String(output.mock.calls[0][0]));
    expect(envelope).toMatchObject({
      ok: true,
      added: 2,
      held: [{ source: 'Starling API', externalId: 'feed-1' }],
      warnings: [expect.stringContaining('checkpoint was retained or rewound')],
      run_id: expect.any(Number),
    });
    const files = await readdir(join(home, 'wealth'));
    const stateFile = files.find((file) => file.startsWith('sync-'))!;
    const state = JSON.parse(await readFile(join(home, 'wealth', stateFile), 'utf8'));
    expect(state).toEqual({ starling_max: '2025-12-29', plaid_max: '2026-01-04' });
    const logFile = files.find((file) => file.startsWith('runs-'))!;
    const log = await readFile(join(home, 'wealth', logFile), 'utf8');
    expect(log).not.toContain('fixture-');
    expect(JSON.parse(log)).toMatchObject({ run_id: envelope.run_id, ok: true, held: 1 });
    const pendingFile = files.find((file) => file.startsWith('pending_unmapped-'))!;
    const pendingPath = join(home, 'wealth', pendingFile);
    expect(JSON.parse(await readFile(pendingPath, 'utf8'))).toEqual([
      expect.objectContaining({ source: 'Starling API', externalId: 'feed-1' }),
    ]);
    expect((await stat(pendingPath)).mode & 0o777).toBe(0o600);
    expect(await sync()).toBe(0);
    expect(JSON.parse(await readFile(pendingPath, 'utf8'))).toHaveLength(1);
  });

  it('sends seed identities and raw live balances to server tools without provider credentials', async () => {
    home = await mkdtemp(join(tmpdir(), 'hominem-wealth-provider-test-'));
    vi.stubEnv('HOMINEM_HOME', home);
    vi.stubEnv('HOMINEM_API_URL', 'https://api.test');
    vi.stubEnv('STARLING_API_TOKEN', 'fixture-starling-secret');
    vi.stubEnv('WEALTH_SEED_DOCTRINE', join(home, 'doctrine.json'));
    await writeFile(
      join(home, 'hominem_oauth.json'),
      JSON.stringify({
        api_url: 'https://api.test',
        token_endpoint: 'https://api.test/token',
        client_id: 'synthetic-oauth-client',
        access_token: 'fixture-oauth-access',
        refresh_token: 'fixture-oauth-refresh',
        expires_at: Date.now() + 3_600_000,
      }),
      { mode: 0o600 },
    );
    await writeFile(join(home, 'doctrine.json'), JSON.stringify({ version: 1 }));
    const calls: Array<{ name: string; arguments: unknown }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        const response = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          });
        if (url.hostname === 'api.starlingbank.com') {
          expect(new Headers(init?.headers).get('authorization')).toBe(
            'Bearer fixture-starling-secret',
          );
          if (url.pathname === '/api/v2/accounts') {
            return response({
              accounts: [
                {
                  accountUid: 'bank-a',
                  defaultCategory: 'main',
                  currency: 'GBP',
                  accountType: 'PRIMARY',
                  name: 'Current',
                },
              ],
            });
          }
          if (url.pathname.endsWith('/balance')) {
            return response({ clearedBalance: { minorUnits: 12000 } });
          }
          if (url.pathname.endsWith('/savings-goals')) {
            return response({
              savingsGoalList: [{ name: 'Space', totalSaved: { minorUnits: 3000 } }],
            });
          }
        }
        if (url.origin !== 'https://api.test') throw new Error('Unexpected test request');
        const request = JSON.parse(String(init?.body));
        if (request.method === 'initialize') return response({ result: {} });
        if (request.method === 'notifications/initialized')
          return new Response(null, { status: 202 });
        calls.push(request.params);
        const structuredContent =
          request.params.name === 'finance_seed'
            ? {
                ok: true,
                doctrine: { status: 'created', fingerprint: 'fixture', ruleCounts: {} },
                accounts: [
                  { name: 'Current', provider_account_id: 'bank-a', created: true, id: 'id-1' },
                ],
              }
            : { text: 'Starling balances — fixture' };
        return response({ result: { structuredContent } });
      }),
    );
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.resetModules();
    const { seed, balances } = await import('./wealth.js');
    expect(await seed()).toBe(0);
    expect(await balances()).toBe(0);
    expect(calls).toMatchObject([
      {
        name: 'finance_seed',
        arguments: { accounts: [{ accountUid: 'bank-a' }], doctrine: { version: 1 } },
      },
      {
        name: 'finance_balances',
        arguments: {
          accounts: [{ balance: { clearedBalance: { minorUnits: 12000 } } }],
        },
      },
    ]);
    expect(JSON.stringify(calls)).not.toContain('fixture-starling-secret');
    expect(JSON.parse(String(output.mock.calls[0][0]))).toMatchObject({
      ok: true,
      run_id: expect.any(Number),
      accounts: [{ provider_account_id: 'bank-a' }],
    });
    expect(output.mock.calls[1][0]).toBe('Starling balances — fixture');
  });

  it('rejects an unreadable doctrine before contacting providers', async () => {
    home = await mkdtemp(join(tmpdir(), 'hominem-wealth-seed-test-'));
    vi.stubEnv('HOMINEM_HOME', home);
    vi.stubEnv('WEALTH_SEED_DOCTRINE', join(home, 'missing.json'));
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { seed } = await import('./wealth.js');
    await expect(seed()).rejects.toThrow('WEALTH_SEED_DOCTRINE could not be read');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prints the legacy failure envelope and exits nonzero', async () => {
    home = await mkdtemp(join(tmpdir(), 'hominem-wealth-failure-test-'));
    const result = spawnSync('bun', ['run', 'src/index.ts', 'wealth', 'sync', '--invalid'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, HOMINEM_HOME: home, HOMINEM_AGENT_ENV_FILE: join(home, 'env') },
    });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      error: expect.stringContaining('Usage: hominem wealth sync'),
    });
  });
});

async function reportHome(prefix: string) {
  home = await mkdtemp(join(tmpdir(), prefix));
  vi.stubEnv('HOMINEM_HOME', home);
  vi.stubEnv('HOMINEM_API_URL', 'https://api.test');
  vi.stubEnv('HOMINEM_AGENT_ENV_FILE', join(home, 'env'));
  vi.stubEnv('WEALTH_SYNC_TODAY', '2026-03-10');
  await mkdir(join(home, 'wealth'), { recursive: true });
  await writeFile(
    join(home, 'hominem_oauth.json'),
    JSON.stringify({
      api_url: 'https://api.test',
      token_endpoint: 'https://api.test/token',
      client_id: 'synthetic-oauth-client',
      access_token: 'fixture-oauth-access',
      refresh_token: 'fixture-oauth-refresh',
      expires_at: Date.now() + 3_600_000,
    }),
    { mode: 0o600 },
  );
}

function stubReports(
  tools: Record<string, (args: Record<string, unknown>) => unknown>,
  external: (url: URL, init?: RequestInit) => Response | undefined = () => undefined,
) {
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const handled = external(url, init);
      if (handled) return handled;
      if (url.origin !== 'https://api.test') throw new TypeError('offline');
      const request = JSON.parse(String(init?.body));
      if (request.method === 'notifications/initialized')
        return new Response(null, { status: 202 });
      if (request.method === 'initialize') return Response.json({ result: {} });
      calls.push(request.params);
      return Response.json({
        result: { structuredContent: tools[request.params.name](request.params.arguments) },
      });
    }),
  );
  return calls;
}

describe('wealth report clients', () => {
  it('sends the local bill snapshot to the brief and keeps the returned one', async () => {
    await reportHome('hominem-wealth-brief-test-');
    const calls = stubReports({
      finance_wealth_brief: (args) => ({
        ok: true,
        date: args.date,
        sections: { diagnostics: {} },
        silent: false,
        run_id: args.run_id,
        snapshot: { bills: [{ id: 'bill-2' }] },
      }),
    });
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.resetModules();
    const { brief } = await import('./wealth.js');
    expect(await brief()).toBe(0);
    const [snapshotFile] = (await readdir(join(home, 'wealth'))).filter((file) =>
      file.startsWith('morning_brief_bills-'),
    );
    await writeFile(join(home, 'wealth', snapshotFile), '{broken');
    expect(await brief()).toBe(0);
    expect(calls[0].arguments).toMatchObject({
      date: '2026-03-10',
      snapshot: null,
      bills_only: false,
    });
    expect(calls[1].arguments.snapshot).toBeNull();
    const second = JSON.parse(String(output.mock.calls[1][0]));
    expect(second).not.toHaveProperty('snapshot');
    expect(second.sections.diagnostics.source_errors.snapshot_read).toContain('not valid JSON');
    expect(JSON.parse(await readFile(join(home, 'wealth', snapshotFile), 'utf8'))).toEqual({
      bills: [{ id: 'bill-2' }],
    });
  });

  it('passes local look inputs and a live FX rate, and notes a failed rate', async () => {
    await reportHome('hominem-wealth-look-test-');
    await writeFile(
      join(home, 'wealth', 'forward_look_inputs.json'),
      JSON.stringify({ balance_floors: { GBP: 100 } }),
    );
    let fxStatus = 200;
    const calls = stubReports(
      { finance_wealth_look: () => ({ ok: true, sections: { diagnostics: { notes: [] } } }) },
      (url) =>
        url.hostname === 'api.frankfurter.dev'
          ? Response.json({ rates: { GBP: 0.8 }, date: '2026-03-09' }, { status: fxStatus })
          : undefined,
    );
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.resetModules();
    const { look } = await import('./wealth.js');
    expect(await look()).toBe(0);
    fxStatus = 503;
    expect(await look()).toBe(0);
    expect(calls[0].arguments).toEqual({
      as_of: '2026-03-10',
      inputs: { balance_floors: { GBP: 100 } },
      fx: {
        rate_usd_to_gbp: 0.8,
        rate_date: '2026-03-09',
        rate_source: 'Frankfurter (ECB reference rate), fetched live',
      },
    });
    expect(calls[1].arguments).not.toHaveProperty('fx');
    expect(JSON.parse(String(output.mock.calls[1][0])).sections.diagnostics.notes).toEqual([
      'fx rate unavailable (HTTP 503)',
    ]);
  });

  it('closes the previous month from local anchors and cache, and writes WEALTH_CLOSE_OUT', async () => {
    await reportHome('hominem-wealth-close-test-');
    await writeFile(
      join(home, 'wealth', 'monthly_close_anchors.json'),
      JSON.stringify({ anchors: [] }),
    );
    await writeFile(
      join(home, 'wealth', 'monthly_check_2026-02_data.json'),
      JSON.stringify({ spending: { categories: [] } }),
    );
    const out = join(home, 'close.md');
    vi.stubEnv('WEALTH_CLOSE_OUT', out);
    const calls = stubReports({
      finance_wealth_close: () => ({ md: '# Close\n', calls: 4, message: 'ok' }),
    });
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.resetModules();
    const { close } = await import('./wealth.js');
    expect(await close()).toBe(0);
    expect(calls[0].arguments).toEqual({
      month: '2026-02',
      today: '2026-03-10',
      anchors: { anchors: [] },
      cache: { spending: { categories: [] } },
    });
    expect(await readFile(out, 'utf8')).toBe('# Close\n');
    expect(stdout).toHaveBeenCalledWith(`wrote ${out} (4 calls)\n`);
    vi.stubEnv('WEALTH_CLOSE_MONTH', '2026-13');
    expect(await close()).toBe(2);
    expect(calls).toHaveLength(1);
  });

  it('sends local integrity inputs and raw provider reads without provider credentials', async () => {
    await reportHome('hominem-wealth-integrity-test-');
    vi.stubEnv('STARLING_API_TOKEN', 'fixture-starling-secret');
    vi.stubEnv('PLAID_CLIENT_ID', 'fixture-client');
    vi.stubEnv('PLAID_SECRET', 'fixture-plaid-secret');
    vi.stubEnv('PLAID_ACCESS_TOKEN', 'fixture-plaid-access');
    await writeFile(join(home, 'wealth', 'manual_anchors.json'), JSON.stringify({ Saver: 30 }));
    const calls = stubReports(
      {
        finance_wealth_integrity: (args) => ({
          ok: true,
          date: args.date,
          flags: [],
          info: {},
          run_id: args.run_id,
        }),
      },
      (url, init) => {
        if (url.hostname === 'api.starlingbank.com') {
          if (url.pathname === '/api/v2/accounts') {
            return Response.json({
              accounts: [{ accountUid: 'bank-a', defaultCategory: 'main', currency: 'GBP' }],
            });
          }
          if (url.pathname.endsWith('/savings-goals'))
            return Response.json({ savingsGoalList: [] });
          expect(url.searchParams.get('minTransactionTimestamp')).toBe('2026-03-02T00:00:00+00:00');
          return Response.json({ feedItems: [{ feedItemUid: 'feed-1' }] });
        }
        if (url.hostname !== 'sandbox.plaid.com') return undefined;
        if (url.pathname === '/accounts/get') {
          return Response.json({
            accounts: [
              {
                account_id: 'card',
                mask: '4242',
                type: 'credit',
                balances: { current: 10, iso_currency_code: 'USD' },
              },
            ],
          });
        }
        if (url.pathname === '/liabilities/get') return new Response('{}', { status: 400 });
        expect(JSON.parse(String(init?.body)).start_date).toBe('2026-02-08');
        return Response.json({
          transactions: [{ account_id: 'card', date: '2026-03-01', amount: 5 }],
          total_transactions: 1,
        });
      },
    );
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.resetModules();
    const { integrity } = await import('./wealth.js');
    expect(await integrity()).toBe(0);
    expect(calls[0].arguments).toMatchObject({
      date: '2026-03-10',
      manual_anchors: { Saver: 30 },
      plaid: {
        accounts: [{ account_id: 'card', balances: { current: 10 } }],
        transactions: [{ account_id: 'card', amount: 5 }],
        transactions_since: '2026-02-08',
        liabilities_skipped: [{ institution: 'Plaid', error: 'Plaid request failed (HTTP 400).' }],
      },
      starling: { feeds: [{ accountUid: 'bank-a', feedItems: [{ feedItemUid: 'feed-1' }] }] },
    });
    expect(calls[0].arguments).not.toHaveProperty('sync_state');
    expect(JSON.stringify(calls)).not.toContain('fixture-');
  });
});
