/**
 * wealth-manager Layer 1 (integrity check): mock-backend tests,
 * synthetic-only (2026-11-22 ruling — no personal financial data in this
 * repo, fixtures included). The same three fake backends as the sync
 * tests — in-process Starling HTTP, in-process Hominem MCP JSON-RPC, a
 * mock `plaid` CLI reading a per-test fixture file — prove each check:
 * feed health, Plaid drift with the gap-window math, Starling window
 * reconciliation (with the recursive date-window split), anchor
 * freshness, cancellation watches, statement payment verification, and
 * the degraded PLAID_CLI/STARLING_API_TOKEN legs. Law 1: every external
 * call lands an events row; law 4: a missing backbone env fails by name.
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { rows, runWrapper, tmpDb } from './helpers.ts';

const CHECK = 'systems/wealth-manager/integrity_check.ts';
const TODAY = '2026-11-22';
const WM = '2026-11-21'; // fresh watermark: yesterday
const FROM = '2026-11-20'; // window start: wm - 1

// -- synthetic identity --
const PRIMARY_UID = '11111111-aaaa-4bbb-8ccc-111111111111';
const SAVER_UID = '22222222-aaaa-4bbb-8ccc-222222222222';

const ACCOUNTS = [
  {
    id: 'acc-starling',
    name: 'Starling Chequing',
    accountType: 'checking',
    currencyCode: 'GBP',
    lifecycleStatus: 'open',
    provider: 'starling',
    providerAccountId: PRIMARY_UID,
    accountNumber: null,
  },
  {
    id: 'acc-saver',
    name: 'Starling Saver',
    accountType: 'savings',
    currencyCode: 'GBP',
    lifecycleStatus: 'open',
    provider: 'starling',
    providerAccountId: SAVER_UID,
    accountNumber: null,
  },
  {
    id: 'acc-card',
    name: 'Synth Card …4242',
    accountType: 'credit_card',
    currencyCode: 'USD',
    lifecycleStatus: 'open',
    provider: 'plaid',
    providerAccountId: null,
    accountNumber: '4242',
  },
  {
    id: 'acc-ira',
    name: 'Synth IRA',
    accountType: 'investment',
    currencyCode: 'USD',
    lifecycleStatus: 'open',
    provider: null,
    providerAccountId: null,
    accountNumber: null,
  },
];

const ledgerRow = (over: Record<string, any>) => ({
  id: 'r-' + Math.random().toString(36).slice(2),
  accountId: 'acc-starling',
  accountName: 'Starling Chequing',
  postedOn: '2026-11-20',
  description: 'synth row',
  merchantName: null,
  amount: -34.5,
  currencyCode: 'GBP',
  transactionType: 'debit',
  categoryId: null,
  categoryName: 'Food',
  tags: [],
  notes: null,
  orderNumber: null,
  source: 'starling',
  recurring: false,
  pending: false,
  excluded: false,
  counterpartId: null,
  ...over,
});

const defaultSearchRows = () => [
  ledgerRow({
    accountId: 'acc-starling',
    accountName: 'Starling Chequing',
    amount: -34.5,
    postedOn: FROM,
  }),
  ledgerRow({
    accountId: 'acc-starling',
    accountName: 'Starling Chequing',
    amount: 120,
    postedOn: '2026-11-21',
    transactionType: 'credit',
  }),
  ledgerRow({
    accountId: 'acc-saver',
    accountName: 'Starling Saver',
    amount: 50,
    postedOn: FROM,
    transactionType: 'credit',
  }),
  // The card's statement payment, in [issue 11-01, grace 11-18].
  ledgerRow({
    accountId: 'acc-card',
    accountName: 'Synth Card …4242',
    amount: 150,
    postedOn: '2026-11-10',
    currencyCode: 'USD',
    transactionType: 'credit',
    source: 'plaid',
  }),
];

const defaultSummary = () => [
  {
    accountId: 'acc-starling',
    accountName: 'Starling Chequing',
    allowedCurrencies: ['GBP'],
    status: 'open',
    transactionCount: 2,
    excludedCount: 0,
    totals: [{ currencyCode: 'GBP', sum: 85.5 }],
    minPostedOn: FROM,
    maxPostedOn: '2026-11-21',
  },
  {
    accountId: 'acc-saver',
    accountName: 'Starling Saver',
    allowedCurrencies: ['GBP'],
    status: 'open',
    transactionCount: 1,
    excludedCount: 0,
    totals: [{ currencyCode: 'GBP', sum: 50 }],
    minPostedOn: FROM,
    maxPostedOn: FROM,
  },
  {
    accountId: 'acc-card',
    accountName: 'Synth Card …4242',
    allowedCurrencies: ['USD'],
    status: 'open',
    transactionCount: 1,
    excludedCount: 0,
    totals: [{ currencyCode: 'USD', sum: -200 }],
    minPostedOn: '2026-11-01',
    maxPostedOn: '2026-11-20',
  },
  {
    accountId: 'acc-ira',
    accountName: 'Synth IRA',
    allowedCurrencies: ['USD'],
    status: 'open',
    transactionCount: 0,
    excludedCount: 0,
    totals: [],
    minPostedOn: null,
    maxPostedOn: null,
  },
];

const feedItem = (over: Record<string, any>) => ({
  feedItemUid: 'f-' + Math.random().toString(36).slice(2),
  transactionTime: `${FROM}T10:00:00.000Z`,
  amount: { minorUnits: 3450, currency: 'GBP' },
  direction: 'OUT',
  status: 'SETTLED',
  source: 'MASTER_CARD',
  counterPartyName: 'Synth Roasters',
  ...over,
});

const defaultStarlingFeed = (): Record<string, any[]> => ({
  'cat-primary': [
    feedItem({
      amount: { minorUnits: 3450, currency: 'GBP' },
      direction: 'OUT',
      transactionTime: `${FROM}T20:15:00.000Z`,
    }),
    feedItem({
      amount: { minorUnits: 12000, currency: 'GBP' },
      direction: 'IN',
      transactionTime: '2026-11-21T06:00:00.000Z',
      source: 'FASTER_PAYMENTS',
    }),
  ],
  'cat-saver': [
    feedItem({
      amount: { minorUnits: 5000, currency: 'GBP' },
      direction: 'IN',
      transactionTime: `${FROM}T09:00:00.000Z`,
      source: 'FASTER_PAYMENTS',
    }),
  ],
});

const defaultNetWorth = () => [
  {
    accountId: 'acc-ira',
    name: 'Synth IRA',
    institution: 'Synth',
    accountType: 'investment',
    currencyCode: 'USD',
    balance: 4200,
    balanceAsOf: '2026-11-15',
  },
];

// The plaid mock reads this fixture file on every invocation, so tests
// can mutate the feed between runs.
const defaultPlaidFixture = () => ({
  accounts: {
    institutions: [
      { display_name: 'Synth Bank', credential_id: 'cred-ok', read_status: 'ok' },
      { display_name: 'SynthWise', credential_id: 'cred-fail', read_status: 'ok' },
    ],
    accounts: [
      {
        account_id: 'plaid-acc-1',
        name: 'Synth Card',
        mask: '4242',
        type: 'credit',
        balances: { current: 200, iso_currency_code: 'USD' },
        _plaid_source: { credential_id: 'cred-ok' },
      },
    ],
  },
  liabilities: {
    'cred-ok': {
      accounts: [{ account_id: 'plaid-acc-1', mask: '4242' }],
      liabilities: {
        credit: [
          {
            account_id: 'plaid-acc-1',
            last_statement_balance: 150,
            last_statement_issue_date: '2026-11-01',
            next_payment_due_date: '2026-11-15',
          },
        ],
      },
    },
  },
  // The Wise lesson: one institution has no liability accounts and the
  // per-credential read fails — skipped with a named note, never fatal.
  liabilitiesFailFor: ['cred-fail'],
  gapTransactions: [] as any[],
});

let dir: string;
let dbFile: string;
let starlingServer: ReturnType<typeof createServer>;
let starlingPort: number;
let hominemServer: ReturnType<typeof createServer>;
let hominemPort: number;
let plaidServer: ReturnType<typeof createServer>;
let plaidPort: number;
let fixturePath: string;
let liabilitiesCalls: number;
const state = {
  summary: defaultSummary(),
  searchRows: defaultSearchRows(),
  watchRows: [] as any[],
  netWorth: defaultNetWorth(),
  starlingFeed: defaultStarlingFeed(),
  searchRequests: [] as any[],
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-integrity-'));
  dbFile = tmpDb(dir);
  writeFileSync(join(dir, 'empty.env'), '# empty test env\n');
  fixturePath = join(dir, 'plaid_fixture.json');
  writeFileSync(fixturePath, JSON.stringify(defaultPlaidFixture()));
  liabilitiesCalls = 0;
  state.summary = defaultSummary();
  state.searchRows = defaultSearchRows();
  state.watchRows = [];
  state.netWorth = defaultNetWorth();
  state.starlingFeed = defaultStarlingFeed();
  state.searchRequests = [];

  starlingServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const send = (code: number, payload: unknown) => {
      const body = JSON.stringify(payload);
      res.writeHead(code, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body), // bytes, not UTF-16 units
      });
      res.end(body);
    };
    if (req.headers.authorization !== 'Bearer starling-token')
      return send(401, { error: 'bad token' });
    const url = new URL(req.url ?? '/', 'http://starling');
    if (url.pathname === '/api/v2/accounts') {
      return send(200, {
        accounts: [
          {
            accountUid: PRIMARY_UID,
            defaultCategory: 'cat-primary',
            currency: 'GBP',
            accountType: 'PRIMARY',
            name: 'Chequing',
          },
          {
            accountUid: SAVER_UID,
            defaultCategory: 'cat-saver',
            currency: 'GBP',
            accountType: 'SAVINGS',
            name: 'Saver',
          },
        ],
      });
    }
    const feed = url.pathname.match(
      /^\/api\/v2\/feed\/account\/([^/]+)\/category\/([^/]+)\/transactions-between$/,
    );
    if (feed) {
      const items = state.starlingFeed[feed[2]] ?? [];
      return send(200, { feedItems: items });
    }
    const goals = url.pathname.match(/^\/api\/v2\/account\/([^/]+)\/savings-goals$/);
    if (goals) return send(200, { savingsGoalList: [] });
    send(404, { error: 'no route' });
  });
  await new Promise<void>((resolve) => starlingServer.listen(0, '127.0.0.1', resolve));
  starlingPort = (starlingServer.address() as { port: number }).port;

  hominemServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const send = (code: number, payload: unknown, headers: Record<string, string> = {}) => {
        const body = JSON.stringify(payload);
        res.writeHead(code, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...headers,
        });
        res.end(body);
      };
      if (req.headers.authorization !== 'Bearer hmt-test')
        return send(401, { error: 'invalid_token' });
      const body = raw ? JSON.parse(raw) : {};
      if (body.method === 'initialize') {
        return send(
          200,
          {
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: '2025-06-18',
              capabilities: {},
              serverInfo: { name: 'hominem-mock', version: '0.0.0' },
            },
          },
          { 'mcp-session-id': 'sess-mock-1' },
        );
      }
      if (body.method === 'notifications/initialized') {
        res.writeHead(202);
        return res.end();
      }
      if (body.method === 'tools/call') {
        const name = body.params?.name as string;
        const args = body.params?.arguments ?? {};
        const result = (structuredContent: unknown) => ({
          jsonrpc: '2.0',
          id: body.id,
          result: { content: [{ type: 'text', text: 'ok' }], structuredContent, isError: false },
        });
        if (name === 'finance_accounts') {
          return send(
            200,
            result({ accounts: ACCOUNTS, count: ACCOUNTS.length, totalCount: ACCOUNTS.length }),
          );
        }
        if (name === 'finance_account_summary') {
          return send(
            200,
            result({
              accounts: state.summary,
              count: state.summary.length,
              totalCount: state.summary.length,
            }),
          );
        }
        if (name === 'finance_net_worth') {
          return send(
            200,
            result({ asOf: TODAY, totals: [], accounts: state.netWorth, warnings: [] }),
          );
        }
        if (name === 'finance_transaction_search') {
          state.searchRequests.push(args);
          if (args.query) {
            return send(
              200,
              result({
                transactions: state.watchRows,
                count: state.watchRows.length,
                filteredCount: state.watchRows.length,
                totalUserCount: state.watchRows.length,
              }),
            );
          }
          const from = args.from ?? '0000-00-00';
          const to = args.to ?? '9999-99-99';
          const hits = state.searchRows.filter(
            (r) => r.accountId === args.accountId && r.postedOn >= from && r.postedOn <= to,
          );
          return send(
            200,
            result({
              // One page of 50 max — the check must split wide windows.
              transactions: hits.slice(0, 50),
              count: hits.length,
              filteredCount: hits.length,
              totalUserCount: hits.length,
            }),
          );
        }
        return send(200, result({}));
      }
      send(404, { error: 'no route' });
    });
  });
  await new Promise<void>((resolve) => hominemServer.listen(0, '127.0.0.1', resolve));
  hominemPort = (hominemServer.address() as { port: number }).port;

  plaidServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const send = (code: number, payload: unknown) => {
        const body = JSON.stringify(payload);
        res.writeHead(code, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        });
        res.end(body);
      };
      const url = new URL(req.url ?? '/', 'http://plaid');
      const fx = JSON.parse(readFileSync(fixturePath, 'utf8'));
      if (url.pathname === '/accounts/get') return send(200, fx.accounts);
      if (url.pathname === '/liabilities/get') {
        liabilitiesCalls += 1;
        if (liabilitiesCalls > 1) {
          return send(400, {
            error_code: 'NO_LIABILITY_ACCOUNTS',
            error_message: 'NO_LIABILITY_ACCOUNTS: cred-fail',
          });
        }
        return send(200, fx.liabilities['cred-ok']);
      }
      if (url.pathname === '/transactions/get') {
        const body = raw ? JSON.parse(raw) : {};
        const txns = (fx.gapTransactions ?? []).filter(
          (transaction: any) =>
            transaction.date >= body.start_date && transaction.date <= body.end_date,
        );
        return send(200, {
          accounts: fx.accounts.accounts,
          transactions: txns,
          total_transactions: txns.length,
        });
      }
      send(404, { error: `no mock route for ${url.pathname}` });
    });
  });
  await new Promise<void>((resolve) => plaidServer.listen(0, '127.0.0.1', resolve));
  plaidPort = (plaidServer.address() as { port: number }).port;
});

afterEach(async () => {
  await Promise.all([
    new Promise<void>((resolve) => starlingServer.close(() => resolve())),
    new Promise<void>((resolve) => hominemServer.close(() => resolve())),
    new Promise<void>((resolve) => plaidServer.close(() => resolve())),
  ]);
  rmSync(dir, { recursive: true, force: true });
});

/** The wealth dir with its machine-local inputs, per test. */
function writeWealthDir(inputs: Record<string, unknown> = {}): string {
  const w = join(dir, 'wealth');
  const files: Record<string, unknown> = {
    'hominem_sync_state.json': { starling_max: WM, plaid_max: WM },
    'manual_anchors.json': { 'Synth IRA': 14 },
    ...inputs,
  };
  mkdirSync(w, { recursive: true });
  for (const [name, content] of Object.entries(files))
    writeFileSync(join(w, name), JSON.stringify(content, null, 1));
  return w;
}

const env = (over: Record<string, string | undefined> = {}) => {
  const e: Record<string, string | undefined> = {
    HOMINEM_AGENT_DB: dbFile,
    HOMINEM_AGENT_ENV_FILE: join(dir, 'empty.env'),
    STARLING_API_TOKEN: 'starling-token',
    STARLING_API_BASE: `http://127.0.0.1:${starlingPort}`,
    PLAID_CLIENT_ID: 'test-client',
    PLAID_SECRET: 'test-secret',
    PLAID_ACCESS_TOKEN: 'test-access',
    PLAID_ITEM_ID: 'cred-ok',
    PLAID_API_BASE: `http://127.0.0.1:${plaidPort}`,
    HOMINEM_MCP_URL: `http://127.0.0.1:${hominemPort}`,
    HOMINEM_MCP_TOKEN: 'hmt-test',
    WEALTH_SYNC_TODAY: TODAY,
    ...over,
  };
  // The caller-provided wealth dir (already written with its inputs)
  // must not be stomped by a second default write.
  if (!e.HOMINEM_AGENT_WEALTH_DIR) e.HOMINEM_AGENT_WEALTH_DIR = writeWealthDir();
  return e;
};

const run = async (e: Record<string, string | undefined> = env()) => {
  const r = await runWrapper(CHECK, e, []);
  return { status: r.status, envelope: r.stdout.trim() ? JSON.parse(r.stdout) : null, raw: r };
};

test('integrity: a quiet day — every check runs, flags empty, info populated', async () => {
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.date, TODAY);
  assert.deepEqual(envelope.flags, []);

  // feed_health saw fresh watermarks and said nothing.
  assert.deepEqual(envelope.info.watermarks, { starling_max: WM, plaid_max: WM });
  // Drift: the one routed Plaid account, zero residual.
  assert.equal(envelope.info.plaid_accounts, 1);
  assert.deepEqual(envelope.info.plaid_drift, { 'Synth Card …4242': 0 });
  // Starling window: both accounts, feed == ledger.
  assert.deepEqual(envelope.info.starling_window, {
    'Starling Chequing': { from: FROM, feed_sum: 85.5, ledger_sum: 85.5 },
    'Starling Saver': { from: FROM, feed_sum: 50, ledger_sum: 50 },
  });
  // Anchor freshness: fresh anchor, recorded.
  assert.deepEqual(envelope.info.manual_anchors, { 'Synth IRA': '2026-11-15' });
  // Statement verification: paid in full within [issue, due+3d].
  assert.deepEqual(envelope.info.statements, [
    {
      account: 'Synth Card …4242',
      statement: 150,
      issue: '2026-11-01',
      due: '2026-11-15',
      paid_in_window: 150,
    },
  ]);
  // The Wise lesson port: the liability-less institution is skipped
  // with a named note, never fatal.
  assert.equal(envelope.info.liability_cards, 1);
  assert.equal(envelope.info.liabilities_skipped.length, 1);
  assert.equal(envelope.info.liabilities_skipped[0].institution, 'SynthWise');
  assert.match(envelope.info.liabilities_skipped[0].error, /NO_LIABILITY_ACCOUNTS/);

  // Law 1: every external call landed an events row; one ok runs row.
  const ev = rows(dbFile, 'events');
  const connectors = new Set(ev.map((r) => r.connector));
  assert.ok(connectors.has('hominem-mcp'));
  assert.ok(connectors.has('starling'));
  assert.ok(connectors.has('plaid'));
  const runsRows = rows(dbFile, 'runs');
  assert.equal(runsRows.length, 1);
  assert.equal(runsRows[0].source, 'wealth-integrity');
  assert.equal(runsRows[0].status, 'ok');
});

test('integrity: stale and missing watermarks flag feed_health', async () => {
  const e = env({
    HOMINEM_AGENT_WEALTH_DIR: writeWealthDir({
      'hominem_sync_state.json': { starling_max: '2026-11-10' }, // 12 days old, plaid_max absent
    }),
  });
  const { status, envelope } = await run(e);
  assert.equal(status, 0);
  const feed = envelope.flags.filter((f: any) => f.check === 'feed_health');
  assert.equal(feed.length, 2);
  assert.match(feed[0].detail, /starling_max.*12 days old/);
  assert.equal(feed[1].account, 'plaid_max');
  assert.match(feed[1].detail, /watermark missing/);
});

test('integrity: Plaid drift flags the unexplained residual, gap window explained', async () => {
  // Ledger says -190; the feed's balance says -200 with one settled
  // outflow (+12.34 Plaid-positive) after the ledger's max date.
  // Expected ledger = -200 - (-12.34) = -187.66 → residual -2.34.
  const fx = JSON.parse(readFileSync(fixturePath, 'utf8'));
  fx.gapTransactions = [
    { account_id: 'plaid-acc-1', date: '2026-11-21', amount: 12.34, pending: false },
  ];
  state.summary[2].totals[0].sum = -190;
  writeFileSync(fixturePath, JSON.stringify(fx));
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const drift = envelope.flags.filter((f: any) => f.check === 'balance_drift');
  assert.equal(drift.length, 1);
  assert.match(drift[0].detail, /ledger sum -190\.00 USD vs feed-implied -187\.66/);
  assert.match(drift[0].detail, /feed balance -200\.00, gap window -12\.34/);
  assert.match(drift[0].detail, /unexplained residual -2\.34/);
  assert.deepEqual(envelope.info.plaid_drift, { 'Synth Card …4242': -2.34 });
});

test('integrity: a Starling window mismatch flags the account, not the world', async () => {
  // The ledger is missing the -34.50 row: feed 85.50 vs ledger 120.
  state.searchRows = state.searchRows.filter((r) => r.amount !== -34.5);
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const starling = envelope.flags.filter((f: any) => f.check === 'starling_reconciliation');
  assert.equal(starling.length, 1);
  assert.equal(starling[0].account, 'Starling Chequing');
  assert.match(
    starling[0].detail,
    /sum to 85\.50 GBP but ledger rows from Starling sum to 120\.00 GBP/,
  );
  assert.match(starling[0].detail, /difference \+34\.50/);
  // The saver account stays quiet — per-account identity, not one pool.
  assert.ok(!starling.some((f: any) => f.account === 'Starling Saver'));
});

test('integrity: a stale manual anchor flags anchor_freshness', async () => {
  state.netWorth[0].balanceAsOf = '2026-10-31'; // 22 days, threshold 14
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const anchors = envelope.flags.filter((f: any) => f.check === 'anchor_freshness');
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].account, 'Synth IRA');
  assert.match(anchors[0].detail, /22 days old \(as of 2026-10-31\)/);
  assert.match(anchors[0].detail, /balance 4200 USD may have drifted/);
});

test('integrity: cancellation watches flag post-cancellation charges and blown deadlines', async () => {
  const e = env({
    HOMINEM_AGENT_WEALTH_DIR: writeWealthDir({
      'cancellation_watches.json': [
        {
          id: 'w-1',
          merchant: 'Synth Gym Co',
          status: 'open',
          escalate_if: 'any charge after 2026-11-05; confirm cancellation by 2026-11-10',
        },
      ],
    }),
  });
  state.watchRows = [
    ledgerRow({
      amount: -29.99,
      postedOn: '2026-11-08',
      currencyCode: 'GBP',
      description: 'Synth Gym Co monthly',
    }),
  ];
  const { status, envelope } = await run(e);
  assert.equal(status, 0);
  const watches = envelope.flags.filter((f: any) => f.check === 'cancellation_watch');
  assert.equal(watches.length, 2);
  assert.match(watches[0].detail, /CHARGE POSTED after cancellation: -29\.99 GBP on 2026-11-08/);
  assert.match(watches[1].detail, /no substantive confirmation recorded by 2026-11-10/);
  // The sweep ran from the archived wide-net origin.
  const sweep = state.searchRequests.find((a) => a.query === 'Synth');
  assert.ok(sweep, 'no cancellation sweep search recorded');
  assert.equal(sweep.from, '2026-10-21');
  assert.deepEqual(envelope.info.watches, [{ id: 'w-1', status: 'open' }]);
});

test('integrity: a short statement past grace flags payment_verification', async () => {
  // Paid 100 of the 150 statement: short 50, and today (11-22) is past
  // due+grace (11-18).
  state.searchRows = state.searchRows.map((r) =>
    r.accountId === 'acc-card' ? { ...r, amount: 100 } : r,
  );
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const pay = envelope.flags.filter((f: any) => f.check === 'payment_verification');
  assert.equal(pay.length, 1);
  assert.equal(pay[0].account, 'Synth Card …4242');
  assert.match(pay[0].detail, /statement of 150\.00 issued 2026-11-01 was due 2026-11-15/);
  assert.match(pay[0].detail, /payments in \[issue, due\+3d\] sum to 100\.00 — short 50\.00/);
  assert.match(pay[0].detail, /Verify in the issuer app/);
  assert.equal(envelope.info.statements[0].paid_in_window, 100);
});

test('integrity: the window split — >50 rows reconcile through recursive date halves', async () => {
  // 60 saver rows (30 on each day) and 60 matching feed items: one page
  // can't hold the window, so the check splits [from, today] at the
  // midpoints until every half fits a page.
  state.searchRows = [
    ...state.searchRows.filter((r) => r.accountId !== 'acc-saver'),
    ...Array.from({ length: 30 }, (_, i) =>
      ledgerRow({
        id: `split-${i}`,
        accountId: 'acc-saver',
        accountName: 'Starling Saver',
        amount: 1,
        postedOn: FROM,
        transactionType: 'credit',
      }),
    ),
    ...Array.from({ length: 30 }, (_, i) =>
      ledgerRow({
        id: `split-b-${i}`,
        accountId: 'acc-saver',
        accountName: 'Starling Saver',
        amount: 1,
        postedOn: '2026-11-21',
        transactionType: 'credit',
      }),
    ),
  ];
  state.starlingFeed['cat-saver'] = [
    ...Array.from({ length: 30 }, () =>
      feedItem({
        amount: { minorUnits: 100, currency: 'GBP' },
        direction: 'IN',
        transactionTime: `${FROM}T12:00:00.000Z`,
      }),
    ),
    ...Array.from({ length: 30 }, () =>
      feedItem({
        amount: { minorUnits: 100, currency: 'GBP' },
        direction: 'IN',
        transactionTime: '2026-11-21T12:00:00.000Z',
      }),
    ),
  ];
  const { status, envelope } = await run();
  assert.equal(status, 0);
  // The split happened: narrow window halves were requested.
  const saverCalls = state.searchRequests.filter((a) => a.accountId === 'acc-saver');
  assert.ok(
    saverCalls.some((a) => a.from === FROM && a.to === FROM),
    'no single-day half window requested — the split did not run',
  );
  assert.ok(saverCalls.length >= 3, 'expected the initial wide call plus split halves');
  // And the sums still reconciled: no flag for the saver.
  assert.deepEqual(envelope.flags, []);
  assert.deepEqual(envelope.info.starling_window['Starling Saver'], {
    from: FROM,
    feed_sum: 60,
    ledger_sum: 60,
  });
});

test('integrity: unset PLAID_ACCESS_TOKEN degrades to named info notes — never fatal, never silent', async () => {
  const { status, envelope } = await run(env({ PLAID_ACCESS_TOKEN: undefined }));
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  const infoNotes = envelope.flags.filter((f: any) => f.severity === 'info');
  assert.equal(infoNotes.length, 2);
  assert.ok(infoNotes.every((f: any) => /PLAID_ACCESS_TOKEN is not set/.test(f.detail)));
  assert.deepEqual(infoNotes.map((f: any) => f.check).sort(), [
    'balance_drift',
    'payment_verification',
  ]);
  // The plaid source was never invoked — no events rows for it.
  const ev = rows(dbFile, 'events');
  assert.ok(!ev.some((r) => r.connector === 'plaid'));
  // Everything else still ran.
  assert.deepEqual(envelope.info.starling_window['Starling Chequing'].feed_sum, 85.5);
});

test('integrity: unset STARLING_API_TOKEN skips only the Starling leg', async () => {
  const { status, envelope } = await run(env({ STARLING_API_TOKEN: undefined }));
  assert.equal(status, 0);
  const infoNotes = envelope.flags.filter((f: any) => f.severity === 'info');
  assert.equal(infoNotes.length, 1);
  assert.equal(infoNotes[0].check, 'starling_reconciliation');
  assert.match(infoNotes[0].detail, /STARLING_API_TOKEN is not set/);
  const ev = rows(dbFile, 'events');
  assert.ok(!ev.some((r) => r.connector === 'starling'));
  // No starling_window info — the leg never ran.
  assert.equal(envelope.info.starling_window, undefined);
});

test('integrity: a missing backbone env fails the run by name (law 4)', async () => {
  const { status, envelope } = await run(env({ HOMINEM_MCP_TOKEN: undefined }));
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.match(envelope.error, /HOMINEM_MCP_TOKEN/);
  const runsRows = rows(dbFile, 'runs');
  assert.equal(runsRows[0].source, 'wealth-integrity');
  assert.equal(runsRows[0].status, 'failed');
});

test('integrity: a failing check is a flag, never the end of the run', async () => {
  // Starling leg fails mid-flight (server refuses after boot): the
  // flag names the failure and every other check still completes.
  await new Promise<void>((resolve) => starlingServer.close(() => resolve()));
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  const starling = envelope.flags.filter((f: any) => f.check === 'starling_reconciliation');
  assert.equal(starling.length, 1);
  assert.equal(starling[0].severity, 'flag');
  assert.match(starling[0].detail, /check failed/);
  // The Hominem-side checks all still ran and stayed quiet.
  assert.deepEqual(envelope.info.plaid_drift, { 'Synth Card …4242': 0 });
});
