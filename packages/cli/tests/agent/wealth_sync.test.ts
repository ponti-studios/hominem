/**
 * wealth-manager daily sync: mock-backend tests, synthetic-only (the
 * 2026-11-22 ruling — no personal financial data in this repo, and that
 * includes the tests). Three fake backends — an in-process Starling
 * HTTP server, an in-process Hominem MCP JSON-RPC server serving
 * synthetic accounts + doctrine, and a mock `plaid` CLI — prove the
 * ported contract end to end: windows, identity routing, doctrine
 * categorization, holdout, idempotent re-runs, loud rejections, and
 * the B15 full-row transfer link.
 */
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import {
  categorize,
  classifyRow,
  normalizeMerchant,
  tagsFor,
} from '../../src/agent/systems/wealth-manager/categorize.ts';
import {
  routeRow,
  starlingItemsToRows,
} from '../../src/agent/systems/wealth-manager/daily_sync.ts';
import type { StarlingItem } from '../../src/agent/systems/wealth-manager/starling.ts';
import type {
  HominemAccount,
  SyncDoctrine,
  SyncRow,
} from '../../src/agent/systems/wealth-manager/types.ts';
import { makeMockCli, rows, runWrapper, tmpDb } from './helpers.ts';

const SYNC = 'systems/wealth-manager/daily_sync.ts';
const TODAY = '2026-11-22';

// -- synthetic identity: bank-side UIDs and the Hominem registry --
const PRIMARY_UID = '11111111-aaaa-4bbb-8ccc-111111111111';
const SAVER_UID = '22222222-aaaa-4bbb-8ccc-222222222222';
const UNKNOWN_UID = '99999999-1111-2222-3333-444444444444';

const ACCOUNTS: HominemAccount[] = [
  {
    id: 'acc-starling',
    name: 'Starling Chequing',
    accountType: 'checking',
    currencyCode: 'GBP',
    lifecycleStatus: 'open',
    balance: 1000,
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
    balance: 500,
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
    balance: -120,
    provider: 'plaid',
    providerAccountId: null,
    accountNumber: '4242',
  },
];

// -- synthetic doctrine (finance_doctrine_get), same shape as Hominem's --
const DOCTRINE: SyncDoctrine = {
  version: 1,
  merchantRules: [
    { pattern: 'synth roasters', category: 'Food', note: 'synthetic: a restaurant' },
    { matchMode: 'exact', pattern: 'synth rail', category: 'Transport' },
    { pattern: 'synth hosting', category: 'Software & Subscriptions' },
  ],
  tagRules: [
    { pattern: 'synth roasters', tags: ['Dining Out'] },
    { pattern: 'synth rail', tags: ['Train'] },
  ],
  amountRules: [
    {
      merchant: 'synth sub',
      amountMinorUnits: [-1899, -899],
      category: 'Software & Subscriptions',
      note: 'synthetic: only known subscription prices auto-map',
    },
  ],
  transferMerchants: [
    {
      pattern: 'synthwise',
      unlessAccountContains: 'synthwise',
      note: 'synthetic: a movement out unless it sits on the SynthWise account itself',
    },
    { matchMode: 'startsWith', pattern: 'deposit from' },
  ],
  incomePatterns: [{ pattern: 'synth interest' }],
  coffeePatterns: ['grumpy beans'],
  lenses: [
    { category: 'Food', matches: [{ pattern: 'synth roasters', tag: 'Dining Out' }] },
    { category: 'Utilities', matches: [{ pattern: 'synth water', tag: 'Water' }] },
  ],
};

const feedItem = (over: Record<string, any>) => ({
  feedItemUid: 'fuid-' + Math.random().toString(36).slice(2),
  transactionTime: '2026-11-19T10:00:00.000Z',
  amount: { minorUnits: 1000, currency: 'GBP' },
  direction: 'OUT',
  status: 'SETTLED',
  source: 'MASTER_CARD',
  ...over,
});

const STARLING_FEED: Record<string, any[]> = {
  'cat-primary': [
    feedItem({
      counterPartyName: 'SYNTH ROASTERS',
      amount: { minorUnits: 3450, currency: 'GBP' },
      transactionTime: '2026-11-19T20:15:00.000Z',
    }),
    feedItem({
      counterPartyName: 'Synth Interest Payment',
      amount: { minorUnits: 500, currency: 'GBP' },
      direction: 'IN',
      transactionTime: '2026-11-20T06:00:00.000Z',
    }),
    // Routed, but no doctrine rule matches: Uncategorized, queued for a ruling.
    feedItem({
      counterPartyName: 'Total Novelty Co',
      amount: { minorUnits: 900, currency: 'GBP' },
      transactionTime: '2026-11-21T11:00:00.000Z',
    }),
    feedItem({
      counterPartyName: 'Still Pending Co',
      status: 'PENDING',
      amount: { minorUnits: 700, currency: 'GBP' },
    }),
  ],
  // The Bills Space: its leg of the account↔Space move, merchant renamed
  // to the Space name by the 2026-10-31 ruling.
  'goal-bills': [
    feedItem({
      counterPartyName: 'Starling Bank',
      amount: { minorUnits: 5000, currency: 'GBP' },
      direction: 'IN',
      source: 'INTERNAL_TRANSFER',
      transactionTime: '2026-11-18T09:00:00.000Z',
    }),
  ],
  'cat-saver': [
    feedItem({
      counterPartyName: 'Synth Saver',
      amount: { minorUnits: 1200, currency: 'GBP' },
      direction: 'IN',
      source: 'INTERNAL_TRANSFER',
      transactionTime: '2026-11-18T08:00:00.000Z',
    }),
  ],
  'cat-unknown': [
    feedItem({
      counterPartyName: 'Mystery Feed Shop',
      amount: { minorUnits: 900, currency: 'GBP' },
      transactionTime: '2026-11-20T11:00:00.000Z',
    }),
  ],
};

const PLAID_FIXTURE = {
  ok: true,
  body: {
    institutions: [{ display_name: 'Synth Bank', credential_id: 'cred-synth', read_status: 'ok' }],
    accounts: [
      {
        account_id: 'acc-a',
        name: 'Synth Card',
        mask: '4242',
        _plaid_source: { credential_id: 'cred-synth' },
      },
      {
        account_id: 'acc-c',
        name: 'Mystery Card',
        mask: '9999',
        _plaid_source: { credential_id: 'cred-synth' },
      },
    ],
    transactions: [
      // The known subscription price auto-maps via the doctrine amountRules.
      {
        account_id: 'acc-a',
        date: '2026-11-19',
        pending: false,
        merchant_name: 'Synth Sub',
        amount: 18.99,
        iso_currency_code: 'USD',
      },
      {
        account_id: 'acc-a',
        date: '2026-11-21',
        pending: false,
        merchant_name: 'Synth Hosting',
        amount: 12.0,
        iso_currency_code: 'USD',
      },
      // pending: skipped — Hominem rejects pending rows loudly (pending_row)
      {
        account_id: 'acc-a',
        date: '2026-11-21',
        pending: true,
        merchant_name: 'Still Pending Co',
        amount: 10.0,
        iso_currency_code: 'USD',
      },
      // unknown mask: no Hominem account routes …9999 -> held out, never guessed
      {
        account_id: 'acc-c',
        date: '2026-11-21',
        pending: false,
        merchant_name: 'Unknown Merchant Co',
        amount: 12.5,
        iso_currency_code: 'USD',
      },
    ],
  },
};

interface TransferLeg {
  id: string;
  accountId: string;
  accountName: string;
  amount: number;
  currencyCode: string;
  postedOn: string;
  description: string;
  categoryName: string;
  source: string;
  transactionType: string;
  excluded?: boolean;
  recurring?: boolean;
  pending?: boolean;
  counterpartId?: string | null;
  tags?: string[];
  orderNumber?: string | null;
  notes?: string | null;
}

const linkedLegs = (): TransferLeg[] => [
  {
    id: 't1',
    accountId: 'acc-starling',
    accountName: 'Starling Chequing',
    amount: -100.0,
    currencyCode: 'GBP',
    postedOn: '2026-11-19',
    description: 'Transfer to Saver',
    categoryName: 'Transfers',
    source: 'starling',
    transactionType: 'transfer',
    counterpartId: null,
    tags: ['Business'],
    orderNumber: 'X1',
    notes: 'paid by card\nOrder #: X1',
  },
  {
    id: 'o1',
    accountId: 'acc-saver',
    accountName: 'Starling Saver',
    amount: 100.0,
    currencyCode: 'GBP',
    postedOn: '2026-11-19',
    description: 'Transfer from Chequing',
    categoryName: 'Transfers',
    source: 'starling',
    transactionType: 'transfer',
    counterpartId: null,
  },
];

const ambiguousLegs = (): TransferLeg[] => [
  // Symmetric: every leg sees TWO opposite candidates, so no side has a
  // unique match — nothing links (an asymmetric 1-vs-2 pool WOULD link
  // from the many-side, same as the archived sync).
  linkedLegs()[0],
  { ...linkedLegs()[0], id: 't2', description: 'Transfer to Saver 2', postedOn: '2026-11-20' },
  { ...linkedLegs()[1], id: 'o1' },
  { ...linkedLegs()[1], id: 'o2', description: 'Transfer from Chequing 2', postedOn: '2026-11-20' },
];

let dir: string;
let dbFile: string;
let starlingServer: ReturnType<typeof createServer>;
let starlingPort: number;
let hominemServer: ReturnType<typeof createServer>;
let hominemPort: number;
let plaidCli: string;
const starlingQueries: string[] = [];
const hominem = {
  importRequests: [] as any[],
  accountRequests: [] as any[],
  doctrineRequests: 0,
  searchRequests: [] as any[],
  upsertRequests: [] as any[],
  rejectWith: null as null | string,
  searchRows: [] as TransferLeg[],
  searchError: false,
  noDoctrine: false,
  accountCap: false,
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-wealth-'));
  dbFile = tmpDb(dir);
  writeFileSync(join(dir, 'empty.env'), '# empty test env\n');
  hominem.importRequests = [];
  hominem.accountRequests = [];
  hominem.doctrineRequests = 0;
  hominem.searchRequests = [];
  hominem.upsertRequests = [];
  hominem.rejectWith = null;
  hominem.searchRows = [];
  hominem.searchError = false;
  hominem.noDoctrine = false;
  hominem.accountCap = false;
  starlingQueries.length = 0;

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
    starlingQueries.push(req.url ?? '');
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
          {
            accountUid: UNKNOWN_UID,
            defaultCategory: 'cat-unknown',
            currency: 'GBP',
            accountType: 'PRIMARY',
            name: 'Mystery',
          },
        ],
      });
    }
    const feed = url.pathname.match(
      /^\/api\/v2\/feed\/account\/([^/]+)\/category\/([^/]+)\/transactions-between$/,
    );
    if (feed) {
      const items = STARLING_FEED[feed[2]] ?? [];
      return send(200, {
        feedItems: items.map((i, n) => ({ ...i, feedItemUid: `${feed[2]}-${n}` })),
      });
    }
    const goals = url.pathname.match(/^\/api\/v2\/account\/([^/]+)\/savings-goals$/);
    if (goals) {
      const list =
        goals[1] === PRIMARY_UID
          ? [
              {
                savingsGoalUid: 'goal-bills',
                name: 'Bills',
                totalSaved: { minorUnits: 5000, currency: 'GBP' },
              },
            ]
          : [];
      return send(200, { savingsGoalList: list });
    }
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
          'Content-Length': Buffer.byteLength(body), // bytes, not UTF-16 units
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
          hominem.accountRequests.push(args);
          return send(
            200,
            result({
              accounts: ACCOUNTS,
              count: ACCOUNTS.length,
              totalCount: hominem.accountCap ? 99 : ACCOUNTS.length,
            }),
          );
        }
        if (name === 'finance_doctrine_get') {
          hominem.doctrineRequests += 1;
          return send(
            200,
            result(
              hominem.noDoctrine
                ? { fingerprint: null, updatedAt: null, doctrine: null }
                : {
                    fingerprint: 'synthetic-fingerprint',
                    updatedAt: '2026-11-01T00:00:00Z',
                    doctrine: DOCTRINE,
                  },
            ),
          );
        }
        if (name === 'finance_transactions_import') {
          hominem.importRequests.push(args);
          const n = (args.transactions ?? []).length;
          return send(
            200,
            result({
              received: n,
              upserted: n,
              created: n,
              updated: 0,
              rejected: hominem.rejectWith
                ? [{ index: 0, reason: hominem.rejectWith, key: '2026-11-19|mystery' }]
                : [],
              accountsAutoProvisioned: [],
              dryRun: false,
            }),
          );
        }
        if (name === 'finance_transaction_search') {
          hominem.searchRequests.push(args);
          if (hominem.searchError) return send(500, { error: 'search exploded' });
          const all = hominem.searchRows;
          const offset = args.offset ?? 0;
          const limit = args.limit ?? 20;
          return send(
            200,
            result({
              transactions: all.slice(offset, offset + limit),
              count: all.length,
              filteredCount: all.length,
              totalUserCount: all.length,
            }),
          );
        }
        if (name === 'finance_transaction_upsert') {
          hominem.upsertRequests.push(args);
          const leg = hominem.searchRows.find((r) => r.description === args.description);
          return send(
            200,
            result({ id: leg?.id ?? null, created: true, accountId: null, reason: null }),
          );
        }
        return send(200, result({}));
      }
      send(404, { error: 'no route' });
    });
  });
  await new Promise<void>((resolve) => hominemServer.listen(0, '127.0.0.1', resolve));
  hominemPort = (hominemServer.address() as { port: number }).port;

  plaidCli = makeMockCli(
    dir,
    'plaid-mock',
    `
const args = process.argv.slice(2);
if (args[0] !== "transactions-get") {
  process.stdout.write(JSON.stringify({ ok: false, error: "unknown command " + args[0] }));
  process.exit(1);
}
process.stdout.write(JSON.stringify(${JSON.stringify(PLAID_FIXTURE)}));
`,
  );
});

afterEach(async () => {
  await Promise.all([
    new Promise<void>((resolve) => starlingServer.close(() => resolve())),
    new Promise<void>((resolve) => hominemServer.close(() => resolve())),
  ]);
  rmSync(dir, { recursive: true, force: true });
});

const env = (over: Record<string, string | undefined> = {}) => ({
  HOMINEM_AGENT_DB: dbFile,
  HOMINEM_AGENT_ENV_FILE: join(dir, 'empty.env'),
  HOMINEM_AGENT_WEALTH_DIR: join(dir, 'wealth'),
  STARLING_API_TOKEN: 'starling-token',
  STARLING_API_BASE: `http://127.0.0.1:${starlingPort}`,
  PLAID_CLI: plaidCli,
  HOMINEM_MCP_URL: `http://127.0.0.1:${hominemPort}`,
  HOMINEM_MCP_TOKEN: 'hmt-test',
  WEALTH_SYNC_TODAY: TODAY,
  ...over,
});

const run = async (e: Record<string, string | undefined> = env()) => {
  const r = await runWrapper(SYNC, e, []);
  return { status: r.status, envelope: r.stdout.trim() ? JSON.parse(r.stdout) : null, raw: r };
};

test('wealth: missing credentials fail by name (law 4)', async () => {
  const { status, envelope } = await run(env({ STARLING_API_TOKEN: undefined }));
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.match(envelope.error, /STARLING_API_TOKEN is not set/);
});

test('wealth: unset PLAID_CLI skips the Plaid pull with a named warning', async () => {
  const { status, envelope } = await run(env({ PLAID_CLI: undefined }));
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  // Starling-only: 5 sent rows, nothing held from Plaid.
  assert.deepEqual(envelope.by_source, { 'Starling API': 5 });
  assert.deepEqual(envelope.new_labels, []);
  // The warning names the variable (law 4: no guessing, no silence).
  assert.ok(envelope.warnings.some((w: string) => w.includes('plaid source skipped: PLAID_CLI')));
  // The plaid source was never invoked — no events rows for it.
  const ev = rows(dbFile, 'events');
  assert.ok(!ev.some((r) => r.connector === 'plaid'));
  // Starling-only watermarks: plaid_max untouched (absent on fresh state).
  const state = JSON.parse(readFileSync(join(dir, 'wealth', 'hominem_sync_state.json'), 'utf8'));
  assert.equal(state.starling_max, '2026-11-21');
  assert.equal(state.plaid_max, undefined);
  // Held rows still banked (the unknown Starling account alone).
  const pending = JSON.parse(readFileSync(join(dir, 'wealth', 'pending_unmapped.json'), 'utf8'));
  assert.equal(pending.length, 1);
});

test('wealth: full mocked run routes by identity, categorizes from doctrine, holds out, banks pending', async () => {
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);

  // The registry and doctrine resolved from Hominem at runtime.
  assert.equal(hominem.accountRequests.length, 1);
  assert.equal(hominem.accountRequests[0].includeClosed, false);
  assert.equal(hominem.doctrineRequests, 1);

  // Fresh state: both windows default to today - 7 days.
  assert.deepEqual(envelope.windows, {
    starling_since: '2026-11-15',
    plaid_since: '2026-11-15',
    until: TODAY,
  });
  // 5 Starling rows (roasters, interest, novelty, bills space, saver)
  // + 2 Plaid. The unknown Starling UID and the unknown Plaid mask held.
  assert.equal(envelope.added, 7);
  assert.deepEqual(envelope.by_source, { 'Starling API': 5, Plaid: 2 });
  assert.deepEqual(envelope.held.map((h: SyncRow) => h.label).sort(), [
    'Starling 99999999',
    'Synth Bank Mystery Card …9999',
  ]);
  // Held rows carry the named reason — banked with them, never guessed.
  for (const h of envelope.held) assert.match(h.holdoutReason, /no hominem account/);
  assert.deepEqual(envelope.new_labels, ['Synth Bank Mystery Card …9999']);
  // The one routed row no doctrine rule matches queues for a ruling.
  assert.deepEqual(envelope.unmapped, [
    {
      date: '2026-11-21',
      account: 'Starling Chequing',
      description: 'Total Novelty Co',
      amount: -9,
    },
  ]);
  assert.deepEqual(envelope.warnings, []);

  // The import payload: account UUIDs from the runtime registry, natural-
  // key DTOs, no multiCurrencyAccounts (vestigial — gone from the schema).
  assert.equal(hominem.importRequests.length, 1);
  const imp = hominem.importRequests[0];
  assert.equal(imp.mode, 'append');
  assert.equal(imp.dryRun, false);
  assert.ok(!('multiCurrencyAccounts' in imp));
  const byDesc = new Map<string, any>(
    imp.transactions.map((t: any): [string, any] => [t.description, t]),
  );
  // Doctrine merchantRule + tagRule + lens: Food with the Dining Out tag.
  const roasters = byDesc.get('SYNTH ROASTERS');
  assert.equal(roasters.account, 'acc-starling');
  assert.equal(roasters.category, 'Food');
  assert.deepEqual(roasters.tags, ['Dining Out']);
  assert.equal(roasters.amountCents, -3450);
  assert.equal(roasters.source, 'starling');
  // Doctrine incomePattern on a positive amount: Income.
  assert.equal(byDesc.get('Synth Interest Payment').category, 'Income');
  // The Bills Space leg: renamed to the Space, always Transfers (2026-10-31).
  const bills = byDesc.get('Bills');
  assert.equal(bills.category, 'Transfers');
  assert.equal(bills.account, 'acc-starling');
  // The saver leg: its own account UUID and its own description.
  const saverRow = byDesc.get('Synth Saver');
  assert.equal(saverRow.account, 'acc-saver');
  assert.equal(saverRow.category, 'Transfers');
  // Doctrine amountRule: the known subscription price auto-maps, and the
  // account is the mask-routed Plaid card.
  const sub = imp.transactions.find((t: any) => t.description === 'Synth Sub');
  assert.equal(sub.account, 'acc-card');
  assert.equal(sub.category, 'Software & Subscriptions');
  assert.equal(sub.amountCents, -1899);
  assert.equal(sub.source, 'plaid');
  const hosting = byDesc.get('Synth Hosting');
  assert.equal(hosting.account, 'acc-card');
  assert.equal(hosting.category, 'Software & Subscriptions');
  // The unruly row imports with no category at all (queues for a ruling).
  const novelty = byDesc.get('Total Novelty Co');
  assert.ok(!('category' in novelty));
  // Pending rows never reach Hominem (it would reject them: pending_row).
  assert.ok(!imp.transactions.some((t: any) => t.description === 'Still Pending Co'));

  // Starling window bounds: midnight UTC, pull.py's naive-datetime coercion.
  const feedQuery = starlingQueries.find((q) => q.includes('transactions-between'));
  assert.ok(feedQuery, 'no Starling feed query was recorded');
  assert.ok(feedQuery.includes('minTransactionTimestamp=2026-11-15T00%3A00%3A00%2B00%3A00'));

  // State: watermarks advanced per source over pulled rows.
  const state = JSON.parse(readFileSync(join(dir, 'wealth', 'hominem_sync_state.json'), 'utf8'));
  assert.equal(state.starling_max, '2026-11-21');
  assert.equal(state.plaid_max, '2026-11-21');

  // Held rows banked, keyed — with their holdout reasons.
  const pending = JSON.parse(readFileSync(join(dir, 'wealth', 'pending_unmapped.json'), 'utf8'));
  assert.equal(pending.length, 2);
  for (const p of pending) assert.match(p.holdoutReason, /no hominem account/);

  // Audit (law 1): events for every external call, one runs row, closed ok.
  const ev = rows(dbFile, 'events');
  const connectors = new Set(ev.map((r) => r.connector));
  assert.ok(connectors.has('starling'));
  assert.ok(connectors.has('plaid'));
  assert.ok(connectors.has('hominem-mcp'));
  const runsRows = rows(dbFile, 'runs');
  assert.equal(runsRows.length, 1);
  assert.equal(runsRows[0].source, 'wealth-sync');
  assert.equal(runsRows[0].status, 'ok');
});

test('wealth: re-run is idempotent — overlap re-imports, state and pending unchanged', async () => {
  const first = await run();
  assert.equal(first.status, 0);
  const second = await run();
  assert.equal(second.status, 0);
  assert.equal(second.envelope.ok, true);

  // Windows anchored on the written watermarks: max - 1 day.
  assert.equal(second.envelope.windows.starling_since, '2026-11-20');
  assert.equal(second.envelope.windows.plaid_since, '2026-11-20');

  // The overlap re-sends the same rows; the server's natural-key upsert
  // makes that free (added counts again, nothing duplicates client-side).
  assert.equal(second.envelope.added, 7);
  assert.equal(hominem.importRequests.length, 2);

  // State did not regress; pending banked once, keyed — no duplicates.
  const state = JSON.parse(readFileSync(join(dir, 'wealth', 'hominem_sync_state.json'), 'utf8'));
  assert.equal(state.starling_max, '2026-11-21');
  assert.equal(state.plaid_max, '2026-11-21');
  const pending = JSON.parse(readFileSync(join(dir, 'wealth', 'pending_unmapped.json'), 'utf8'));
  assert.equal(pending.length, 2);
});

test('wealth: rejected import rows fail loudly and advance no state', async () => {
  hominem.rejectWith = 'unknown_account';
  const { status, envelope } = await run();
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.match(envelope.error, /hominem rejected rows/);
  assert.match(envelope.error, /unknown_account/);
  // No watermarks, no pending bank: the run failed before either write.
  assert.ok(!existsSync(join(dir, 'wealth', 'hominem_sync_state.json')));
  assert.ok(!existsSync(join(dir, 'wealth', 'pending_unmapped.json')));
  const runsRows = rows(dbFile, 'runs');
  assert.equal(runsRows[0].status, 'failed');
});

test('wealth: a missing doctrine warns and queues everything for rulings — never fatal', async () => {
  hominem.noDoctrine = true;
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  // The warning names the tool and the fix.
  assert.ok(
    envelope.warnings.some((w: string) => w.includes('finance_doctrine_get returned no doctrine')),
  );
  // Ingest still happens; every merchant lands Uncategorized and queues.
  assert.equal(envelope.added, 7);
  assert.equal(envelope.unmapped.length, 3);
  const imp = hominem.importRequests[0];
  // INTERNAL_TRANSFER rows are engine-level Transfers — no doctrine needed.
  const byDesc = new Map<string, any>(
    imp.transactions.map((t: any): [string, any] => [t.description, t]),
  );
  assert.equal(byDesc.get('Bills').category, 'Transfers');
  assert.equal(byDesc.get('Synth Saver').category, 'Transfers');
  // Everything else imports with no category at all (queues for a ruling).
  assert.ok(
    imp.transactions.every((t: any) => 'category' in t === false || t.category === 'Transfers'),
  );
});

test('wealth: the finance_accounts cap warns — unseen accounts are never guessed', async () => {
  hominem.accountCap = true;
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.added, 7); // the visible accounts still route
  assert.ok(
    envelope.warnings.some((w: string) => w.includes('3-account cap but totalCount is 99')),
  );
});

test('wealth: linker pairs a unique counterpart with the FULL row (B15)', async () => {
  hominem.searchRows = linkedLegs();
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.linked.length, 1);
  assert.match(envelope.linked[0], /Transfer to Saver/);
  assert.match(envelope.linked[0], /Transfer from Chequing/);

  // Search: the window widened by 3 days, paged by offset.
  assert.ok(hominem.searchRequests.length >= 1);
  assert.equal(hominem.searchRequests[0].from, '2026-11-12');
  assert.equal(hominem.searchRequests[0].to, TODAY);

  // Exactly one upsert — only the first leg of the pair (the server
  // mirrors the link) — carrying EVERY field: omitted fields reset.
  assert.equal(hominem.upsertRequests.length, 1);
  const up = hominem.upsertRequests[0];
  assert.equal(up.postedOn, '2026-11-19');
  assert.equal(up.account, 'Starling Chequing');
  assert.equal(up.description, 'Transfer to Saver');
  assert.equal(up.amountCents, -10000);
  assert.equal(up.currencyCode, 'GBP');
  assert.equal(up.source, 'starling');
  assert.equal(up.category, 'Transfers');
  assert.equal(up.transactionType, 'transfer');
  assert.equal(up.excluded, false);
  assert.equal(up.recurring, false);
  assert.equal(up.pending, false);
  assert.equal(up.counterpartId, 'o1');
  assert.deepEqual(up.tags, ['Business']);
  assert.equal(up.orderNumber, 'X1');
  // The read model's "\nOrder #: X1" suffix is stripped, not baked in.
  assert.equal(up.notes, 'paid by card');
});

test('wealth: ambiguous counterparts never link', async () => {
  hominem.searchRows = ambiguousLegs();
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.deepEqual(envelope.linked, []);
  assert.equal(hominem.upsertRequests.length, 0);
});

test('wealth: a failing link pass is never fatal', async () => {
  hominem.searchError = true;
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.linked.length, 1);
  assert.match(envelope.linked[0], /link pass skipped/);
});

test('categorize: the doctrine engine, match modes and ordering', () => {
  assert.equal(normalizeMerchant('SYNTH-ROASTERS.COM'), 'synth roasters com');
  // amountRules: only the known subscription prices auto-map.
  assert.equal(categorize('Synth Sub', -1899, DOCTRINE), 'Software & Subscriptions');
  assert.equal(categorize('Synth Sub', -899, DOCTRINE), 'Software & Subscriptions');
  assert.equal(categorize('Synth Sub', -1500, DOCTRINE), ''); // falls through, queues for a ruling
  assert.equal(categorize('Synth Sub', null, DOCTRINE), '');
  // merchantRules: contains vs exact match modes.
  assert.equal(categorize('Synth Roasters Piccadilly', -100, DOCTRINE), 'Food');
  assert.equal(categorize('Synth Rail', -100, DOCTRINE), 'Transport'); // exact
  assert.equal(categorize('A Synth Rail Ticket', -100, DOCTRINE), ''); // exact ≠ contains
  // Ordered, first-match-wins (the engine order is law, §8b).
  const ordered: SyncDoctrine = {
    ...DOCTRINE,
    merchantRules: [
      { pattern: 'synth', category: 'First' },
      { pattern: 'synth rail', category: 'Second' },
    ],
  };
  assert.equal(categorize('Synth Rail', -100, ordered), 'First');
  assert.equal(categorize('Nothing Matches', -100, DOCTRINE), '');
  // tagRules set the row; lenses add; coffee wins over other component tags.
  assert.deepEqual(tagsFor('Synth Roasters', 'Food', DOCTRINE), ['Dining Out']);
  assert.deepEqual(tagsFor('Synth Roasters Grumpy Beans', 'Food', DOCTRINE), ['Coffee']);
  assert.deepEqual(tagsFor('Synth Water', 'Utilities', DOCTRINE), ['Water']);
  assert.deepEqual(tagsFor('Anything', 'Transport', DOCTRINE), []);
});

test('classifyRow: row-class detection runs before merchant rules', () => {
  // transferMerchants default to exact match.
  assert.equal(classifyRow('SynthWise', -500, 'Synth Card …4242', DOCTRINE), 'Transfers');
  // ...but the unlessAccountContains guard keeps it honest on its own account.
  assert.equal(classifyRow('SynthWise', -500, 'SynthWise GBP …0331', DOCTRINE), '');
  // A startsWith transfer rule.
  assert.equal(classifyRow('Deposit From Someone', 5000, '', DOCTRINE), 'Transfers');
  // incomePatterns fire on positive amounts only.
  assert.equal(classifyRow('Synth Interest', 1200, '', DOCTRINE), 'Income');
  assert.equal(classifyRow('Synth Interest', -1200, '', DOCTRINE), '');
  assert.equal(classifyRow('Some Normal Shop', -1200, '', DOCTRINE), '');
});

test('routeRow: identity routing and never-guess ambiguity', () => {
  const starlingRow: SyncRow = {
    date: '2026-11-21',
    label: 'Starling 11111111',
    route: { provider: 'starling', providerAccountId: PRIMARY_UID },
    merchant: 'm',
    amount: -1,
    currency: 'GBP',
    tags: [],
    source: 'Starling API',
    orderNumber: '',
    category: '',
  };
  const routed = routeRow(starlingRow, ACCOUNTS);
  assert.equal(routed.ok, true);
  assert.equal(routed.account?.id, 'acc-starling');
  const unknown = routeRow(
    { ...starlingRow, route: { provider: 'starling', providerAccountId: UNKNOWN_UID } },
    ACCOUNTS,
  );
  assert.equal(unknown.ok, false);
  assert.match(unknown.reason ?? '', /provider_account_id/);
  // A mask two accounts share is ambiguous — held out, never guessed.
  const dup: HominemAccount[] = [
    ACCOUNTS[2],
    { ...ACCOUNTS[2], id: 'acc-card-2', name: 'Synth Card Too …4242' },
  ];
  const maskRow: SyncRow = {
    ...starlingRow,
    route: { provider: 'plaid', mask: '4242' },
  };
  const ambiguous = routeRow(maskRow, dup);
  assert.equal(ambiguous.ok, false);
  assert.match(ambiguous.reason ?? '', /ambiguous mask 4242/);
  const single = routeRow(maskRow, ACCOUNTS);
  assert.equal(single.ok, true);
  assert.equal(single.account?.id, 'acc-card');
});

test('starlingItemsToRows: routing identity, the Space ruling, and never-guess holdout', () => {
  const items: StarlingItem[] = [
    {
      feedItemUid: 'a',
      date: '2026-11-18',
      merchant: 'Starling Bank',
      amount: 50,
      currency: 'GBP',
      direction: 'IN',
      status: 'PENDING',
      reference: null,
      accountUid: PRIMARY_UID,
      src: 'INTERNAL_TRANSFER',
      space: 'Bills',
    },
    {
      feedItemUid: 'b',
      date: '2026-11-18',
      merchant: 'Starling Bank',
      amount: 50,
      currency: 'GBP',
      direction: 'IN',
      status: 'SETTLED',
      reference: null,
      accountUid: PRIMARY_UID,
      src: 'INTERNAL_TRANSFER',
      space: 'Bills',
    },
    {
      feedItemUid: 'c',
      date: '2026-11-18',
      merchant: 'Whatever',
      amount: 12,
      currency: 'GBP',
      direction: 'IN',
      status: 'SETTLED',
      reference: null,
      accountUid: SAVER_UID,
      src: 'INTERNAL_TRANSFER',
      space: null,
    },
    {
      feedItemUid: 'd',
      date: '2026-11-20',
      merchant: 'MYSTERY SHOP',
      amount: -9,
      currency: 'GBP',
      direction: 'OUT',
      status: 'SETTLED',
      reference: null,
      accountUid: UNKNOWN_UID,
      src: 'MASTER_CARD',
      space: null,
    },
  ];
  const rowsOut = starlingItemsToRows(items, DOCTRINE);
  assert.equal(rowsOut.length, 3); // PENDING never becomes a row
  const bills = rowsOut[0];
  // 2026-10-31: a Space move is always a Transfer, named after the Space.
  assert.equal(bills.category, 'Transfers');
  assert.equal(bills.merchant, 'Bills');
  // The route identity is the bank-side UID; the label is provisional
  // until daily_sync routes it against Hominem's registry.
  assert.equal(bills.route?.provider, 'starling');
  assert.deepEqual(bills.route, { provider: 'starling', providerAccountId: PRIMARY_UID });
  assert.equal(bills.label, 'Starling 11111111');
  // The saver account keeps its own identity.
  assert.deepEqual(rowsOut[1].route, { provider: 'starling', providerAccountId: SAVER_UID });
  assert.equal(rowsOut[1].category, 'Transfers');
  // Unknown UID: a provisional label no account will match — held out
  // downstream, never guessed.
  assert.equal(rowsOut[2].label, 'Starling 99999999');
  assert.equal(rowsOut[2].category, '');
});
