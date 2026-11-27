import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import {
  plaidExchangePublicToken,
  plaidLinkTokenCreate,
  plaidSetupStatus,
} from '../../src/agent/connectors/plaid/client.ts';
import { startMockServer } from './fixtures/mock-server.ts';
import { plaidEnv, plaidRoutes } from './fixtures/plaid.ts';
import { rows, runWrapper, tmpDb } from './helpers.ts';

const PLAID = 'connectors/plaid/plaid.ts';

let dir: string;
let dbFile: string;
let envFile: string;
let server: Awaited<ReturnType<typeof startMockServer>>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-plaid-'));
  dbFile = tmpDb(dir);
  envFile = join(dir, 'env');
  server = await startMockServer(plaidRoutes);
});

afterEach(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.HOMINEM_AGENT_ENV_FILE;
  delete process.env.PLAID_CLIENT_ID;
  delete process.env.PLAID_SECRET;
  delete process.env.PLAID_ENV;
  delete process.env.PLAID_API_BASE;
  delete process.env.PLAID_ACCESS_TOKEN;
  delete process.env.PLAID_ITEM_ID;
});

test('plaid: status reports configuration without secrets', async () => {
  const result = await runWrapper(PLAID, plaidEnv(server.url, dbFile, envFile), ['status']);
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.environment, 'sandbox');
  assert.equal(body.clientIdConfigured, true);
  assert.equal(body.secretConfigured, true);
  assert.equal(body.accessTokenConfigured, true);
  assert.doesNotMatch(result.stdout, /test-secret|test-access|test-client/);
});

test('plaid: accounts is read and audited', async () => {
  const result = await runWrapper(PLAID, plaidEnv(server.url, dbFile, envFile), ['accounts']);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.data.accounts[0].mask, '1234');
  const events = rows(dbFile, 'events');
  assert.equal(events.length, 1);
  assert.equal(events[0]?.service, 'accounts');
  assert.equal(events[0]?.http_status, 200);
});

test('plaid: transactions returns dated rows and never logs the access token', async () => {
  const result = await runWrapper(PLAID, plaidEnv(server.url, dbFile, envFile), [
    'transactions',
    '--since',
    '2026-11-20',
    '--until',
    '2026-11-25',
  ]);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.data.transactions[0].merchant_name, 'Synthetic Coffee');
  const events = rows(dbFile, 'events');
  assert.equal(events.length, 2);
  assert.ok(!JSON.stringify(events).includes('test-access'));
});

test('plaid: link and exchange use mock endpoints and persist secrets only to env', async () => {
  process.env.HOMINEM_AGENT_ENV_FILE = envFile;
  process.env.PLAID_CLIENT_ID = 'test-client';
  process.env.PLAID_SECRET = 'test-secret';
  process.env.PLAID_ENV = 'sandbox';
  process.env.PLAID_API_BASE = server.url;

  const link = await plaidLinkTokenCreate();
  assert.equal(link.linkToken, 'link-synthetic');
  const exchange = await plaidExchangePublicToken('public-synthetic');
  assert.equal(exchange.itemId, 'item-synthetic');

  const stored = readFileSync(envFile, 'utf8');
  assert.match(stored, /PLAID_ACCESS_TOKEN=access-synthetic/);
  assert.match(stored, /PLAID_ITEM_ID=item-synthetic/);
  assert.equal(plaidSetupStatus().accessTokenConfigured, true);
});
