/**
 * wealth-manager Layer 2 (morning brief): mock-backend tests,
 * synthetic-only (2026-11-22 ruling — no personal financial data in
 * this repo, fixtures included). One fake backend this time — the
 * brief reads Hominem only (Plaid ingest-only, verbatim): an
 * in-process Hominem MCP JSON-RPC server serving
 * finance_transaction_search (fuzzy query + paging, the real report's
 * spent semantics), finance_spending_by_category,
 * finance_budget_list and finance_bill_list. Proves: the money
 * in/out math (per currency, Income as in, Transfers/Adjustment
 * excluded, large items), month-anchored budget pacing that
 * reconciles to the category report by construction, server breaches
 * surfacing for non-monthly cadences, the WYA-271 disjoint priority
 * composition, all four anomaly rules, the 8-merchant history cap,
 * the bills snapshot diff (new / inactive / amount change / overdue
 * with its grace + created-on guards / due_soon), the baseline and
 * no-write snapshot modes, bills-only, the truncation note, and the
 * law-4 named-backbone failure. Law 1: every MCP call lands an
 * events row.
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { rows, runWrapper, tmpDb } from './helpers.ts';

const BRIEF = 'systems/wealth-manager/morning_brief.ts';
const TODAY = '2026-11-22';
const YESTERDAY = '2026-11-21';
const MONTH_START = '2026-11-01';
// Pacing constants for yesterday 2026-11-21: day 21 of a 30-day month.

const ledgerRow = (over: Record<string, any>) => ({
  id: 'r-' + Math.random().toString(36).slice(2),
  accountId: 'acc-1',
  accountName: 'Synth Chequing',
  postedOn: YESTERDAY,
  description: 'synth row',
  merchantName: null,
  amount: -1,
  currencyCode: 'GBP',
  transactionType: 'debit',
  categoryId: 'cat-food',
  categoryName: 'Food',
  tags: [] as string[],
  notes: null,
  orderNumber: null,
  source: 'starling',
  recurring: false,
  pending: false,
  excluded: false,
  counterpartId: null,
  ...over,
});

const defaultRows = () => [
  ledgerRow({
    description: 'Synth Roasters coffee',
    merchantName: 'Synth Roasters',
    amount: -4.5,
    tags: ['Coffee'],
  }),
  ledgerRow({
    description: 'Synth Salary Co pay',
    merchantName: 'Synth Salary Co',
    amount: 45,
    transactionType: 'credit',
    categoryId: 'cat-income',
    categoryName: 'Income',
  }),
  // Money plumbing: excluded from the in/out math by category. The
  // archived anomaly rules filter on `excluded` only — and the sync
  // writes transfers as excluded=false — so this recurring Space move
  // carries October history to stay quiet on the anomaly side too.
  ledgerRow({
    description: 'Synth Savings Space move',
    merchantName: 'Synth Savings Space',
    amount: -100,
    transactionType: 'transfer',
    categoryId: 'cat-transfers',
    categoryName: 'Transfers',
  }),
  // 90-day history for the three merchants above.
  ...Array.from({ length: 4 }, (_, i) =>
    ledgerRow({
      description: 'Synth Roasters coffee',
      merchantName: 'Synth Roasters',
      amount: -4.5,
      postedOn: `2026-10-0${i + 1}`,
      tags: ['Coffee'],
    }),
  ),
  ...Array.from({ length: 3 }, (_, i) =>
    ledgerRow({
      description: 'Synth Salary Co pay',
      merchantName: 'Synth Salary Co',
      amount: 45,
      postedOn: `2026-10-1${i}`,
      transactionType: 'credit',
      categoryId: 'cat-income',
      categoryName: 'Income',
    }),
  ),
  ...Array.from({ length: 3 }, (_, i) =>
    ledgerRow({
      description: 'Synth Savings Space move',
      merchantName: 'Synth Savings Space',
      amount: -100,
      postedOn: `2026-10-0${i + 1}`,
      transactionType: 'transfer',
      categoryId: 'cat-transfers',
      categoryName: 'Transfers',
    }),
  ),
];

const defaultBudgets = (): {
  primaryCurrency: string | null;
  warning: string | null;
  breaches: any[];
  storedBudgets: any[];
} => ({
  primaryCurrency: 'GBP',
  warning: null,
  breaches: [] as any[],
  storedBudgets: [
    {
      id: 'bud-food',
      categoryId: 'cat-food',
      categoryName: 'Food',
      tagId: null,
      tagName: null,
      amountCents: 40000,
      cadence: 'monthly',
    },
    {
      id: 'bud-coffee',
      categoryId: 'cat-food',
      categoryName: 'Food',
      tagId: 'tag-coffee',
      tagName: 'Coffee',
      amountCents: 3000,
      cadence: 'monthly',
    },
    {
      id: 'bud-dining',
      categoryId: 'cat-food',
      categoryName: 'Food',
      tagId: 'tag-dining',
      tagName: 'Dining Out',
      amountCents: 4000,
      cadence: 'monthly',
    },
    {
      id: 'bud-groceries',
      categoryId: 'cat-food',
      categoryName: 'Food',
      tagId: 'tag-groceries',
      tagName: 'Groceries',
      amountCents: 10000,
      cadence: 'monthly',
    },
    {
      id: 'bud-travel',
      categoryId: 'cat-travel',
      categoryName: 'Synth Travel',
      tagId: null,
      tagName: null,
      amountCents: 100000,
      cadence: 'annual',
    },
  ],
});

const billRow = (over: Record<string, any>) => ({
  id: 'bill-' + Math.random().toString(36).slice(2, 8),
  name: 'Synth Bill',
  providerName: 'Synth Utilities',
  kind: 'utility',
  amountModel: 'fixed',
  expectedAmountCents: 5000,
  currencyCode: 'GBP',
  cadence: 'monthly',
  dueDay: 5,
  status: 'active',
  type: 'confirmed',
  isDismissed: false,
  merchantMatch: ['Synth Utilities'],
  nextDueDate: '2026-12-05',
  lastPaid: { transactionId: 'tx-1', postedOn: '2026-11-05', amount: 50, currencyCode: 'GBP' },
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

let dir: string;
let dbFile: string;
let server: ReturnType<typeof createServer>;
let port: number;
const state = {
  searchRows: defaultRows(),
  budgets: defaultBudgets(),
  bills: [] as any[],
  searchRequests: [] as any[],
  failQueries: [] as string[],
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-brief-'));
  dbFile = tmpDb(dir);
  writeFileSync(join(dir, 'empty.env'), '# empty test env\n');
  state.searchRows = defaultRows();
  state.budgets = defaultBudgets();
  // Every default bill has a matched payment for the due date that
  // just passed, so a clean diffed run stays silent. The bills-diff
  // test breaks this on purpose (bill-5's payment goes missing).
  state.bills = [
    billRow({ id: 'bill-1', name: 'Synth Leccy' }),
    billRow({
      id: 'bill-2',
      name: 'Synth Streams',
      providerName: 'Synth Streams',
      merchantMatch: ['Synth Streams'],
      nextDueDate: '2026-12-10',
      // Last due date was 2026-11-10; the 11-05 factory default would
      // fall outside its grace window and read as overdue.
      lastPaid: { transactionId: 'tx-2', postedOn: '2026-11-10', amount: 50, currencyCode: 'GBP' },
    }),
    billRow({
      id: 'bill-5',
      name: 'Synth Broadband',
      providerName: 'Synth Broadband',
      merchantMatch: ['Synth Broadband'],
      nextDueDate: '2026-12-05',
    }),
  ];
  state.searchRequests = [];
  state.failQueries = [];

  server = createServer((req: IncomingMessage, res: ServerResponse) => {
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
        if (name === 'finance_transaction_search') {
          state.searchRequests.push(args);
          // Injected failures: any query containing a failQueries entry
          // 500s, exercising the named history source-error path.
          const fail = args.query
            ? state.failQueries.find((q) => String(args.query).toLowerCase().includes(q))
            : undefined;
          if (fail) return send(500, { error: `mock injected failure: ${fail}` });
          let hits = state.searchRows;
          if (args.accountId) hits = hits.filter((r) => r.accountId === args.accountId);
          if (args.categoryName)
            hits = hits.filter(
              (r) =>
                (r.categoryName ?? '').toLowerCase() === String(args.categoryName).toLowerCase(),
            );
          if (args.transactionType)
            hits = hits.filter((r) => r.transactionType === args.transactionType);
          if (args.from) hits = hits.filter((r) => r.postedOn >= args.from);
          if (args.to) hits = hits.filter((r) => r.postedOn <= args.to);
          if (args.query)
            hits = hits.filter((r) =>
              `${r.description ?? ''} ${r.merchantName ?? ''} ${r.categoryName ?? ''} ${r.accountName ?? ''}`
                .toLowerCase()
                .includes(String(args.query).toLowerCase()),
            );
          const offset = args.offset ?? 0;
          const limit = args.limit ?? 20;
          const page = hits.slice(offset, offset + limit);
          return send(
            200,
            result({
              transactions: page,
              count: page.length,
              filteredCount: hits.length,
              totalUserCount: state.searchRows.length,
            }),
          );
        }
        if (name === 'finance_spending_by_category') {
          // The real report: abs sum of negative, non-excluded,
          // non-transfer, non-pending rows per (category, currency).
          const from = args.from ?? MONTH_START;
          const to = args.to ?? YESTERDAY;
          const spendRows = state.searchRows.filter(
            (r) =>
              r.postedOn >= from &&
              r.postedOn <= to &&
              !r.pending &&
              !r.excluded &&
              r.amount < 0 &&
              r.transactionType !== 'transfer',
          );
          const byCat = new Map<string, any>();
          for (const r of spendRows) {
            const key = `${r.categoryId}|${r.categoryName}|${r.currencyCode}`;
            let entry = byCat.get(key);
            if (!entry) {
              entry = {
                categoryId: r.categoryId,
                categoryName: r.categoryName,
                currencyCode: r.currencyCode,
                spent: 0,
                transactionCount: 0,
              };
              byCat.set(key, entry);
            }
            entry.spent += Math.abs(r.amount);
            entry.transactionCount += 1;
          }
          const categories = [...byCat.values()].sort((a, b) => b.spent - a.spent);
          return send(
            200,
            result({
              from,
              to,
              currencyCode: null,
              truncated: false,
              categories: categories.slice(0, args.limit ?? 20),
              warnings: [],
            }),
          );
        }
        if (name === 'finance_budget_list') {
          return send(
            200,
            result({
              primaryCurrency: state.budgets.primaryCurrency,
              budgets: [],
              breaches: state.budgets.breaches,
              count: state.budgets.storedBudgets.length,
              warning: state.budgets.warning,
              storedBudgets: state.budgets.storedBudgets,
            }),
          );
        }
        if (name === 'finance_bill_list') {
          return send(200, result({ bills: state.bills, count: state.bills.length }));
        }
        return send(200, result({}));
      }
      send(404, { error: 'no route' });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

/** The wealth dir; tests seed the bills snapshot by running once. */
function writeWealthDir(): string {
  const w = join(dir, 'wealth');
  mkdirSync(w, { recursive: true });
  return w;
}

const env = (over: Record<string, string | undefined> = {}) => ({
  HOMINEM_AGENT_DB: dbFile,
  HOMINEM_AGENT_ENV_FILE: join(dir, 'empty.env'),
  HOMINEM_AGENT_WEALTH_DIR: writeWealthDir(),
  HOMINEM_MCP_URL: `http://127.0.0.1:${port}`,
  HOMINEM_MCP_TOKEN: 'hmt-test',
  WEALTH_SYNC_TODAY: TODAY,
  ...over,
});

const run = async (e: Record<string, string | undefined> = env()) => {
  const r = await runWrapper(BRIEF, e, []);
  return { status: r.status, envelope: r.stdout.trim() ? JSON.parse(r.stdout) : null, raw: r };
};

test('brief: a quiet day is silent — every section calm, law 1 rows written', async () => {
  // Baseline the bills snapshot first so the diff is empty.
  await run();
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.silent, true);

  // money_in_out: GBP in 45 (income), out 4.5, the transfer excluded.
  assert.deepEqual(envelope.sections.money_in_out, {
    per_currency: { GBP: { in: 45, out: 4.5, net: 40.5, count: 2 } },
    large_items: [],
  });
  // No anomalies, no pacing entries.
  assert.equal(envelope.sections.anomalies, undefined);
  assert.equal(envelope.sections.budget_pacing, undefined);
  // Bills: three active, diffed clean against the snapshot.
  assert.equal(envelope.sections.bills.flags, undefined);
  assert.equal(envelope.sections.bills.active_bills, 3);
  assert.equal(envelope.sections.bills.previous_bills, 3);
  assert.deepEqual(envelope.sections.bills.due_soon, []);
  // Call budget: yesterday + budgets + spending + tag composition +
  // 3 histories (roasters, salary, savings space) + bills = 8.
  assert.equal(envelope.sections.diagnostics.hominem_calls, 8);
  assert.deepEqual(envelope.sections.diagnostics.source_errors, undefined);

  // Law 1: every MCP call landed an events row; one ok runs row.
  const ev = rows(dbFile, 'events');
  assert.ok(ev.length > 0);
  assert.ok(ev.every((r) => r.connector === 'hominem-mcp'));
  const runsRows = rows(dbFile, 'runs');
  assert.equal(runsRows.length, 2); // the baseline run + this one
  assert.equal(runsRows[0].source, 'wealth-brief');
  assert.equal(runsRows[0].status, 'ok');
});

test('brief: money_in_out never blends currencies, counts Income as in, names large items', async () => {
  state.searchRows = [
    // Recurring salary: 3 prior pays, today's matches — no anomaly noise.
    ledgerRow({
      description: 'Synth Salary Co pay',
      merchantName: 'Synth Salary Co',
      amount: 1200,
      transactionType: 'credit',
      categoryId: 'cat-income',
      categoryName: 'Income',
    }),
    ...Array.from({ length: 3 }, (_, i) =>
      ledgerRow({
        description: 'Synth Salary Co pay',
        merchantName: 'Synth Salary Co',
        amount: 1200,
        postedOn: `2026-10-1${i}`,
        transactionType: 'credit',
        categoryId: 'cat-income',
        categoryName: 'Income',
      }),
    ),
    ledgerRow({
      description: 'Synth USD Market',
      merchantName: 'Synth USD Market',
      amount: -60,
      currencyCode: 'USD',
      categoryId: 'cat-usd',
      categoryName: 'USD Shopping',
    }),
    // Both plumbing rows are excluded from the math.
    ledgerRow({
      description: 'internal move',
      amount: -100,
      transactionType: 'transfer',
      categoryId: 'cat-transfers',
      categoryName: 'Transfers',
    }),
    ledgerRow({
      description: 'balance plug',
      amount: 3.33,
      transactionType: 'adjustment',
      categoryId: 'cat-adj',
      categoryName: 'Adjustment',
    }),
  ];
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.deepEqual(envelope.sections.money_in_out.per_currency, {
    GBP: { in: 1200, out: 0, net: 1200, count: 1 },
    USD: { in: 0, out: 60, net: -60, count: 1 },
  });
  assert.deepEqual(
    envelope.sections.money_in_out.large_items.map((i: any) => [i.merchant, i.amount, i.currency]),
    [
      ['Synth Salary Co', 1200, 'GBP'],
      ['Synth USD Market', -60, 'USD'],
    ],
  );
  assert.equal(envelope.silent, false);
});

test("brief: budget pacing projects yesterday's month and reconciles to the report by construction", async () => {
  // Food MTD 350 (month rows): projected 350/21*30 = 500 > 400.
  state.searchRows = [
    ...defaultRows(),
    ledgerRow({
      description: 'Synth Market big shop',
      merchantName: 'Synth Market',
      amount: -300,
      postedOn: '2026-11-05',
      categoryId: 'cat-food',
      categoryName: 'Food',
      tags: ['Groceries'],
    }),
    ledgerRow({
      description: 'Synth Market top up',
      merchantName: 'Synth Market',
      amount: -50,
      postedOn: '2026-11-06',
      categoryId: 'cat-food',
      categoryName: 'Food',
      tags: ['Groceries'],
    }),
  ];
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const pacing = envelope.sections.budget_pacing;
  assert.equal(pacing.length, 1);
  const food = pacing[0];
  assert.equal(food.category, 'Food');
  assert.equal(food.month_to_date, 354.5); // 350 month + 4.5 yesterday
  assert.equal(food.expected_by_now, 280); // 400 * 21/30
  assert.equal(food.projected_month_end, 506.43); // 354.5/21*30
  assert.equal(food.month, '2026-11');
  assert.equal(food.reason, 'projected month-end exceeds budget');
  // The reconciliation itself: MTD equals the category report's figure.
  const reportCall = state.searchRequests.find((a) => a.from === MONTH_START && a.to === YESTERDAY);
  assert.ok(reportCall, 'no spending report call for the month window');
  assert.equal(envelope.sections.diagnostics.pacing_all.Food.month_to_date, food.month_to_date);
});

test('brief: server breaches surface for non-monthly cadences and quiet monthly budgets', async () => {
  state.budgets.breaches = [
    { categoryId: 'cat-travel', categoryName: 'Synth Travel', overByCents: 5000 },
    { categoryId: 'cat-food', categoryName: 'Food', overByCents: 1000 },
  ];
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const pacing = envelope.sections.budget_pacing;
  assert.equal(pacing.length, 2);
  const travel = pacing.find((e: any) => e.category === 'Synth Travel');
  assert.equal(travel.reason, 'over budget — hominem reports over by 50.00');
  assert.equal(travel.over_budget, true);
  assert.equal(travel.projected_month_end, undefined); // annual: no month math
  // Food is quiet on pacing (MTD 4.5) but the server breach still
  // earns its entry, marked and named.
  const food = pacing.find((e: any) => e.category === 'Food');
  assert.equal(food.reason, 'over budget — hominem reports over by 10.00');
  assert.equal(food.over_budget, true);
});

test('brief: WYA-271 composition is disjoint by priority and never breaches on its own', async () => {
  // Coffee wins the doubly-tagged row; Groceries rides its own tag.
  state.searchRows = [
    ...Array.from({ length: 3 }, (_, i) =>
      ledgerRow({
        description: 'Synth Salary Co pay',
        merchantName: 'Synth Salary Co',
        amount: 45,
        postedOn: `2026-10-1${i}`,
        transactionType: 'credit',
        categoryId: 'cat-income',
        categoryName: 'Income',
      }),
    ),
    ledgerRow({
      description: 'Synth Cafe',
      merchantName: 'Synth Cafe',
      amount: -25,
      postedOn: '2026-11-05',
      categoryId: 'cat-food',
      categoryName: 'Food',
      tags: ['Coffee'],
    }),
    // Carries Coffee AND Dining Out — Coffee takes it, once.
    ledgerRow({
      description: 'Synth Cafe brunch',
      merchantName: 'Synth Cafe',
      amount: -35,
      postedOn: '2026-11-06',
      categoryId: 'cat-food',
      categoryName: 'Food',
      tags: ['Coffee', 'Dining Out'],
    }),
    ledgerRow({
      description: 'Synth Market shop',
      merchantName: 'Synth Market',
      amount: -60,
      postedOn: '2026-11-07',
      categoryId: 'cat-food',
      categoryName: 'Food',
      tags: ['Groceries'],
    }),
  ];
  const { status, envelope } = await run();
  assert.equal(status, 0);
  // No pacing entry: projected 120/21*30 = 171.43 <= 400.
  assert.equal(envelope.sections.budget_pacing, undefined);
  const food = envelope.sections.diagnostics.pacing_all.Food;
  assert.deepEqual(food.components, {
    Coffee: { budget: 30, month_to_date: 60, over_tag_budget: true },
    'Dining Out': { budget: 40, month_to_date: 0, over_tag_budget: false },
    Groceries: { budget: 100, month_to_date: 60, over_tag_budget: false },
  });
  assert.equal(
    food.mix_note,
    'mix is lopsided: Coffee over their tag budgets — composition only, not a breach (Food is within budget)',
  );
});

test('brief: anomalies — duplicates, FX by token and by currency, first-seen over threshold', async () => {
  state.searchRows = [
    ledgerRow({
      description: 'Synth Dup Co sub',
      merchantName: 'Synth Dup Co',
      amount: -9.99,
    }),
    ledgerRow({
      description: 'Synth Dup Co sub',
      merchantName: 'Synth Dup Co',
      amount: -9.99,
    }),
    ledgerRow({
      description: 'Synth Card Net non-sterling fee',
      merchantName: 'Synth Card Net',
      amount: -1.2,
    }),
    ledgerRow({
      description: 'Synth Eu Market',
      merchantName: 'Synth Eu Market',
      amount: -5,
      currencyCode: 'EUR',
      categoryId: 'cat-eu',
      categoryName: 'EU Shopping',
    }),
    ledgerRow({
      description: 'Synth New Gym joining',
      merchantName: 'Synth New Gym',
      amount: -60,
      categoryId: 'cat-health',
      categoryName: 'Health',
    }),
  ];
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const flags = envelope.sections.anomalies;
  const types = flags.map((f: any) => f.type).sort();
  assert.deepEqual(types, ['duplicate_charge', 'first_seen_merchant', 'fx_charge', 'fx_charge']);
  const dup = flags.find((f: any) => f.type === 'duplicate_charge');
  assert.equal(dup.merchant, 'Synth Dup Co');
  assert.equal(dup.count, 2);
  assert.match(dup.detail, /2 identical charges on 2026-11-21/);
  const fx = flags.filter((f: any) => f.type === 'fx_charge');
  assert.match(fx[0].detail, /non-sterling/);
  assert.match(fx[1].detail, /non-GBP\/USD currency EUR/);
  const firstSeen = flags.find((f: any) => f.type === 'first_seen_merchant');
  assert.equal(firstSeen.merchant, 'Synth New Gym');
  assert.match(firstSeen.detail, /no occurrence in prior 90 days/);
});

test('brief: amount anomalies — the 2x rule when MAD is zero, the robust z-score when it is not', async () => {
  const roastersHistory = (amounts: number[]) =>
    amounts.map((amount, i) =>
      ledgerRow({
        description: 'Synth Roasters coffee',
        merchantName: 'Synth Roasters',
        amount: -amount,
        postedOn: `2026-10-0${i + 1}`,
        categoryId: 'cat-food',
        categoryName: 'Food',
        tags: ['Coffee'],
      }),
    );
  state.searchRows = [
    ...roastersHistory([4.5, 4.5, 4.5, 4.5]),
    // 15 > 2x median 9 — MAD is 0, so only the 2x rule applies.
    ledgerRow({
      description: 'Synth Roasters big order',
      merchantName: 'Synth Roasters',
      amount: -15,
      tags: ['Coffee'],
    }),
    ...Array.from({ length: 4 }, (_, i) =>
      ledgerRow({
        description: 'Synth Utility Co bill',
        merchantName: 'Synth Utility Co',
        amount: -[4.5, 4.5, 5, 5.5][i],
        postedOn: `2026-10-0${i + 1}`,
        categoryId: 'cat-bills',
        categoryName: 'Bills',
      }),
    ),
    // median 4.75, MAD 0.25 → threshold 5.86: 5.90 trips, 5.60 stays quiet.
    ledgerRow({
      description: 'Synth Utility Co bill',
      merchantName: 'Synth Utility Co',
      amount: -5.9,
      categoryId: 'cat-bills',
      categoryName: 'Bills',
    }),
    ledgerRow({
      description: 'Synth Control Co bill',
      merchantName: 'Synth Control Co',
      amount: -5.6,
      categoryId: 'cat-bills',
      categoryName: 'Bills',
    }),
    ...Array.from({ length: 3 }, (_, i) =>
      ledgerRow({
        description: 'Synth Salary Co pay',
        merchantName: 'Synth Salary Co',
        amount: 45,
        postedOn: `2026-10-1${i}`,
        transactionType: 'credit',
        categoryId: 'cat-income',
        categoryName: 'Income',
      }),
    ),
    ledgerRow({
      description: 'Synth Salary Co pay',
      merchantName: 'Synth Salary Co',
      amount: 45,
      transactionType: 'credit',
      categoryId: 'cat-income',
      categoryName: 'Income',
    }),
  ];
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const anomalies = envelope.sections.anomalies.filter((f: any) => f.type === 'amount_anomaly');
  assert.equal(anomalies.length, 2);
  const roasters = anomalies.find((f: any) => f.merchant === 'Synth Roasters');
  assert.match(roasters.detail, /median 4\.50, MAD 0\.00/);
  assert.match(roasters.detail, /today 15\.00 breaches 2x median/);
  const utility = anomalies.find((f: any) => f.merchant === 'Synth Utility Co');
  assert.match(utility.detail, /median 4\.75, MAD 0\.25/);
  assert.match(utility.detail, /today 5\.90 breaches median\+3\*MAD/);
  // The control stays quiet.
  assert.ok(!anomalies.some((f: any) => f.merchant === 'Synth Control Co'));
});

test('brief: merchant history is capped at 8 calls per run', async () => {
  state.searchRows = Array.from({ length: 10 }, (_, i) =>
    ledgerRow({
      description: `Synth Merchant ${i} small`,
      merchantName: `Synth Merchant ${i}`,
      amount: -1,
      categoryId: 'cat-misc',
      categoryName: 'Misc',
    }),
  );
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const historyCalls = state.searchRequests.filter((a) => a.query);
  assert.equal(historyCalls.length, 8);
  assert.ok(historyCalls.every((a) => a.limit === 50));
  // yesterday + budgets + spending + tag composition (Food, 0 rows) +
  // 8 history + bills = 13 calls.
  assert.equal(envelope.sections.diagnostics.hominem_calls, 13);
});

test('brief: bills diff — new, gone inactive, amount change, overdue with guards, due_soon', async () => {
  // Baseline with a gym bill that will vanish: it must flag inactive.
  state.bills.push(
    billRow({
      id: 'bill-7',
      name: 'Synth Gym',
      providerName: 'Synth Gym',
      merchantMatch: ['Synth Gym'],
      nextDueDate: '2026-12-01',
    }),
  );
  await run();
  // Mutate: bill-2 rises 50 → 70 (still paid on time); the gym bill
  // vanishes; broadband's matched payment goes missing; a water bill
  // appears; a wifi bill due the day after tomorrow appears — its
  // previous due date (10-24) predates its registration, so the
  // created-on guard must keep it quiet.
  state.bills = [
    billRow({ id: 'bill-1', name: 'Synth Leccy' }),
    billRow({
      id: 'bill-2',
      name: 'Synth Streams',
      providerName: 'Synth Streams',
      merchantMatch: ['Synth Streams'],
      expectedAmountCents: 7000,
      nextDueDate: '2026-12-10',
      lastPaid: { transactionId: 'tx-2', postedOn: '2026-11-10', amount: 50, currencyCode: 'GBP' },
    }),
    billRow({ id: 'bill-3', name: 'Synth Water', providerName: 'Synth Water' }),
    billRow({
      id: 'bill-5',
      name: 'Synth Broadband',
      providerName: 'Synth Broadband',
      merchantMatch: ['Synth Broadband'],
      nextDueDate: '2026-12-05',
      lastPaid: null,
    }),
    billRow({
      id: 'bill-6',
      name: 'Synth Wifi',
      providerName: 'Synth Wifi',
      merchantMatch: ['Synth Wifi'],
      nextDueDate: '2026-11-24',
      createdAt: '2026-11-20T00:00:00Z',
    }),
  ];
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const flags = envelope.sections.bills.flags;
  const types = flags.map((f: any) => f.type).sort();
  assert.deepEqual(types, [
    'bill_amount_change',
    'bill_inactive',
    'bill_overdue',
    'new_bill',
    'new_bill',
  ]);
  // Archived flag keys: `bill` + `provider`, not `merchant`.
  const over = flags.find((f: any) => f.type === 'bill_overdue');
  assert.equal(over.bill, 'Synth Broadband');
  assert.equal(over.provider, 'Synth Broadband');
  assert.equal(over.due_date, '2026-11-05');
  assert.equal(over.last_paid_on, null);
  assert.match(over.detail, /due 2026-11-05; no matched payment on or after 2026-11-02/);
  // bill-1's due date also just passed (11-05) but it WAS paid, and
  // the wifi bill's passed due date predates its registration — both
  // stay quiet, so exactly one overdue flag.
  assert.equal(flags.filter((f: any) => f.type === 'bill_overdue').length, 1);
  const change = flags.find((f: any) => f.type === 'bill_amount_change');
  assert.equal(change.bill, 'Synth Streams');
  assert.equal(change.previous_amount, 50);
  assert.equal(change.amount, 70);
  assert.match(change.detail, /expected amount changed 50\.00 -> 70\.00/);
  const inactive = flags.find((f: any) => f.type === 'bill_inactive');
  assert.equal(inactive.bill, 'Synth Gym');
  assert.match(inactive.detail, /was active in previous snapshot, now missing/);
  assert.deepEqual(
    flags
      .filter((f: any) => f.type === 'new_bill')
      .map((f: any) => f.bill)
      .sort(),
    ['Synth Water', 'Synth Wifi'],
  );
  // due_soon rides along, never a flag.
  assert.deepEqual(
    envelope.sections.bills.due_soon.map((d: any) => [d.bill, d.date]),
    [['Synth Wifi', '2026-11-24']],
  );
});

test('brief: first bills run writes the baseline, no flags', async () => {
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.sections.bills.baseline_created, true);
  assert.equal(envelope.sections.bills.active_bills, 3);
  assert.equal(envelope.sections.bills.flags, undefined);
  const snap = JSON.parse(readFileSync(join(dir, 'wealth', 'morning_brief_bills.json'), 'utf8'));
  assert.equal(snap.bills.length, 3);
  assert.deepEqual(snap.bills.map((b: any) => b.id).sort(), ['bill-1', 'bill-2', 'bill-5']);
});

test('brief: WEALTH_BRIEF_NO_WRITE_SNAPSHOT leaves the baseline untouched', async () => {
  await run();
  const before = readFileSync(join(dir, 'wealth', 'morning_brief_bills.json'), 'utf8');
  state.bills.push(billRow({ id: 'bill-9', name: 'Synth Gas' }));
  const { status, envelope } = await run(env({ WEALTH_BRIEF_NO_WRITE_SNAPSHOT: '1' }));
  assert.equal(status, 0);
  const after = readFileSync(join(dir, 'wealth', 'morning_brief_bills.json'), 'utf8');
  assert.equal(after, before);
  // The diff still ran and still flagged the new bill.
  assert.equal(envelope.sections.bills.flags[0].type, 'new_bill');
});

test('brief: WEALTH_BRIEF_BILLS_ONLY skips the money sections entirely', async () => {
  await run(); // baseline the snapshot
  state.searchRequests = []; // only the bills-only run is counted below
  const { status, envelope } = await run(env({ WEALTH_BRIEF_BILLS_ONLY: '1' }));
  assert.equal(status, 0);
  assert.equal(envelope.sections.money_in_out, undefined);
  assert.equal(envelope.sections.budget_pacing, undefined);
  assert.equal(envelope.sections.anomalies, undefined);
  assert.ok(envelope.sections.bills);
  assert.equal(envelope.sections.diagnostics.hominem_calls, 1);
  assert.equal(state.searchRequests.length, 0);
});

test('brief: a day with more rows than one page is surfaced, never silently capped', async () => {
  state.searchRows = Array.from({ length: 60 }, (_, i) =>
    ledgerRow({
      id: `bulk-${i}`,
      description: 'Synth Bulk Co tiny',
      merchantName: 'Synth Bulk Co',
      amount: -1,
      categoryId: 'cat-misc',
      categoryName: 'Misc',
    }),
  );
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.sections.diagnostics.yesterday_truncated, 60);
  // The in/out math still ran over the page it got.
  assert.equal(envelope.sections.money_in_out.per_currency.GBP.out, 50);
});

test("brief: no primary currency skips pacing with the server's own warning", async () => {
  state.budgets.primaryCurrency = null;
  state.budgets.warning = 'primary currency is unset; budget pacing needs one';
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.sections.budget_pacing, undefined);
  assert.equal(
    envelope.sections.diagnostics.pacing_skipped,
    'primary currency is unset; budget pacing needs one',
  );
  // No spending call was made — pacing never guessed.
  assert.ok(!state.searchRequests.some((a) => a.from === MONTH_START));
  // Everything else still ran.
  assert.ok(envelope.sections.money_in_out);
  assert.ok(envelope.sections.bills);
});

test('brief: a failing history call is a named source error, never the end of the run', async () => {
  // A merchant whose history search must fail: the mock 500s on any
  // query containing "synth boom".
  state.failQueries = ['synth boom'];
  state.searchRows = [
    ledgerRow({
      description: 'Synth Boom Co thing',
      merchantName: 'Synth Boom Co',
      amount: -10,
      categoryId: 'cat-misc',
      categoryName: 'Misc',
    }),
  ];
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true); // money section present > source error
  assert.match(envelope.sections.diagnostics.source_errors['history:synth boom co'], /boom/);
  assert.ok(envelope.sections.money_in_out);
  assert.ok(envelope.sections.bills);
});

test('brief: a missing backbone env fails the run by name (law 4)', async () => {
  const { status, envelope } = await run(env({ HOMINEM_MCP_TOKEN: undefined }));
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.match(envelope.error, /HOMINEM_MCP_TOKEN/);
  const runsRows = rows(dbFile, 'runs');
  assert.equal(runsRows[0].source, 'wealth-brief');
  assert.equal(runsRows[0].status, 'failed');
});
