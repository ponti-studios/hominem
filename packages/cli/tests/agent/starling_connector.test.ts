import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { j, rows, runWrapper, tmpDb } from './helpers.ts';

const STARLING = 'connectors/starling/starling.ts';

let dir: string;
let dbFile: string;
let server: ReturnType<typeof createServer>;
let port: number;

function send(res: ServerResponse, code: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': body.length });
  res.end(body);
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-starling-'));
  dbFile = tmpDb(dir);
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.headers.authorization !== 'Bearer test-token') {
      send(res, 401, { error: 'missing synthetic token' });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v2/accounts') {
      send(res, 200, {
        accounts: [
          {
            accountUid: 'acc-current',
            defaultCategory: 'cat-current',
            currency: 'GBP',
            accountType: 'PRIMARY',
            name: 'Synthetic Current',
          },
        ],
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v2/accounts/acc-current/balance') {
      send(res, 200, {
        currency: 'GBP',
        clearedBalance: { minorUnits: 12500 },
        effectiveBalance: { minorUnits: 12000 },
        pendingTransactions: { minorUnits: -500 },
        acceptedOverdraft: { minorUnits: 0 },
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v2/account/acc-current/savings-goals') {
      send(res, 200, {
        savingsGoalList: [
          {
            savingsGoalUid: 'goal-bills',
            name: 'Bills',
            totalSaved: { minorUnits: 3000 },
            target: { minorUnits: 5000 },
          },
        ],
      });
      return;
    }
    if (
      req.method === 'GET' &&
      url.pathname === '/api/v2/feed/account/acc-current/category/cat-current/transactions-between'
    ) {
      send(res, 200, {
        feedItems: [
          {
            feedItemUid: 'feed-1',
            amount: { minorUnits: 1299, currency: 'GBP' },
            direction: 'OUT',
            transactionTime: '2026-11-24T12:00:00Z',
            counterPartyName: 'Synthetic Shop',
            reference: 'card',
            source: 'CARD',
            status: 'SETTLED',
          },
        ],
      });
      return;
    }
    if (
      req.method === 'GET' &&
      url.pathname === '/api/v2/feed/account/acc-current/category/goal-bills/transactions-between'
    ) {
      send(res, 200, { feedItems: [] });
      return;
    }
    send(res, 404, { error: `no mock route for ${req.method} ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

function env(): Record<string, string> {
  return {
    HOMINEM_AGENT_DB: dbFile,
    STARLING_API_TOKEN: 'test-token',
    STARLING_API_BASE: `http://127.0.0.1:${port}`,
  };
}

test('starling: missing token fails without HTTP or event calls', async () => {
  const result = await runWrapper(STARLING, { HOMINEM_AGENT_DB: dbFile, STARLING_API_TOKEN: '' }, [
    'accounts',
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /STARLING_API_TOKEN/);
  assert.equal(rows(dbFile, 'events').length, 0);
  assert.equal(rows(dbFile, 'runs').length, 1);
});

test('starling: accounts returns identity and audit rows', async () => {
  const result = await runWrapper(STARLING, env(), ['accounts']);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.data[0].accountUid, 'acc-current');
  const events = rows(dbFile, 'events');
  assert.equal(events.length, 1);
  assert.deepEqual(j(events[0]?.command), ['GET', '/api/v2/accounts']);
});

test('starling: balances include cleared and Space totals', async () => {
  const result = await runWrapper(STARLING, env(), ['balances']);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.data[0].effective, 120);
  assert.equal(body.data[0].cleared, 125);
  assert.equal(body.data[0].spaces[0].name, 'Bills');
  assert.equal(body.data[0].spaces[0].saved, 30);
});

test('starling: transactions use the dated window and include Savings Goals', async () => {
  const result = await runWrapper(STARLING, env(), [
    'transactions',
    '--since',
    '2026-11-20',
    '--until',
    '2026-11-25',
  ]);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.data[0].merchant, 'Synthetic Shop');
  assert.equal(body.data[0].amount, -12.99);
  assert.equal(body.data[0].accountUid, 'acc-current');
});
