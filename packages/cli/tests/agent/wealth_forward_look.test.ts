/**
 * wealth-manager Layer 3 (forward look): mock-backend tests, synthetic
 * only (2026-11-22 ruling — no personal financial data in this repo,
 * fixtures included). One fake backend: an in-process Hominem MCP
 * JSON-RPC server serving finance_accounts, finance_bill_list,
 * finance_transaction_search, finance_budget_list,
 * finance_spending_by_category and finance_runway, plus one GET /fx
 * route standing in for Frankfurter (the real endpoint resolves from
 * WEALTH_FX_URL, law 4). Proves: the horizon math ([as_of+1,
 * as_of+30]), timelines split by currency with fixed bills stepped by
 * cadence (weekly steps, one_off dueDate), variable and top-up bills
 * never amount-projected, unhandled-currency bills named, the
 * salary rule from forward_look_inputs.json (filters, roll-into, the
 * single-observation inference), pinch projection (floors, large
 * outflows, min, ending), the zero-runway verdict, utilisation
 * (normalized limit lookup, charge cards, limit 0), fx_runway (window,
 * average, months of cover; omission named or silent), the inputs-file
 * degradation, the ok=false-on-source-error semantics (unlike Layer 2),
 * and the law-4 named-backbone failure. Law 1: every MCP call and the
 * FX fetch land events rows.
 */
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import type { RunwayResult } from '../../src/agent/systems/wealth-manager/hominem.ts';
import { rows, runWrapper, tmpDb } from './helpers.ts';

const LOOK = 'systems/wealth-manager/forward_look.ts';
const TODAY = '2026-11-22';
const HORIZON_START = '2026-11-23';
const HORIZON_END = '2026-12-22';

const ledgerRow = (over: Record<string, any>) => ({
  id: 'r-' + Math.random().toString(36).slice(2),
  accountId: 'acc-1',
  accountName: 'Synth Chequing',
  postedOn: TODAY,
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

// Salary history (one payroll-sized GBP row, a verification penny and
// a USD stray the rule must filter) + three complete months of GBP
// spend for the fx average (window 2026-08-01..2026-10-31), the
// Transfers row being plumbing the average must exclude.
const defaultRows = () => [
  ledgerRow({
    description: 'Synth Payroll UK salary',
    merchantName: 'Synth Payroll',
    amount: 4500,
    postedOn: '2026-10-25',
    transactionType: 'credit',
    categoryId: 'cat-income',
    categoryName: 'Income',
  }),
  ledgerRow({
    description: 'Synth Payroll verify',
    amount: 0.01,
    postedOn: '2026-10-26',
    transactionType: 'credit',
    categoryId: 'cat-income',
    categoryName: 'Income',
  }),
  ledgerRow({
    description: 'Synth Payroll USD stray',
    amount: 9000,
    currencyCode: 'USD',
    postedOn: '2026-10-27',
    transactionType: 'credit',
    categoryId: 'cat-income',
    categoryName: 'Income',
  }),
  ledgerRow({
    description: 'Synth Sept shop',
    merchantName: 'Synth Sept Market',
    amount: -200,
    postedOn: '2026-09-05',
  }),
  ledgerRow({
    description: 'Synth Sept shop',
    merchantName: 'Synth Sept Market',
    amount: -200,
    postedOn: '2026-09-12',
  }),
  ledgerRow({
    description: 'Synth Sept shop',
    merchantName: 'Synth Sept Market',
    amount: -200,
    postedOn: '2026-09-19',
  }),
  ledgerRow({
    description: 'Synth internal move',
    amount: -500,
    postedOn: '2026-09-20',
    transactionType: 'transfer',
    categoryId: 'cat-transfers',
    categoryName: 'Transfers',
  }),
];

const account = (over: Record<string, any>) => ({
  id: 'acc-' + Math.random().toString(36).slice(2, 8),
  name: 'Synth Chequing',
  accountType: 'checking',
  currencyCode: 'GBP',
  lifecycleStatus: 'open',
  balance: 0,
  allowedCurrencies: ['GBP'],
  includeInNetWorth: true,
  provider: null,
  providerAccountId: null,
  accountNumber: null,
  ...over,
});

// Liquid GBP 8,500, liquid USD 1,000; the closed rows must never count.
const defaultAccounts = () => [
  account({ id: 'acc-gbp-main', name: 'Synth Chequing', balance: 8000 }),
  account({ id: 'acc-gbp-save', name: 'Synth Saver', accountType: 'savings', balance: 500 }),
  account({
    id: 'acc-gbp-closed',
    name: 'Synth Closed Old',
    lifecycleStatus: 'closed',
    balance: 100,
  }),
  account({ id: 'acc-usd', name: 'Synth USD Checking', currencyCode: 'USD', balance: 1000 }),
  account({ id: 'acc-card-1', name: 'Synth Card One', accountType: 'credit_card', balance: -600 }),
  account({
    id: 'acc-card-2',
    name: 'Synth Charge Green',
    accountType: 'credit_card',
    balance: -300,
  }),
  account({
    id: 'acc-card-closed',
    name: 'Synth Old Card',
    accountType: 'credit_card',
    lifecycleStatus: 'closed',
    balance: -50,
  }),
];

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
  dueDate: null,
  status: 'active',
  type: 'confirmed',
  isDismissed: false,
  merchantMatch: ['Synth Utilities'],
  nextDueDate: '2026-12-05',
  lastPaid: null,
  payg: null,
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

const defaultBills = () => [
  billRow({
    id: 'b-rent',
    name: 'Synth Rent',
    providerName: 'Synth Lettings',
    expectedAmountCents: 150000,
    dueDay: 21,
    nextDueDate: '2026-12-21',
  }),
  billRow({
    id: 'b-cleaner',
    name: 'Synth Cleaner',
    providerName: 'Synth Clean Co',
    expectedAmountCents: 4000,
    cadence: 'weekly',
    nextDueDate: '2026-11-24',
  }),
  billRow({
    id: 'b-leccy',
    name: 'Synth Leccy',
    providerName: 'Synth Power',
    amountModel: 'variable',
    expectedAmountCents: null,
    nextDueDate: '2026-12-01',
  }),
  billRow({
    id: 'b-heat',
    name: 'Synth Heat',
    providerName: 'Synth Gas',
    amountModel: 'top_up',
    cadence: null,
    nextDueDate: null,
    payg: {
      latestBalanceCents: 1200,
      latestCheckedAt: '2026-11-20T10:00:00Z',
      supplyStatus: 'connected',
      meterReadingKwh: null,
      dailyBurnCents: 80,
      daysRemaining: 15,
      estimatedRunOutDate: '2026-12-07',
      isStale: false,
      isLow: false,
    },
  }),
  billRow({
    id: 'b-oneoff',
    name: 'Synth Passport Fee',
    providerName: 'Synth Gov',
    expectedAmountCents: 30000,
    cadence: 'one_off',
    dueDay: null,
    dueDate: '2026-12-05',
    nextDueDate: null,
  }),
  billRow({
    id: 'b-usd',
    name: 'Synth USD Cover',
    providerName: 'Synth US Ins',
    currencyCode: 'USD',
    expectedAmountCents: 20000,
    nextDueDate: '2026-12-10',
  }),
  billRow({
    id: 'b-eur',
    name: 'Synth EU Thing',
    providerName: 'Synth EU',
    currencyCode: 'EUR',
    expectedAmountCents: 9000,
    nextDueDate: '2026-11-26',
  }),
  billRow({ id: 'b-paused', name: 'Synth Old Gym', providerName: 'Synth Gym', status: 'paused' }),
  billRow({
    id: 'b-cancelled',
    name: 'Synth Dead Dialup',
    providerName: 'Synth Dialup',
    type: 'cancelled',
  }),
  billRow({
    id: 'b-dismissed',
    name: 'Synth Ignored',
    providerName: 'Synth Ignore',
    isDismissed: true,
  }),
];

const defaultStoredBudgets = () => [
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
    id: 'bud-fun',
    categoryId: 'cat-fun',
    categoryName: 'Synth Fun',
    tagId: null,
    tagName: null,
    amountCents: 5000,
    cadence: 'weekly',
  },
  {
    id: 'bud-coffee',
    categoryId: 'cat-food',
    categoryName: 'Food',
    tagId: 'tag-1',
    tagName: 'Coffee',
    amountCents: 3000,
    cadence: 'monthly',
  },
];

const defaultRunway = (): RunwayResult => ({
  asOfDate: TODAY,
  liquidAccounts: [
    { accountName: 'Synth Chequing', balance: 8000 },
    { accountName: 'Synth Saver', balance: 500 },
  ],
  currencyCode: 'GBP',
  warnings: [] as string[],
  startingCash: 8500,
  weeklyRecurringOutflow: 100,
  recurringLookbackMonths: 6,
  recurringTxnCount: 12,
  weeklyVariableAllowance: 200,
  weeks: [
    {
      week: 1,
      weekStart: HORIZON_START,
      weekEnd: '2026-11-29',
      beginningCash: 8500,
      recurringOutflows: 100,
      variableAllowance: 200,
      netChange: -300,
      endingCash: 8200,
    },
  ],
});

/** Machine-local inputs: synthetic floors, a normalized-name limit and
 * the salary rule (none of which may ever live in the repo). */
const defaultInputs = () => ({
  balance_floors: { GBP: 12000 },
  credit_limits_usd: { SynthCardOne: 2000 },
  salary: {
    query: 'Synth Payroll',
    min_amount: 1000,
    currency: 'GBP',
    lookback_days: 120,
    label: 'Salary — Synth Payroll Ltd',
  },
});

let dir: string;
let dbFile: string;
let server: ReturnType<typeof createServer>;
let port: number;
const state = {
  searchRows: defaultRows(),
  accounts: defaultAccounts(),
  bills: defaultBills(),
  storedBudgets: defaultStoredBudgets(),
  runway: defaultRunway(),
  runwayRequests: [] as any[],
  failQueries: [] as string[],
  fxFail: false,
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-look-'));
  dbFile = tmpDb(dir);
  writeFileSync(join(dir, 'empty.env'), '# empty test env\n');
  writeFileSync(
    join(dir, 'forward_look_inputs.json'),
    JSON.stringify(defaultInputs(), null, 1) + '\n',
  );
  state.searchRows = defaultRows();
  state.accounts = defaultAccounts();
  state.bills = defaultBills();
  state.storedBudgets = defaultStoredBudgets();
  state.runway = defaultRunway();
  state.runwayRequests = [];
  state.failQueries = [];
  state.fxFail = false;

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
      // The FX reference rate (GET, no MCP auth): Frankfurter's shape.
      if (req.method === 'GET' && (req.url ?? '').startsWith('/fx')) {
        if (state.fxFail) return send(500, { error: 'mock fx failure' });
        return send(200, { amount: 1, base: 'USD', date: '2026-11-20', rates: { GBP: 0.79 } });
      }
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
            result({
              accounts: state.accounts,
              count: state.accounts.length,
              totalCount: state.accounts.length,
            }),
          );
        }
        if (name === 'finance_bill_list') {
          return send(200, result({ bills: state.bills, count: state.bills.length }));
        }
        if (name === 'finance_transaction_search') {
          const fail = args.query
            ? state.failQueries.find((q) => String(args.query).toLowerCase().includes(q))
            : undefined;
          if (fail) return send(500, { error: `mock injected failure: ${fail}` });
          let hits = state.searchRows;
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
          const from = args.from ?? HORIZON_START;
          const to = args.to ?? TODAY;
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
              primaryCurrency: 'GBP',
              budgets: [],
              breaches: [],
              count: state.storedBudgets.length,
              warning: null,
              storedBudgets: state.storedBudgets,
            }),
          );
        }
        if (name === 'finance_runway') {
          state.runwayRequests.push(args);
          return send(200, result(state.runway));
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

function writeInputs(inputs: Record<string, unknown>): void {
  writeFileSync(join(dir, 'forward_look_inputs.json'), JSON.stringify(inputs, null, 1) + '\n');
}

const env = (over: Record<string, string | undefined> = {}) => ({
  HOMINEM_AGENT_DB: dbFile,
  HOMINEM_AGENT_ENV_FILE: join(dir, 'empty.env'),
  HOMINEM_AGENT_WEALTH_DIR: dir,
  HOMINEM_MCP_URL: `http://127.0.0.1:${port}`,
  HOMINEM_MCP_TOKEN: 'hmt-test',
  WEALTH_SYNC_TODAY: TODAY,
  WEALTH_FX_URL: `http://127.0.0.1:${port}/fx`,
  ...over,
});

const run = async (e: Record<string, string | undefined> = env()) => {
  const r = await runWrapper(LOOK, e, []);
  return { status: r.status, envelope: r.stdout.trim() ? JSON.parse(r.stdout) : null, raw: r };
};

test('look: full run — timelines, pinch flags, runway raw, utilisation, fx, law 1', async () => {
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.as_of, TODAY);
  assert.equal(envelope.horizon_days, 30);
  assert.deepEqual(envelope.horizon, { from: HORIZON_START, to: HORIZON_END });

  // GBP timeline: bills + salary, dated and sorted; the weekly cleaner
  // steps 7 days (5 occurrences inside 30 days).
  assert.deepEqual(
    envelope.sections.timeline_gbp.map((e: any) => [e.date, e.label, e.amount, e.inferred]),
    [
      ['2026-11-24', 'Synth Cleaner — Synth Clean Co', -40, false],
      ['2026-11-25', 'Salary — Synth Payroll Ltd', 4500, true],
      ['2026-12-01', 'Synth Cleaner — Synth Clean Co', -40, false],
      ['2026-12-05', 'Synth Passport Fee — Synth Gov', -300, false],
      ['2026-12-08', 'Synth Cleaner — Synth Clean Co', -40, false],
      ['2026-12-15', 'Synth Cleaner — Synth Clean Co', -40, false],
      ['2026-12-21', 'Synth Rent — Synth Lettings', -1500, false],
      ['2026-12-22', 'Synth Cleaner — Synth Clean Co', -40, false],
    ],
  );
  assert.deepEqual(
    envelope.sections.timeline_usd.map((e: any) => [e.date, e.amount]),
    [['2026-12-10', -200]],
  );
  // The salary rule filtered the penny and the USD stray, rolled the
  // 2026-10-25 payday into the horizon and flagged single-observation.
  const salary = envelope.sections.timeline_gbp.find((e: any) => e.inferred);
  assert.equal(
    salary.source,
    'ledger history: payroll inflow 2026-10-25 of GBP 4500.00; projected monthly',
  );

  // Pinch GBP: floor 12,000 — below before the payday and after rent;
  // rent is the only large-outflow day.
  const gbp = envelope.sections.pinch_points.gbp;
  assert.equal(gbp.starting_balance, 8500);
  assert.equal(gbp.floor, 12000);
  assert.deepEqual(
    gbp.days_below_floor.map((d: any) => [d.date, d.projected_balance]),
    [
      ['2026-11-23', 8500],
      ['2026-11-24', 8460],
      ['2026-12-21', 11040],
      ['2026-12-22', 11000],
    ],
  );
  assert.deepEqual(gbp.min_projected, { date: '2026-11-24', balance: 8460 });
  assert.equal(gbp.ending_balance, 11000);
  assert.deepEqual(gbp.large_outflow_days, [{ date: '2026-12-21', total_outflows: 1500 }]);
  assert.equal(gbp.daily.length, 30);
  // Pinch USD: no floor set — only the projection itself.
  const usd = envelope.sections.pinch_points.usd;
  assert.equal(usd.starting_balance, 1000);
  assert.equal(usd.floor, null);
  assert.deepEqual(usd.days_below_floor, []);
  assert.deepEqual(usd.min_projected, { date: '2026-12-10', balance: 800 });
  assert.equal(usd.ending_balance, 800);

  // Runway: the raw server output verbatim, reconciled against our own
  // liquid balances; only monthly category budgets passed.
  const runway = envelope.sections.runway;
  assert.equal(runway.tool, 'finance_runway');
  assert.equal(runway.appears_zero_or_empty, false);
  assert.equal(runway.verdict, null);
  assert.equal(runway.raw.startingCash, 8500);
  assert.equal(runway.parameters.projectionWeeks, 6);
  assert.deepEqual(runway.parameters.monthlyBudgets, [{ category: 'Food', amountCents: 40000 }]);
  assert.deepEqual(runway.reconciled_against.liquid_balances, { GBP: 8500, USD: 1000 });
  assert.equal(runway.reconciled_against.liquid_accounts.GBP.length, 2);
  assert.deepEqual(state.runwayRequests, [
    { asOf: TODAY, projectionWeeks: 6, monthlyBudgets: [{ category: 'Food', amountCents: 40000 }] },
  ]);

  // Utilisation: closed card excluded; the limit matched through the
  // normalized name; the charge card is balance-only with its reason.
  assert.deepEqual(
    envelope.sections.utilisation.map((c: any) => [
      c.card,
      c.balance_owed,
      c.limit,
      c.utilisation_pct,
    ]),
    [
      ['Synth Card One', 600, 2000, 30],
      ['Synth Charge Green', 300, null, null],
    ],
  );
  assert.equal(
    envelope.sections.utilisation[1].reason,
    'no preset limit (charge card) — balance only',
  );

  // FX runway: USD 1,000 at 0.79 = GBP 790 cover over a 600/3 average.
  const fx = envelope.sections.fx_runway;
  assert.equal(fx.usd_liquid_balance, 1000);
  assert.equal(fx.rate_usd_to_gbp, 0.79);
  assert.equal(fx.usd_in_gbp, 790);
  assert.equal(fx.average_monthly_gbp_spend, 200);
  assert.deepEqual(fx.spend_window, { from: '2026-08-01', to: '2026-10-31' });
  assert.equal(fx.months_of_gbp_cover, 3.95);

  // Diagnostics: bill census, the salary inference, the riding notes.
  const diag = envelope.sections.diagnostics;
  assert.equal(diag.hominem_calls, 6); // accounts, bills, salary search,
  // budgets, runway, spending — the fx fetch is not an MCP call.
  assert.equal(diag.bills.bill_count, 10);
  assert.deepEqual(
    diag.bills.variable_due.map((v: any) => [v.bill, v.date]),
    [['Synth Leccy', '2026-12-01']],
  );
  assert.equal(diag.bills.topups.length, 1);
  assert.equal(diag.bills.topups[0].bill, 'Synth Heat');
  assert.deepEqual([...diag.bills.inactive].sort(), [
    'Synth Dead Dialup',
    'Synth Ignored',
    'Synth Old Gym',
  ]);
  assert.equal(diag.inferences.length, 1);
  assert.match(diag.inferences[0], /single observation so far/);
  assert.ok(diag.notes.some((n: string) => n.includes('variable bills due in horizon')));
  assert.ok(diag.notes.some((n: string) => n.includes('top-up bills')));
  assert.ok(diag.notes.some((n: string) => n.includes('bills not active')));
  assert.ok(diag.notes.some((n: string) => n.includes('bill in unhandled currency')));
  assert.ok(diag.notes.some((n: string) => n.includes('Synth Fun (weekly)')));
  assert.equal(diag.source_errors, undefined);

  // Law 1: every MCP call (initialize + initialized + 6 calls) and the
  // FX fetch landed events rows; one ok runs row.
  const ev = rows(dbFile, 'events');
  assert.equal(ev.filter((r: any) => r.connector === 'hominem-mcp').length, 8);
  const fxEv = ev.filter((r: any) => r.connector === 'fx-rate');
  assert.equal(fxEv.length, 1);
  assert.equal(fxEv[0].ok, 1); // sqlite stores the boolean as an integer
  const runsRows = rows(dbFile, 'runs');
  assert.equal(runsRows.length, 1);
  assert.equal(runsRows[0].source, 'wealth-look');
  assert.equal(runsRows[0].status, 'ok');
});

test('look: a zero runway is named, never fabricated', async () => {
  state.runway = {
    asOfDate: TODAY,
    liquidAccounts: [],
    currencyCode: null,
    warnings: ['no forecast currency selected'],
    startingCash: 0,
    weeklyRecurringOutflow: 0,
    recurringLookbackMonths: 6,
    recurringTxnCount: 0,
    weeklyVariableAllowance: 0,
    weeks: [
      {
        week: 1,
        weekStart: HORIZON_START,
        weekEnd: '2026-11-29',
        beginningCash: 0,
        recurringOutflows: 0,
        variableAllowance: 0,
        netChange: 0,
        endingCash: 0,
      },
    ],
  };
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  const runway = envelope.sections.runway;
  assert.equal(runway.appears_zero_or_empty, true);
  assert.match(runway.verdict, /no forecast currency is selected server-side/);
  assert.match(runway.verdict, /pinch_points projection is the operative runway/);
});

test('look: an unreachable FX rate omits the section with a named note (law 1 row)', async () => {
  state.fxFail = true;
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.sections.fx_runway, undefined);
  assert.ok(
    envelope.sections.diagnostics.notes.some((n: string) =>
      n.includes('fx_runway omitted: live FX rate unreachable (HTTP 500)'),
    ),
  );
  const fxEv = rows(dbFile, 'events').filter((r: any) => r.connector === 'fx-rate');
  assert.equal(fxEv.length, 1);
  assert.equal(fxEv[0].ok, 0); // sqlite stores the boolean as an integer
});

test('look: no USD liquid means no fx_runway, and no omission note', async () => {
  state.accounts = state.accounts.filter((a: any) => a.currencyCode !== 'USD');
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.sections.fx_runway, undefined);
  assert.ok(
    !envelope.sections.diagnostics.notes.some((n: string) => n.includes('fx_runway omitted')),
  );
  // USD still projects from zero liquid against its own timeline.
  const usd = envelope.sections.pinch_points.usd;
  assert.equal(usd.starting_balance, 0);
  assert.equal(usd.ending_balance, -200);
});

test('look: a missing inputs file degrades to floorless with named notes', async () => {
  rmSync(join(dir, 'forward_look_inputs.json'));
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  const notes = envelope.sections.diagnostics.notes as string[];
  assert.ok(notes.some((n) => n.includes('inputs file absent')));
  assert.ok(notes.some((n) => n.includes('salary: no projection')));
  // No floors, no salary, every card balance-only.
  assert.equal(envelope.sections.pinch_points.gbp.floor, null);
  assert.deepEqual(envelope.sections.pinch_points.gbp.days_below_floor, []);
  assert.ok(!envelope.sections.timeline_gbp.some((e: any) => e.inferred));
  assert.ok(envelope.sections.utilisation.every((c: any) => c.limit === null));
});

test('look: a salary rule with no matching history is a named note, never a guess', async () => {
  state.searchRows = state.searchRows.filter(
    (r: any) => !String(r.description).includes('Payroll'),
  );
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.ok(
    envelope.sections.diagnostics.notes.some((n: string) =>
      n.includes('no payroll-sized inflow found for ledger search "Synth Payroll"'),
    ),
  );
  assert.ok(!envelope.sections.timeline_gbp.some((e: any) => e.inferred));
});

test('look: salary rolls to the next in-horizon payday', async () => {
  state.searchRows = [
    ...state.searchRows.filter((r: any) => !String(r.description).includes('Payroll')),
    ledgerRow({
      description: 'Synth Payroll UK salary',
      merchantName: 'Synth Payroll',
      amount: 4500,
      postedOn: '2026-11-21',
      transactionType: 'credit',
      categoryId: 'cat-income',
      categoryName: 'Income',
    }),
  ];
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const salary = envelope.sections.timeline_gbp.find((e: any) => e.inferred);
  assert.equal(salary.date, '2026-12-21');
  assert.equal(salary.amount, 4500);
  // Rent lands the same day; the projection nets both on that date.
  const day = envelope.sections.pinch_points.gbp.daily.find((d: any) => d.date === '2026-12-21');
  assert.equal(day.in, 4500);
  assert.equal(day.out, 1500);
});

test('look: a USD floor flags USD days too', async () => {
  writeInputs({ ...defaultInputs(), balance_floors: { GBP: 12000, USD: 1500 } });
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const usd = envelope.sections.pinch_points.usd;
  assert.equal(usd.floor, 1500);
  assert.equal(usd.days_below_floor.length, 30);
  assert.deepEqual(usd.days_below_floor[0], { date: HORIZON_START, projected_balance: 1000 });
});

test('look: a registered limit of zero yields no utilisation percentage', async () => {
  writeInputs({ ...defaultInputs(), credit_limits_usd: { 'Synth Charge Green': 0 } });
  const { status, envelope } = await run();
  assert.equal(status, 0);
  const green = envelope.sections.utilisation.find((c: any) => c.card === 'Synth Charge Green');
  assert.equal(green.limit, 0);
  assert.equal(green.utilisation_pct, null);
  assert.equal(green.reason, undefined);
});

test('look: tag budgets and non-monthly budgets never reach finance_runway', async () => {
  state.storedBudgets = [
    {
      id: 'bud-fun',
      categoryId: 'cat-fun',
      categoryName: 'Synth Fun',
      tagId: null,
      tagName: null,
      amountCents: 5000,
      cadence: 'weekly',
    },
    {
      id: 'bud-coffee',
      categoryId: 'cat-food',
      categoryName: 'Food',
      tagId: 'tag-1',
      tagName: 'Coffee',
      amountCents: 3000,
      cadence: 'monthly',
    },
  ];
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.deepEqual(state.runwayRequests[0].monthlyBudgets, []);
  assert.ok(
    envelope.sections.diagnostics.notes.some(
      (n: string) => n.includes('budgets not monthly-cadence') && n.includes('Synth Fun (weekly)'),
    ),
  );
});

test('look: a one-off bill outside the horizon projects nothing', async () => {
  state.bills = [
    billRow({
      id: 'b-far',
      name: 'Synth Far Fee',
      providerName: 'Synth Gov',
      expectedAmountCents: 90000,
      cadence: 'one_off',
      dueDay: null,
      dueDate: '2027-01-05',
      nextDueDate: null,
    }),
  ];
  // No salary projection either, so the GBP timeline is provably empty.
  state.searchRows = state.searchRows.filter(
    (r: any) => !String(r.description).includes('Payroll'),
  );
  const { status, envelope } = await run();
  assert.equal(status, 0);
  assert.deepEqual(envelope.sections.timeline_gbp, []);
  // The projection still runs flat across the horizon.
  const gbp = envelope.sections.pinch_points.gbp;
  assert.equal(gbp.starting_balance, 8500);
  assert.equal(gbp.ending_balance, 8500);
  assert.equal(gbp.days_below_floor.length, 30); // floor 12,000, balance 8,500
  assert.equal(envelope.sections.diagnostics.bills.bill_count, 1);
});

test('look: a failing salary search is a named source error and the run reports not-ok', async () => {
  state.failQueries = ['synth payroll'];
  const { status, envelope } = await run();
  // The archived look contract (unlike Layer 2): any source error
  // makes ok false, but the envelope still carries every other section.
  assert.equal(status, 0);
  assert.equal(envelope.ok, false);
  assert.match(envelope.sections.diagnostics.source_errors.salary, /payroll/);
  assert.ok(envelope.sections.timeline_gbp.length > 0);
  assert.ok(envelope.sections.pinch_points);
  assert.ok(envelope.sections.runway);
  assert.ok(envelope.sections.utilisation);
});

test('look: a missing backbone env fails the run by name (law 4)', async () => {
  const { status, envelope } = await run(env({ HOMINEM_MCP_TOKEN: undefined }));
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.match(envelope.error, /HOMINEM_MCP_TOKEN/);
  const runsRows = rows(dbFile, 'runs');
  assert.equal(runsRows[0].source, 'wealth-look');
  assert.equal(runsRows[0].status, 'failed');
});
