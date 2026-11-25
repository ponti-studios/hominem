/**
 * wealth-manager live balance check: mock-backend tests, synthetic-only
 * (the 2026-11-22 ruling — no personal financial data in this repo,
 * and that includes the tests). An in-process Starling HTTP server
 * serves synthetic accounts, balances and Spaces, proving the
 * starlingBalances contract: main-feed figures with Spaces reported
 * separately, per-account failures as named notes (never silence,
 * never a guessed number), a backbone failure failing the whole
 * routine, and one events row per HTTP call (law 1).
 */
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { j, rows, runWrapper, tmpDb } from './helpers.ts';

const BALANCES = 'systems/wealth-manager/balance_check.ts';

const PRIMARY_UID = '11111111-aaaa-4bbb-8ccc-111111111111';
const BUSINESS_UID = '33333333-aaaa-4bbb-8ccc-333333333333';

let dir: string;
let dbFile: string;
let starlingServer: ReturnType<typeof createServer>;
let starlingPort: number;

/** Toggleable failures so one server covers every scenario. */
const fail = {
  accounts: false,
  balanceUid: null as string | null,
  savingsGoals: false,
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-wealth-'));
  dbFile = tmpDb(dir);
  writeFileSync(join(dir, 'empty.env'), '# empty test env\n');
  fail.accounts = false;
  fail.balanceUid = null;
  fail.savingsGoals = false;

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
      if (fail.accounts) return send(500, { error: 'synthetic backbone failure' });
      return send(200, {
        accounts: [
          {
            accountUid: PRIMARY_UID,
            defaultCategory: 'cat-primary',
            currency: 'GBP',
            accountType: 'PRIMARY',
            name: 'Current',
          },
          {
            accountUid: BUSINESS_UID,
            defaultCategory: 'cat-business',
            currency: 'USD',
            accountType: 'BUSINESS',
            name: 'Business',
          },
        ],
      });
    }
    const bal = url.pathname.match(/^\/api\/v2\/accounts\/([^/]+)\/balance$/);
    if (bal) {
      if (fail.balanceUid === bal[1]) return send(500, { error: 'synthetic balance failure' });
      const body =
        bal[1] === PRIMARY_UID
          ? {
              currency: 'GBP',
              clearedBalance: { minorUnits: 123456, currency: 'GBP' },
              effectiveBalance: { minorUnits: 120000, currency: 'GBP' },
              pendingTransactions: { minorUnits: 3456, currency: 'GBP' },
              acceptedOverdraft: { minorUnits: 50000, currency: 'GBP' },
            }
          : {
              currency: 'USD',
              clearedBalance: { minorUnits: 500, currency: 'USD' },
              effectiveBalance: { minorUnits: 500, currency: 'USD' },
              pendingTransactions: { minorUnits: 0, currency: 'USD' },
              acceptedOverdraft: { minorUnits: 0, currency: 'USD' },
            };
      return send(200, body);
    }
    const goals = url.pathname.match(/^\/api\/v2\/account\/([^/]+)\/savings-goals$/);
    if (goals) {
      if (fail.savingsGoals) return send(500, { error: 'synthetic goals failure' });
      const list =
        goals[1] === PRIMARY_UID
          ? [
              {
                savingsGoalUid: 'goal-bills',
                name: 'Bills',
                totalSaved: { minorUnits: 5000, currency: 'GBP' },
                target: { minorUnits: 10000, currency: 'GBP' },
              },
              {
                savingsGoalUid: 'goal-emergency',
                name: 'Emergency',
                totalSaved: { minorUnits: 2500, currency: 'GBP' },
              },
            ]
          : [];
      return send(200, { savingsGoalList: list });
    }
    send(404, { error: 'no route' });
  });
  await new Promise<void>((resolve) => starlingServer.listen(0, '127.0.0.1', resolve));
  starlingPort = (starlingServer.address() as { port: number }).port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => starlingServer.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

function env(over: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    HOMINEM_AGENT_DB: dbFile,
    HOMINEM_AGENT_ENV_FILE: join(dir, 'empty.env'),
    STARLING_API_TOKEN: 'starling-token',
    STARLING_API_BASE: `http://127.0.0.1:${starlingPort}`,
    ...over,
  };
}

test('full run: accounts, balances, Spaces, totals — one events row per call', async () => {
  const r = await runWrapper(BALANCES, env(), []);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Current \(GBP\)/);
  assert.match(r.stdout, /£1,234\.56/); // cleared, as the bank reports it
  assert.match(r.stdout, /£1,200\.00/); // effective
  assert.match(r.stdout, /£34\.56/); // pending
  assert.match(r.stdout, /£500\.00/); // overdraft limit
  assert.match(r.stdout, /Bills\s+£50\.00 \(target £100\.00\)/);
  assert.match(r.stdout, /Emergency\s+£25\.00$/m);
  assert.match(r.stdout, /Cleared \+ Spaces: +£1,309\.56/); // 1234.56 + 50 + 25
  assert.match(r.stdout, /Business \(USD\)/);
  assert.match(r.stdout, /\$5\.00/);
  assert.match(r.stdout, /All accounts, cleared \+ Spaces:/);
  assert.match(r.stdout, /GBP: £1,309\.56/);
  assert.match(r.stdout, /USD: \$5\.00/);
  assert.doesNotMatch(r.stdout, /Notes:/);

  // Audit (law 1): 5 HTTP calls -> 5 starling events rows, all ok.
  const evs = rows(dbFile, 'events').filter((e) => e.connector === 'starling');
  assert.equal(evs.length, 5);
  assert.deepEqual(
    evs.map((e) => j(e.command as string)),
    [
      ['GET', '/api/v2/accounts'],
      ['GET', `/api/v2/accounts/${PRIMARY_UID}/balance`],
      ['GET', `/api/v2/account/${PRIMARY_UID}/savings-goals`],
      ['GET', `/api/v2/accounts/${BUSINESS_UID}/balance`],
      ['GET', `/api/v2/account/${BUSINESS_UID}/savings-goals`],
    ],
  );
  assert.ok(evs.every((e) => e.ok === 1));

  const runs = rows(dbFile, 'runs');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].source, 'wealth-balances');
  assert.equal(runs[0].status, 'ok');
  assert.equal(runs[0].exit_code, 0);
  assert.equal(runs[0].message, '2 account(s), 0 note(s)');
});

test('a Spaces read failing is a named note, never silence', async () => {
  fail.savingsGoals = true;
  const r = await runWrapper(BALANCES, env(), []);
  assert.equal(r.status, 0); // partial-ok, like the brief
  assert.match(r.stdout, /Current \(GBP\)/);
  assert.match(r.stdout, /£1,234\.56/);
  assert.match(r.stdout, /Notes:/);
  assert.ok(r.stdout.includes('savings goals unavailable for Current: starling /api/v2/account/'));
  assert.ok(r.stdout.includes('savings goals unavailable for Business'));
  assert.ok(r.stdout.includes('returned HTTP 500'));
  // Balances still render; no Spaces section anywhere.
  assert.doesNotMatch(r.stdout, /Bills/);

  const evs = rows(dbFile, 'events').filter((e) => e.connector === 'starling');
  assert.equal(evs.length, 5);
  assert.equal(evs.filter((e) => e.is_error === 1).length, 2); // both goals reads, named
});

test('a per-account balance failure skips that account with a named note', async () => {
  fail.balanceUid = BUSINESS_UID;
  const r = await runWrapper(BALANCES, env(), []);
  assert.equal(r.status, 0); // the account is skipped, not guessed
  assert.match(r.stdout, /Current \(GBP\)/);
  assert.match(r.stdout, /£1,234\.56/);
  assert.doesNotMatch(r.stdout, /Business \(USD\)/);
  assert.ok(r.stdout.includes('balance unavailable for Business: starling /api/v2/accounts/'));
  assert.ok(r.stdout.includes('returned HTTP 500'));
  // Totals cover only the account that answered.
  assert.match(r.stdout, /GBP: £1,309\.56/);
  assert.ok(!r.stdout.includes('USD:'));

  const evs = rows(dbFile, 'events').filter((e) => e.connector === 'starling');
  assert.equal(evs.length, 4); // accounts + primary balance + primary goals + failed business balance
  assert.equal(evs.filter((e) => e.is_error === 1).length, 1);
});

test('a failed backbone call fails the whole routine — no half-empty answer', async () => {
  fail.accounts = true;
  const r = await runWrapper(BALANCES, env(), []);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /\/api\/v2\/accounts returned HTTP 500/);

  const evs = rows(dbFile, 'events').filter((e) => e.connector === 'starling');
  assert.equal(evs.length, 1);
  assert.equal(evs[0].is_error, 1);

  const runs = rows(dbFile, 'runs');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, 'failed');
  assert.equal(runs[0].exit_code, 1);
});

test('a missing token fails by name (law 4) before any call is made', async () => {
  const r = await runWrapper(BALANCES, { ...env(), STARLING_API_TOKEN: undefined }, []);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.ok(out.error.includes('STARLING_API_TOKEN is not set'));
  assert.equal(rows(dbFile, 'events').length, 0); // no call was attempted
  assert.equal(rows(dbFile, 'runs')[0].status, 'failed');
});
