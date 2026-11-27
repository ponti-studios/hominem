import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, vi } from 'vitest';

import {
  emptySyncResponse,
  fakePlaid,
  fakeStarling,
  readSyncState,
  stubPlaidCredentials,
  stubStarlingCredentials,
  stubWealthFetch,
  wealthTest as it,
  writeSyncState,
} from './test/wealth-fixtures';

describe('wealth sync client', () => {
  it('sends raw provider transactions to the owner-scoped service and keeps held rows retryable', async ({
    home,
  }) => {
    vi.stubEnv('WEALTH_SYNC_TODAY', '2026-01-05');
    stubStarlingCredentials();
    stubPlaidCredentials();
    const { calls } = stubWealthFetch(
      {
        finance_sync: (args) => {
          const hasStarling = 'starling' in args;
          const hasPlaid = 'plaid' in args;
          return {
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
          };
        },
      },
      fakeStarling({
        accounts: [{ accountUid: 'bank-a', defaultCategory: 'main', currency: 'USD' }],
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
      }),
      fakePlaid({
        accounts: [{ account_id: 'account-p', name: 'Card', mask: '4242' }],
        pages: [
          [{ transaction_id: 'p-1', account_id: 'account-p' }],
          [{ transaction_id: 'p-2', account_id: 'account-p' }],
        ],
      }),
    );
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.resetModules();
    const { sync } = await import('./wealth.js');
    expect(await sync()).toBe(0);
    expect(calls).toHaveLength(3);
    expect(calls[0].arguments).toMatchObject({
      starling: [{ accountUid: 'bank-a', feedItems: [{ feedItemUid: 'feed-1' }] }],
      windows: { starling_since: '2025-12-29', until: '2026-01-05' },
      linkTransfers: false,
    });
    expect(calls[1].arguments).toMatchObject({
      plaid: { transactions: [{ transaction_id: 'p-1' }, { transaction_id: 'p-2' }] },
      linkTransfers: false,
    });
    expect(calls[2].arguments).toMatchObject({
      windows: { until: '2026-01-05' },
      linkTransfers: true,
    });
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
    expect(await sync()).toBe(0);
    expect(JSON.parse(await readFile(pendingPath, 'utf8'))).toHaveLength(1);
    expect((await stat(pendingPath)).mode & 0o777).toBe(0o600);
    // Rows stuck on hold don't drag the checkpoint further back each run.
    expect(JSON.parse(await readFile(join(home, 'wealth', stateFile), 'utf8'))).toMatchObject({
      starling_max: '2025-12-29',
    });
  });

  it('syncs only Starling with --bank, through today, with an account’s feeds batched together', async ({
    home,
  }) => {
    vi.stubEnv('WEALTH_SYNC_TODAY', '2026-02-20');
    stubStarlingCredentials();
    stubPlaidCredentials();
    const windows: string[] = [];
    const { calls } = stubWealthFetch(
      { finance_sync: () => emptySyncResponse },
      fakeStarling({
        accounts: [{ accountUid: 'bank-a', defaultCategory: 'main', currency: 'GBP' }],
        feedItems: [{ feedItemUid: 'feed-1' }],
        savingsGoals: [{ savingsGoalUid: 'goal-1', name: 'Space' }],
        onRequest: (url) => {
          const from = url.searchParams.get('minTransactionTimestamp');
          if (from) windows.push(`${from} ${url.searchParams.get('maxTransactionTimestamp')}`);
        },
      }),
    );
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await writeSyncState(home, { starling_max: '2026-02-18', plaid_max: '2026-01-01' });
    vi.resetModules();
    const { sync } = await import('./wealth.js');
    expect(await sync(['--bank', 'starling'], 'finance')).toBe(0);
    expect(windows).toEqual([
      '2026-02-04T00:00:00+00:00 2026-02-20T23:59:59.999+00:00',
      '2026-02-04T00:00:00+00:00 2026-02-20T23:59:59.999+00:00',
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0].arguments).toMatchObject({
      starling: [{ space: null }, { space: 'Space' }],
    });
    expect(calls.map((call) => Object.keys(call.arguments))).not.toContainEqual(
      expect.arrayContaining(['plaid']),
    );
    expect(await readSyncState(home)).toEqual({
      starling_max: '2026-02-18',
      plaid_max: '2026-01-01',
    });
  });

  it('ends the window on the UTC day, even when the local date is behind', async ({
    home: _home,
  }) => {
    vi.stubEnv('TZ', 'America/New_York');
    vi.useFakeTimers({ now: new Date('2026-02-21T00:30:00Z'), toFake: ['Date'] });
    stubStarlingCredentials();
    const ends: Array<string | null> = [];
    stubWealthFetch(
      { finance_sync: () => emptySyncResponse },
      fakeStarling({
        accounts: [{ accountUid: 'bank-a', defaultCategory: 'main', currency: 'GBP' }],
        onRequest: (url) => {
          const end = url.searchParams.get('maxTransactionTimestamp');
          if (end) ends.push(end);
        },
      }),
    );
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.resetModules();
    const { sync } = await import('./wealth.js');
    try {
      expect(await sync(['--bank', 'starling'], 'finance')).toBe(0);
    } finally {
      vi.useRealTimers();
    }
    expect(ends).toEqual(['2026-02-21T23:59:59.999+00:00']);
  });

  it('refuses a bank it cannot sync', async ({ home: _home }) => {
    const { fetchMock } = stubWealthFetch();
    vi.resetModules();
    const { sync } = await import('./wealth.js');
    await expect(sync(['--bank', 'monzo'], 'finance')).rejects.toThrow('Unknown bank "monzo"');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends seed identities and raw live balances to server tools without provider credentials', async ({
    home,
  }) => {
    stubStarlingCredentials();
    vi.stubEnv('WEALTH_SEED_DOCTRINE', join(home, 'doctrine.json'));
    await writeFile(join(home, 'doctrine.json'), JSON.stringify({ version: 1 }));
    const { calls } = stubWealthFetch(
      {
        finance_seed: () => ({
          ok: true,
          doctrine: { status: 'created', fingerprint: 'fixture', ruleCounts: {} },
          accounts: [{ name: 'Current', provider_account_id: 'bank-a', created: true, id: 'id-1' }],
        }),
        finance_balances: () => ({ text: 'Starling balances — fixture' }),
      },
      fakeStarling({
        accounts: [
          {
            accountUid: 'bank-a',
            defaultCategory: 'main',
            currency: 'GBP',
            accountType: 'PRIMARY',
            name: 'Current',
          },
        ],
        balance: { clearedBalance: { minorUnits: 12000 } },
        savingsGoals: [{ name: 'Space', totalSaved: { minorUnits: 3000 } }],
        onRequest: (_url, init) => {
          expect(new Headers(init?.headers).get('authorization')).toBe(
            'Bearer fixture-starling-secret',
          );
        },
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

  it('rejects an unreadable doctrine before contacting providers', async ({ home }) => {
    vi.stubEnv('WEALTH_SEED_DOCTRINE', join(home, 'missing.json'));
    const { fetchMock } = stubWealthFetch();
    vi.resetModules();
    const { seed } = await import('./wealth.js');
    await expect(seed()).rejects.toThrow('WEALTH_SEED_DOCTRINE could not be read');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prints the legacy failure envelope and exits nonzero', ({ home }) => {
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

describe('wealth report clients', () => {
  beforeEach(() => {
    vi.stubEnv('WEALTH_SYNC_TODAY', '2026-03-10');
  });

  it('sends the local bill snapshot to the brief and keeps the returned one', async ({ home }) => {
    const { calls } = stubWealthFetch({
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

  it('passes local look inputs and a live FX rate, and notes a failed rate', async ({ home }) => {
    await writeFile(
      join(home, 'wealth', 'forward_look_inputs.json'),
      JSON.stringify({ balance_floors: { GBP: 100 } }),
    );
    let fxStatus = 200;
    const { calls } = stubWealthFetch(
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

  it('closes the previous month from local anchors and cache, and writes WEALTH_CLOSE_OUT', async ({
    home,
  }) => {
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
    const { calls } = stubWealthFetch({
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

  it('exits non-zero when integrity reports a flag', async ({ home: _home }) => {
    stubWealthFetch({
      finance_wealth_integrity: (args) => ({
        ok: false,
        date: args.date,
        flags: [{ check: 'balance_drift', account: 'Card', detail: 'drift', severity: 'flag' }],
        info: {},
        run_id: args.run_id,
      }),
    });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.resetModules();
    const { integrity } = await import('./wealth.js');
    expect(await integrity()).toBe(1);
  });

  it('sends local integrity inputs and raw provider reads without provider credentials', async ({
    home,
  }) => {
    stubStarlingCredentials();
    stubPlaidCredentials();
    await writeFile(join(home, 'wealth', 'manual_anchors.json'), JSON.stringify({ Saver: 30 }));
    const { calls } = stubWealthFetch(
      {
        finance_wealth_integrity: (args) => ({
          ok: true,
          date: args.date,
          flags: [],
          info: {},
          run_id: args.run_id,
        }),
      },
      fakeStarling({
        accounts: [{ accountUid: 'bank-a', defaultCategory: 'main', currency: 'GBP' }],
        feedItems: [{ feedItemUid: 'feed-1' }],
        onRequest: (url) => {
          if (url.pathname.includes('/feed/')) {
            expect(url.searchParams.get('minTransactionTimestamp')).toBe(
              '2026-03-02T00:00:00+00:00',
            );
          }
        },
      }),
      fakePlaid({
        accounts: [
          {
            account_id: 'card',
            mask: '4242',
            type: 'credit',
            balances: { current: 10, iso_currency_code: 'USD' },
          },
        ],
        pages: [[{ account_id: 'card', date: '2026-03-01', amount: 5 }]],
        onTransactions: (body) => expect(body.start_date).toBe('2026-02-08'),
      }),
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
