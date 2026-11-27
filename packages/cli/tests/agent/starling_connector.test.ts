import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { startMockServer } from './fixtures/mock-server.ts';
import { starlingEnv, starlingRoutes } from './fixtures/starling.ts';
import { j, rows, runWrapper, tmpDb } from './helpers.ts';

const STARLING = 'connectors/starling/starling.ts';

let dir: string;
let dbFile: string;
let server: Awaited<ReturnType<typeof startMockServer>>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-starling-'));
  dbFile = tmpDb(dir);
  server = await startMockServer(starlingRoutes);
});

afterEach(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

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
  const result = await runWrapper(STARLING, starlingEnv(server.url, dbFile), ['accounts']);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.data[0].accountUid, 'acc-current');
  const events = rows(dbFile, 'events');
  assert.equal(events.length, 1);
  assert.deepEqual(j(events[0]?.command), ['GET', '/api/v2/accounts']);
});

test('starling: balances include cleared and Space totals', async () => {
  const result = await runWrapper(STARLING, starlingEnv(server.url, dbFile), ['balances']);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.data[0].effective, 120);
  assert.equal(body.data[0].cleared, 125);
  assert.equal(body.data[0].spaces[0].name, 'Bills');
  assert.equal(body.data[0].spaces[0].saved, 30);
});

test('starling: transactions use the dated window and include Savings Goals', async () => {
  const result = await runWrapper(STARLING, starlingEnv(server.url, dbFile), [
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
