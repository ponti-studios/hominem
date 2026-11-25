/**
 * wealth-manager Layer 4 (monthly close): mock-backend tests, synthetic
 * only (2026-11-22 ruling — no personal financial data in this repo,
 * fixtures included). One fake backend: an in-process Hominem MCP
 * JSON-RPC server serving the six tools the close reads
 * (finance_spending_by_category, finance_monthly_stats,
 * finance_transaction_search with the close's 50-row paging,
 * finance_tag_breakdown, finance_budget_list, finance_net_worth),
 * plus the two machine-local files ($HOMINEM_AGENT_WEALTH_DIR anchors and
 * hygiene-check cache — law 4, nothing personal in the repo).
 * Proves: the month summary (GBP headline, the USD n/m branch and
 * its note), Transfers/Adjustment dropped client-side, budgets as
 * status rows (monthly category rows only — tag status rows and
 * weekly cadence ignored), Food OVER + the BREACH verdict with the
 * disjoint Coffee > Dining Out > Groceries composition, the
 * finance_monthly_stats cross-check, anchors and net cash flow,
 * tax flags, residue with excluded plugs counted separately, the
 * default month (WEALTH_SYNC_TODAY pin), exit-2-before-any-audit-row
 * on an invalid month, WEALTH_CLOSE_OUT, the cache diff, >50-row
 * paging, absent and malformed files as named notes, tool warnings,
 * the any-tool-failure-fails-the-close semantics (unlike Layers 2
 * and 3), and the no-income currency branch. Law 1: every MCP call
 * lands an events row (initialize + initialized + N calls).
 */
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { j, rows, runWrapper, tmpDb } from './helpers.ts';

const CLOSE = 'systems/wealth-manager/monthly_close.ts';
const TODAY = '2026-11-22';
const MONTH = '2026-10';
const FROM = '2026-10-01';
const TO = '2026-10-31';

const row = (over: Record<string, any>) => ({
  id: 'r-' + Math.random().toString(36).slice(2),
  accountId: 'acc-synth-1',
  accountName: 'Synth Chequing',
  postedOn: '2026-10-15',
  description: 'synth row',
  merchantName: null,
  amount: -1,
  currencyCode: 'GBP',
  transactionType: 'debit',
  categoryId: 'cat-x',
  categoryName: 'Uncategorized',
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

/**
 * The month behind the fixture numbers: GBP income 4,002 (3502 + 500,
 * with a pending row and an out-of-window September row filtered
 * client-side), GBP spend 728.50 (Food 518.50 + Living Costs 210 —
 * Transfers 300 and Adjustment 40 excluded client-side), USD income
 * 10 against USD spend 300 (the n/m branch), Food rows coherent with
 * the category total, two Business spend rows + a positive refund the
 * spend filter drops, and Uncategorized holding one residue row plus
 * one excluded plug.
 */
const defaultSearchRows = () => [
  row({
    postedOn: '2026-10-05',
    merchantName: 'Synth Employer',
    amount: 3502,
    transactionType: 'credit',
    categoryId: 'cat-income',
    categoryName: 'Income',
  }),
  row({
    postedOn: '2026-10-20',
    merchantName: 'Synth Client',
    amount: 500,
    transactionType: 'credit',
    categoryId: 'cat-income',
    categoryName: 'Income',
  }),
  row({
    postedOn: '2026-10-28',
    merchantName: 'Synth USD Interest',
    amount: 10,
    currencyCode: 'USD',
    transactionType: 'credit',
    categoryId: 'cat-income',
    categoryName: 'Income',
  }),
  // Filtered client-side: pending, and a September payday outside the window.
  row({
    postedOn: '2026-10-29',
    merchantName: 'Synth Pending Pay',
    amount: 999,
    pending: true,
    transactionType: 'credit',
    categoryId: 'cat-income',
    categoryName: 'Income',
  }),
  row({
    postedOn: '2026-09-30',
    merchantName: 'Synth Sept Pay',
    amount: 777,
    transactionType: 'credit',
    categoryId: 'cat-income',
    categoryName: 'Income',
  }),
  row({
    postedOn: '2026-10-12',
    merchantName: 'Mystery Shop GBP',
    amount: -45,
    categoryId: 'cat-uncat',
    categoryName: 'Uncategorized',
  }),
  row({
    postedOn: '2026-10-13',
    merchantName: 'Synth Plug GBP',
    amount: -50,
    excluded: true,
    categoryId: 'cat-uncat',
    categoryName: 'Uncategorized',
  }),
  row({
    postedOn: '2026-10-03',
    merchantName: 'Synth Software Ltd',
    amount: -70,
    categoryId: 'cat-soft',
    categoryName: 'Software',
    tags: ['Business'],
  }),
  row({
    postedOn: '2026-10-18',
    merchantName: 'Synth Ads Co',
    amount: -50,
    categoryId: 'cat-ads',
    categoryName: 'Advertising',
    tags: ['Business'],
  }),
  // Filtered client-side: a positive Business row is not spend.
  row({
    postedOn: '2026-10-19',
    merchantName: 'Synth Refund Co',
    amount: 25,
    transactionType: 'credit',
    categoryId: 'cat-soft',
    categoryName: 'Software',
    tags: ['Business'],
  }),
  row({
    postedOn: '2026-10-02',
    merchantName: 'Synth Market',
    amount: -200,
    categoryId: 'cat-food',
    categoryName: 'Food',
    tags: ['Groceries'],
  }),
  row({
    postedOn: '2026-10-04',
    merchantName: 'Synth Roasters',
    amount: -30,
    categoryId: 'cat-food',
    categoryName: 'Food',
    tags: ['Coffee', 'Groceries'],
  }),
  row({
    postedOn: '2026-10-07',
    merchantName: 'Synth Bistro',
    amount: -100,
    categoryId: 'cat-food',
    categoryName: 'Food',
    tags: ['Dining Out'],
  }),
  row({
    postedOn: '2026-10-09',
    merchantName: 'Synth Market',
    amount: -80.5,
    categoryId: 'cat-food',
    categoryName: 'Food',
    tags: ['Groceries'],
  }),
  row({
    postedOn: '2026-10-11',
    merchantName: 'Synth Untagged Eats',
    amount: -108,
    categoryId: 'cat-food',
    categoryName: 'Food',
  }),
];

const defaultSpendCats = () => [
  {
    categoryId: 'cat-food',
    categoryName: 'Food',
    currencyCode: 'GBP',
    spent: 518.5,
    transactionCount: 5,
  },
  {
    categoryId: 'cat-living',
    categoryName: 'Living Costs',
    currencyCode: 'GBP',
    spent: 210,
    transactionCount: 3,
  },
  // Plumbing categories: excluded from the headline client-side.
  {
    categoryId: 'cat-transfers',
    categoryName: 'Transfers',
    currencyCode: 'GBP',
    spent: 300,
    transactionCount: 2,
  },
  {
    categoryId: 'cat-adjust',
    categoryName: 'Adjustment',
    currencyCode: 'GBP',
    spent: 40,
    transactionCount: 1,
  },
  {
    categoryId: 'cat-travel',
    categoryName: 'Travel',
    currencyCode: 'USD',
    spent: 300,
    transactionCount: 1,
  },
];

/** Status rows: the Food category row with nested tagBudgets, a tag
 * status row (must be ignored), and a weekly category row (ignored). */
const defaultBudgetRows = () => [
  {
    id: 'bud-food',
    categoryId: 'cat-food',
    categoryName: 'Food',
    tagId: null,
    tagName: null,
    amountCents: 50000,
    cadence: 'monthly',
    currencyCode: 'GBP',
    tagBudgets: [
      {
        budgetId: 'bud-groc',
        tagId: 'tag-groc',
        tagName: 'Groceries',
        amountCents: 30000,
        cadence: 'monthly',
      },
      {
        budgetId: 'bud-din',
        tagId: 'tag-din',
        tagName: 'Dining Out',
        amountCents: 15000,
        cadence: 'monthly',
      },
      {
        budgetId: 'bud-cof',
        tagId: 'tag-cof',
        tagName: 'Coffee',
        amountCents: 5000,
        cadence: 'monthly',
      },
    ],
  },
  {
    id: 'bud-cof-tag',
    categoryId: 'cat-food',
    categoryName: 'Food',
    tagId: 'tag-9999',
    tagName: 'Coffee',
    amountCents: 999900,
    cadence: 'monthly',
    currencyCode: 'GBP',
    tagBudgets: [],
  },
  {
    id: 'bud-living',
    categoryId: 'cat-living',
    categoryName: 'Living Costs',
    tagId: null,
    tagName: null,
    amountCents: 999900,
    cadence: 'weekly',
    currencyCode: 'GBP',
  },
];

/** Transfer-inclusive by design, so it differs from the headline. */
const defaultMonthlyStats = () => ({
  month: MONTH,
  income: 4410,
  expenses: 1400,
  net: 3010,
  transactionCount: 48,
  averageTransaction: 29.17,
  topTag: 'Synth Tag',
  topMerchant: 'Synth Merchant',
  tagSpending: [{ name: 'Synth Tag', amount: 1100, currencyCode: 'GBP' }],
  currencyBreakdown: [
    {
      currencyCode: 'GBP',
      income: 4400,
      expenses: 1100,
      net: 3300,
      transactionCount: 44,
      averageTransaction: 25,
      topTag: 'Synth Tag',
      topMerchant: 'Synth Merchant',
      tagSpending: [{ name: 'Synth Tag', amount: 1100 }],
    },
    {
      currencyCode: 'USD',
      income: 10,
      expenses: 300,
      net: -290,
      transactionCount: 4,
      averageTransaction: 75,
      topTag: 'Synth USD Tag',
      topMerchant: 'Synth USD Merchant',
      tagSpending: [{ name: 'Synth USD Tag', amount: 300 }],
    },
  ],
  currencyCode: null,
  warnings: [] as string[],
});

const defaultTagBreakdown = () => ({
  breakdown: [
    { tag: 'Business', amount: 120, percentage: 100, transactionCount: 2, currencyCode: 'GBP' },
  ],
  totalSpending: 120,
  totalsByCurrency: [{ currencyCode: 'GBP', totalSpending: 120, averagePerDay: 3.87 }],
  averagePerDay: 3.87,
  currencyCode: null,
  warnings: [] as string[],
});

const defaultNetWorth = () => ({
  asOf: '2026-11-22T09:00:00.000Z',
  totals: [
    { currencyCode: 'GBP', total: 25000, accountCount: 4 },
    { currencyCode: 'USD', total: 500, accountCount: 1 },
  ],
  accounts: [],
  warnings: [] as string[],
});

/** Machine-local, law 4: dated anchors and tax-status lines that
 * would never live in the repo — including the empty-totals anchor
 * the archived truthiness port must skip without rendering. */
const defaultAnchors = () => ({
  anchors: [
    {
      date: '2026-10-31',
      label: 'Synth filed anchor',
      totals: { GBP: 24000 },
      basis: 'synthetic filing',
    },
    {
      date: '2026-09-30',
      label: 'Synth blended anchor',
      blended_gbp: 22000.5,
      basis: 'synthetic blend',
    },
    { date: '2026-08-31', label: 'Synth empty anchor', totals: {}, basis: 'synthetic empty' },
  ],
  tax_status: ['Synth tax status: payment on account due 2027-01-31.'],
});

/** Cache totals matching the live pull exactly (plumbing rows are
 * skipped on both sides of the diff). */
const matchingCache = () => ({
  spending: {
    categories: [
      { categoryName: 'Food', currencyCode: 'GBP', spent: 518.5 },
      { categoryName: 'Living Costs', currencyCode: 'GBP', spent: 210 },
      { categoryName: 'Transfers', currencyCode: 'GBP', spent: 300 },
      { categoryName: 'Travel', currencyCode: 'USD', spent: 300 },
    ],
  },
});

/** 61 Uncategorized spend rows: page 1 is a full 50 (so searchAll
 * must page), page 2 carries the remaining 11. */
const uncatPageRows = () =>
  Array.from({ length: 61 }, (_, i) =>
    row({
      id: `r-uncat-${i}`,
      postedOn: '2026-10-15',
      merchantName: `Synth Residue ${i}`,
      amount: -1,
    }),
  );

let dir: string;
let dbFile: string;
let server: ReturnType<typeof createServer>;
let port: number;
const state = {
  searchRows: defaultSearchRows(),
  spendCats: defaultSpendCats(),
  spendWarnings: [] as string[],
  spendTruncated: false,
  monthlyStats: defaultMonthlyStats(),
  tagBreakdown: defaultTagBreakdown(),
  budgetRows: defaultBudgetRows(),
  budgetsWarning: null as string | null,
  netWorth: defaultNetWorth(),
  failNetWorth: false,
  pageUncat: false,
  eurSpend: false,
  searchCalls: [] as {
    categoryName?: string;
    tag?: string;
    from?: string;
    to?: string;
    offset?: number;
    limit?: number;
  }[],
  monthlyStatsCalls: [] as (string | undefined)[],
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-close-'));
  dbFile = tmpDb(dir);
  writeFileSync(join(dir, 'empty.env'), '# empty test env\n');
  state.searchRows = defaultSearchRows();
  state.spendCats = defaultSpendCats();
  state.spendWarnings = [];
  state.spendTruncated = false;
  state.monthlyStats = defaultMonthlyStats();
  state.tagBreakdown = defaultTagBreakdown();
  state.budgetRows = defaultBudgetRows();
  state.budgetsWarning = null;
  state.netWorth = defaultNetWorth();
  state.failNetWorth = false;
  state.pageUncat = false;
  state.eurSpend = false;
  state.searchCalls = [];
  state.monthlyStatsCalls = [];

  server = createServer((req: IncomingMessage, res: ServerResponse) => {
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
          { 'mcp-session-id': 'sess-mock-close' },
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
        if (name === 'finance_spending_by_category') {
          const cats = state.eurSpend
            ? [
                ...state.spendCats,
                {
                  categoryId: 'cat-eur',
                  categoryName: 'Euro Snacks',
                  currencyCode: 'EUR',
                  spent: 12,
                  transactionCount: 1,
                },
              ]
            : state.spendCats;
          return send(
            200,
            result({
              from: args.from ?? FROM,
              to: args.to ?? TO,
              currencyCode: null,
              truncated: state.spendTruncated,
              categories: cats,
              warnings: state.spendWarnings,
            }),
          );
        }
        if (name === 'finance_monthly_stats') {
          state.monthlyStatsCalls.push(args.month);
          return send(200, result(state.monthlyStats));
        }
        if (name === 'finance_transaction_search') {
          state.searchCalls.push({
            categoryName: args.categoryName,
            tag: args.tag,
            from: args.from,
            to: args.to,
            offset: args.offset,
            limit: args.limit,
          });
          let hits =
            state.pageUncat && args.categoryName === 'Uncategorized'
              ? uncatPageRows()
              : state.searchRows;
          if (args.from) hits = hits.filter((r: any) => r.postedOn >= args.from);
          if (args.to) hits = hits.filter((r: any) => r.postedOn <= args.to);
          if (args.categoryName)
            hits = hits.filter((r: any) => r.categoryName === args.categoryName);
          if (args.tag) {
            hits = hits.filter((r: any) =>
              (r.tags ?? []).some(
                (t: string) => t.toLowerCase() === String(args.tag).toLowerCase(),
              ),
            );
          }
          const offset = args.offset ?? 0;
          const limit = args.limit ?? 20;
          const page = hits.slice(offset, offset + limit);
          return send(
            200,
            result({
              transactions: page,
              count: page.length,
              filteredCount: hits.length,
              totalUserCount: hits.length,
            }),
          );
        }
        if (name === 'finance_tag_breakdown') {
          return send(200, result(state.tagBreakdown));
        }
        if (name === 'finance_budget_list') {
          return send(
            200,
            result({
              primaryCurrency: 'GBP',
              budgets: state.budgetRows,
              breaches: [],
              count: state.budgetRows.length,
              warning: state.budgetsWarning,
              storedBudgets: [],
            }),
          );
        }
        if (name === 'finance_net_worth') {
          if (state.failNetWorth) {
            return send(200, {
              jsonrpc: '2.0',
              id: body.id,
              error: { code: -32000, message: 'synthetic net_worth failure' },
            });
          }
          return send(200, result(state.netWorth));
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

function writeAnchors(obj: unknown): void {
  writeFileSync(join(dir, 'monthly_close_anchors.json'), JSON.stringify(obj, null, 1) + '\n');
}

function writeCache(obj: unknown): void {
  writeFileSync(join(dir, `monthly_check_${MONTH}_data.json`), JSON.stringify(obj, null, 1) + '\n');
}

const env = (over: Record<string, string | undefined> = {}) => ({
  HOMINEM_AGENT_DB: dbFile,
  HOMINEM_AGENT_ENV_FILE: join(dir, 'empty.env'),
  HOMINEM_AGENT_WEALTH_DIR: dir,
  HOMINEM_MCP_URL: `http://127.0.0.1:${port}`,
  HOMINEM_MCP_TOKEN: 'hmt-test',
  WEALTH_SYNC_TODAY: TODAY,
  WEALTH_CLOSE_MONTH: MONTH,
  ...over,
});

const run = async (e: Record<string, string | undefined> = env()) => {
  const r = await runWrapper(CLOSE, e, []);
  return { status: r.status, out: r.stdout, stderr: r.stderr };
};

test('close: full run — summary, budgets, composition, cross-checks, net worth, tax, residue, law 1', async () => {
  writeAnchors(defaultAnchors());
  writeCache(matchingCache());
  const { status, out } = await run();
  assert.equal(status, 0);

  // Header states the month, the source, the call count, the definitions.
  assert.ok(out.includes(`# Monthly close — ${MONTH}`));
  assert.ok(
    out.includes(
      `Produced by monthly_close.ts (WYA-230) on ${TODAY}. Source: Hominem via the Hominem MCP client only (9 calls).`,
    ),
  );
  assert.ok(!out.includes('pin WEALTH_CLOSE_MONTH')); // month was pinned, not defaulted

  // Month summary: GBP headline (pending and out-of-window income filtered),
  // the USD n/m branch with its note. Currencies never blended.
  assert.ok(out.includes('| Currency | Income | Spend | Net | Savings rate |'));
  assert.ok(out.includes('| GBP | £4,002.00 | £728.50 | £3,273.50 | 81.8% |'));
  assert.ok(out.includes('| USD | $10.00 | $300.00 | -$290.00 | n/m (see note) |'));
  assert.ok(
    out.includes(
      'Note (USD): savings rate not meaningful — USD income recorded in Hominem this month is only $10.00; the USD side runs largely through transfers, which are excluded by design. The net figure is the honest one.',
    ),
  );

  // Income sources, sorted by amount.
  assert.ok(out.includes('- Synth Employer — £3,502.00'));
  assert.ok(out.includes('- Synth Client — £500.00'));
  assert.ok(out.includes('- Synth USD Interest — $10.00'));
  assert.ok(!out.includes('Synth Pending Pay'));
  assert.ok(!out.includes('Synth Sept Pay'));

  // Spend by category: Transfers and Adjustment dropped client-side; the
  // Food budget comes from the monthly category status row only (the tag
  // status row 9999 and the weekly row are ignored); Food is OVER and the
  // parent budget is the hard line.
  assert.ok(out.includes('### Spend by category — GBP'));
  assert.ok(out.includes('| Food | £518.50 | 5 | £500.00 | OVER by £18.50 |'));
  assert.ok(out.includes('| Living Costs | £210.00 | 3 | — (no stored budget) | — |'));
  assert.ok(out.includes('| **Total** | **£728.50** | 8 | | |'));
  assert.ok(!out.includes('| Transfers |'));
  assert.ok(!out.includes('| Adjustment |'));
  assert.ok(
    out.includes(
      'Food composition (disjoint, Coffee > Dining Out > Groceries priority; composition only — tag budgets never breach on their own). Food £518.50 vs £500.00 budget: BREACH — the parent Food budget is the hard line.',
    ),
  );
  assert.ok(out.includes('| Coffee | £30.00 | £50.00 |'));
  assert.ok(out.includes('| Dining Out | £100.00 | £150.00 |'));
  assert.ok(out.includes('| Groceries | £280.50 | £300.00 |'));
  assert.ok(out.includes('### Spend by category — USD'));
  assert.ok(out.includes('| Travel | $300.00 | 1 | — (no stored budget) | — |'));

  // Cross-checks: the transfer-inclusive difference reported, not reconciled
  // away; the hygiene cache matches exactly.
  assert.ok(
    out.includes(
      `- finance_monthly_stats (GBP): income £4,400.00, expenses £1,100.00, net £3,300.00 — transfer-inclusive by design, so it differs from the headline (income £4,002.00, spend £728.50) by the transfers and non-Income credits it counts. Definitional, not an error.`,
    ),
  );
  assert.ok(
    out.includes(
      `- finance_monthly_stats (USD): income $10.00, expenses $300.00, net -$290.00 — transfer-inclusive by design, so it differs from the headline (income $10.00, spend $300.00) by the transfers and non-Income credits it counts. Definitional, not an error.`,
    ),
  );
  assert.ok(
    out.includes(
      `- Hygiene-check cache (monthly_check_${MONTH}_data.json): every category total matches the live pull exactly.`,
    ),
  );

  // Net worth: no snapshots, anchors as filed (the empty one skipped),
  // current position, month cash flow.
  assert.ok(
    out.includes(
      'Hominem holds no historical net-worth snapshots, so no month-boundary delta is computed',
    ),
  );
  assert.ok(
    out.includes('- 2026-10-31 — Synth filed anchor: GBP £24,000.00. Basis: synthetic filing'),
  );
  assert.ok(
    out.includes('- 2026-09-30 — Synth blended anchor: £22,000.5 blended. Basis: synthetic blend'),
  );
  assert.ok(!out.includes('Synth empty anchor'));
  assert.ok(
    out.includes(
      '- Current at run time (2026-11-22): GBP £25,000.00 (4 accounts), USD $500.00 (1 accounts). Basis: finance_net_worth, per currency, unconverted.',
    ),
  );
  assert.ok(
    out.includes(
      '- 2026-10 net cash flow (income − spend, plumbing excluded): GBP £3,273.50, USD -$290.00.',
    ),
  );

  // Tax flags: the Business-tagged spend total (refund row dropped), the
  // rows, income sources, and the standing tax-status line.
  assert.ok(out.includes('Business-tagged spend: £120.00 across 2 transactions.'));
  assert.ok(out.includes('| 2026-10-03 | Synth Software Ltd | Software | £70.00 |'));
  assert.ok(out.includes('| 2026-10-18 | Synth Ads Co | Advertising | £50.00 |'));
  assert.ok(!out.includes('Synth Refund Co'));
  assert.ok(
    out.includes(
      'Income sources this month: Synth Client, Synth Employer, Synth USD Interest. Anything beyond employment and interest would be named here as Self-Assessment-relevant; the Business-tagged spend above is the accumulating SA record.',
    ),
  );
  assert.ok(out.includes('- Synth tax status: payment on account due 2027-01-31.'));

  // Residue: the posted spend row named; the excluded plug counted
  // separately, not as residue.
  assert.ok(out.includes('1 posted spend rows still Uncategorized at close: £45.00.'));
  assert.ok(out.includes('| 2026-10-12 | Mystery Shop GBP | £45.00 |'));
  assert.ok(
    out.includes(
      '(1 excluded rows also sit in Uncategorized — balance plugs and account notes; excluded from analytics, not residue.)',
    ),
  );
  assert.ok(!out.includes('## Tool warnings'));

  // The month window is monthBounds: every search pinned to October,
  // monthlyStats got the month, searches paged at 50.
  assert.ok(state.searchCalls.length === 4);
  assert.ok(state.searchCalls.every((c) => c.from === FROM && c.to === TO));
  assert.deepEqual(
    state.searchCalls.map((c) => c.categoryName ?? c.tag),
    ['Income', 'Uncategorized', 'Business', 'Food'],
  );
  assert.ok(state.searchCalls.every((c) => c.limit === 50 && (c.offset ?? 0) === 0));
  assert.deepEqual(state.monthlyStatsCalls, [MONTH]);

  // Law 1: initialize + initialized + 9 tools/call, one ok runs row.
  const ev = rows(dbFile, 'events').filter((r: any) => r.connector === 'hominem-mcp');
  assert.equal(ev.length, 11);
  const cmds = ev.map((r: any) => j(r.command));
  assert.deepEqual(cmds[0], ['initialize']);
  assert.deepEqual(cmds[1], ['notifications/initialized']);
  const toolCalls = cmds
    .filter((c: any) => Array.isArray(c) && String(c[0]).startsWith('tools/call'))
    .map((c: any) => c[0]);
  assert.deepEqual(toolCalls, [
    'tools/call finance_spending_by_category',
    'tools/call finance_monthly_stats',
    'tools/call finance_transaction_search',
    'tools/call finance_transaction_search',
    'tools/call finance_tag_breakdown',
    'tools/call finance_transaction_search',
    'tools/call finance_budget_list',
    'tools/call finance_net_worth',
    'tools/call finance_transaction_search',
  ]);
  const runsRows = rows(dbFile, 'runs');
  assert.equal(runsRows.length, 1);
  assert.equal(runsRows[0].source, 'wealth-close');
  assert.equal(runsRows[0].status, 'ok');
  assert.equal(runsRows[0].exit_code, 0);
  assert.equal(
    runsRows[0].message,
    'month 2026-10: 9 hominem calls, 1 residue rows, 0 tool warnings',
  );
});

test('close: no WEALTH_CLOSE_MONTH defaults to the last complete month, stated in the header', async () => {
  writeAnchors(defaultAnchors());
  writeCache(matchingCache());
  const { status, out } = await run(env({ WEALTH_CLOSE_MONTH: undefined }));
  assert.equal(status, 0);
  assert.ok(out.includes(`# Monthly close — ${MONTH}`));
  assert.ok(
    out.includes(
      ` Month ${MONTH} is the last complete month before ${TODAY} — pin WEALTH_CLOSE_MONTH to close another.`,
    ),
  );
});

test('close: an invalid month is exit 2 before any audit row', async () => {
  const { status, out, stderr } = await run(env({ WEALTH_CLOSE_MONTH: '2026-13' }));
  assert.equal(status, 2);
  assert.equal(stderr, 'month must be YYYY-MM\n');
  assert.equal(out, '');
  // Usage error: nothing was logged (law 1 — no call, no run).
  assert.equal(rows(dbFile, 'events').length, 0);
  assert.equal(rows(dbFile, 'runs').length, 0);
});

test('close: WEALTH_CLOSE_OUT writes the file and stdout carries the receipt', async () => {
  writeAnchors(defaultAnchors());
  writeCache(matchingCache());
  const outPath = join(dir, 'close.md');
  const { status, out } = await run(env({ WEALTH_CLOSE_OUT: outPath }));
  assert.equal(status, 0);
  assert.equal(out, `wrote ${outPath} (9 calls)\n`);
  const md = readFileSync(outPath, 'utf8');
  assert.ok(md.startsWith(`# Monthly close — ${MONTH}`));
  assert.ok(md.includes('| GBP | £4,002.00 | £728.50 | £3,273.50 | 81.8% |'));
  assert.ok(md.includes('## Tax flags'));
  // The file ends with exactly one newline — every render section closes
  // with a blank element, so the join carries one (POSIX-tidy artifact).
  assert.ok(md.endsWith('\n'));
  assert.ok(!md.endsWith('\n\n'));
});

test('close: a differing hygiene cache names the diffs, never smooths them over', async () => {
  writeAnchors(defaultAnchors());
  writeCache({
    spending: {
      categories: [
        // Food recategorised since the check; one category gone entirely.
        { categoryName: 'Food', currencyCode: 'GBP', spent: 500 },
        { categoryName: 'Gone Category', currencyCode: 'GBP', spent: 75 },
        { categoryName: 'Living Costs', currencyCode: 'GBP', spent: 210 },
        { categoryName: 'Travel', currencyCode: 'USD', spent: 300 },
      ],
    },
  });
  const { status, out } = await run();
  assert.equal(status, 0);
  assert.ok(
    out.includes(
      `- Hygiene-check cache (monthly_check_${MONTH}_data.json): 2 category total(s) differ from the live pull — recategorisation since that check, shown plainly, not smoothed over:`,
    ),
  );
  assert.ok(out.includes('- Food (GBP): hygiene £500.00 → live £518.50'));
  assert.ok(out.includes('- Gone Category (GBP): hygiene £75.00 → live absent'));
});

test('close: >50 residue rows page at 50 — offsets [0, 50], one extra call', async () => {
  state.pageUncat = true;
  writeAnchors(defaultAnchors());
  const { status, out } = await run();
  assert.equal(status, 0);
  assert.ok(out.includes('61 posted spend rows still Uncategorized at close: £61.00.'));
  const uncat = state.searchCalls.filter((c) => c.categoryName === 'Uncategorized');
  assert.deepEqual(
    uncat.map((c) => c.offset),
    [0, 50],
  );
  assert.ok(state.searchCalls.every((c) => c.limit === 50));
  // 9 calls + the extra residue page = 10 tool calls, 12 hominem-mcp events.
  const ev = rows(dbFile, 'events').filter((r: any) => r.connector === 'hominem-mcp');
  assert.equal(ev.length, 12);
  const cmds = ev.map((r: any) => j(r.command));
  assert.equal(
    cmds.filter((c: any) => Array.isArray(c) && String(c[0]).startsWith('tools/call')).length,
    10,
  );
  const runsRows = rows(dbFile, 'runs');
  assert.equal(
    runsRows[0].message,
    'month 2026-10: 10 hominem calls, 61 residue rows, 0 tool warnings',
  );
});

test('close: absent anchors and cache degrade with named notes', async () => {
  const { status, out } = await run();
  assert.equal(status, 0);
  assert.ok(
    out.includes(
      '(No monthly_close_anchors.json in the wealth dir — dated anchors and tax-status lines are not filed, so none are stated.)',
    ),
  );
  assert.ok(
    out.includes(
      `- Hygiene-check cache (monthly_check_${MONTH}_data.json): not found in the wealth dir — no cache diff this close.`,
    ),
  );
  assert.ok(!out.includes('Synth filed anchor'));
  assert.ok(!out.includes('- Synth tax status'));
});

test('close: malformed anchors and cache are named notes, never crashes', async () => {
  writeFileSync(join(dir, 'monthly_close_anchors.json'), '{ not json at all\n');
  writeFileSync(join(dir, `monthly_check_${MONTH}_data.json`), '][ broken\n');
  const { status, out } = await run();
  assert.equal(status, 0);
  assert.ok(
    out.includes(
      '(monthly_close_anchors.json is malformed — anchors and tax-status lines skipped:',
    ),
  );
  assert.ok(
    out.includes(`- Hygiene-check cache (monthly_check_${MONTH}_data.json): malformed — skipped:`),
  );
});

test('close: tool warnings land in their own section, counted in the run message', async () => {
  writeAnchors(defaultAnchors());
  state.spendWarnings = ['synthetic spend warning'];
  state.spendTruncated = true;
  state.monthlyStats = { ...defaultMonthlyStats(), warnings: ['synthetic stats warning'] };
  state.tagBreakdown = { ...defaultTagBreakdown(), warnings: ['synthetic tag warning'] };
  state.budgetsWarning = 'synthetic budgets warning';
  state.netWorth = { ...defaultNetWorth(), warnings: ['synthetic nw warning'] };
  const { status, out } = await run();
  assert.equal(status, 0);
  assert.ok(out.includes('## Tool warnings'));
  assert.ok(out.includes('- finance_spending_by_category: synthetic spend warning'));
  assert.ok(
    out.includes('- finance_spending_by_category: result truncated — totals may omit categories'),
  );
  assert.ok(out.includes('- finance_monthly_stats: synthetic stats warning'));
  assert.ok(out.includes('- finance_tag_breakdown: synthetic tag warning'));
  assert.ok(out.includes('- finance_budget_list: synthetic budgets warning'));
  assert.ok(out.includes('- finance_net_worth: synthetic nw warning'));
  const runsRows = rows(dbFile, 'runs');
  assert.equal(
    runsRows[0].message,
    'month 2026-10: 9 hominem calls, 1 residue rows, 6 tool warnings',
  );
});

test('close: any tool failure fails the whole close — no half-empty statement', async () => {
  state.failNetWorth = true;
  const { status, out } = await run();
  assert.equal(status, 1);
  const parsed = JSON.parse(out);
  assert.equal(parsed.ok, false);
  assert.ok(String(parsed.error).includes('HominemMcpError'));
  assert.ok(String(parsed.error).includes('finance_net_worth rpc error'));
  // The statement never printed; the food search never ran.
  assert.ok(!out.includes('# Monthly close'));
  const ev = rows(dbFile, 'events').filter((r: any) => r.connector === 'hominem-mcp');
  assert.equal(ev.length, 10); // handshake + 8 calls (net_worth was the 8th)
  const cmds = ev.map((r: any) => j(r.command));
  assert.equal(
    cmds.filter((c: any) => Array.isArray(c) && String(c[0]).startsWith('tools/call')).length,
    8,
  );
  const runsRows = rows(dbFile, 'runs');
  assert.equal(runsRows.length, 1);
  assert.equal(runsRows[0].status, 'failed');
  assert.equal(runsRows[0].exit_code, 1);
});

test('close: a spend-only currency is n/m (no income), with no note', async () => {
  state.eurSpend = true;
  writeAnchors(defaultAnchors());
  // The matching cache plus the EUR row, so this run stays diff-clean too.
  writeCache({
    spending: {
      categories: [
        ...matchingCache().spending.categories,
        { categoryName: 'Euro Snacks', currencyCode: 'EUR', spent: 12 },
      ],
    },
  });
  const { status, out } = await run();
  assert.equal(status, 0);
  // money() renders negatives as -{sym}{abs}; an unknown symbol carries the
  // code prefix, so the net cell is "-EUR 12.00".
  assert.ok(out.includes('| EUR | EUR 0.00 | EUR 12.00 | -EUR 12.00 | n/m (no income) |'));
  assert.ok(!out.includes('Note (EUR)'));
  assert.ok(out.includes('### Spend by category — EUR'));
  assert.ok(out.includes('| Euro Snacks | EUR 12.00 | 1 | — (no stored budget) | — |'));
});
