import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import {
  plaidExchangePublicToken,
  plaidLinkTokenCreate,
  plaidSetupStatus,
  plaidTransactionsWindow,
} from '../../src/agent/systems/wealth-manager/plaid.ts';
import { rows, runWrapper, tmpDb } from './helpers.ts';

const PLAID = 'connectors/plaid/plaid.ts';

let dir: string;
let dbFile: string;
let envFile: string;
let server: ReturnType<typeof createServer>;
let port: number;

function send(res: ServerResponse, code: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': body.length });
  res.end(body);
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-plaid-'));
  dbFile = tmpDb(dir);
  envFile = join(dir, 'env');
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://plaid');
    if (url.pathname === '/link/token/create') {
      send(res, 200, { link_token: 'link-synthetic', expiration: '2030-01-01T00:00:00Z' });
      return;
    }
    if (url.pathname === '/item/public_token/exchange') {
      send(res, 200, { access_token: 'access-synthetic', item_id: 'item-synthetic' });
      return;
    }
    if (url.pathname === '/accounts/get') {
      send(res, 200, {
        institutions: [{ display_name: 'Synth Bank', credential_id: 'item-synthetic' }],
        accounts: [
          {
            account_id: 'account-synthetic',
            name: 'Checking',
            mask: '1234',
            type: 'depository',
            balances: { current: 42.5, iso_currency_code: 'USD' },
          },
        ],
      });
      return;
    }
    if (url.pathname === '/transactions/get') {
      send(res, 200, {
        accounts: [],
        transactions: [
          {
            account_id: 'account-synthetic',
            date: '2026-11-20',
            pending: false,
            merchant_name: 'Synthetic Coffee',
            amount: 4.25,
            iso_currency_code: 'USD',
          },
        ],
        total_transactions: 1,
      });
      return;
    }
    send(res, 404, { error_code: 'NOT_FOUND', error_message: 'synthetic route missing' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
  delete process.env.HOMINEM_AGENT_ENV_FILE;
  delete process.env.PLAID_CLIENT_ID;
  delete process.env.PLAID_SECRET;
  delete process.env.PLAID_ENV;
  delete process.env.PLAID_API_BASE;
  delete process.env.PLAID_ACCESS_TOKEN;
  delete process.env.PLAID_ITEM_ID;
});

function apiEnv(): Record<string, string> {
  return {
    HOMINEM_AGENT_DB: dbFile,
    HOMINEM_AGENT_ENV_FILE: envFile,
    PLAID_CLIENT_ID: 'test-client',
    PLAID_SECRET: 'test-secret',
    PLAID_ACCESS_TOKEN: 'test-access',
    PLAID_ITEM_ID: 'item-synthetic',
    PLAID_ENV: 'sandbox',
    PLAID_API_BASE: `http://127.0.0.1:${port}`,
  };
}

test('plaid: status reports configuration without secrets', async () => {
  const result = await runWrapper(PLAID, apiEnv(), ['status']);
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.environment, 'sandbox');
  assert.equal(body.clientIdConfigured, true);
  assert.equal(body.secretConfigured, true);
  assert.equal(body.accessTokenConfigured, true);
  assert.doesNotMatch(result.stdout, /test-secret|test-access|test-client/);
});

test('plaid: accounts is read and audited', async () => {
  const result = await runWrapper(PLAID, apiEnv(), ['accounts']);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.data.accounts[0].mask, '1234');
  const events = rows(dbFile, 'events');
  assert.equal(events.length, 1);
  assert.equal(events[0]?.service, 'accounts');
  assert.equal(events[0]?.http_status, 200);
});

test('plaid: transactions returns dated rows and never logs the access token', async () => {
  const result = await runWrapper(PLAID, apiEnv(), [
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
  process.env.PLAID_API_BASE = `http://127.0.0.1:${port}`;

  const link = await plaidLinkTokenCreate();
  assert.equal(link.linkToken, 'link-synthetic');
  const exchange = await plaidExchangePublicToken('public-synthetic');
  assert.equal(exchange.itemId, 'item-synthetic');

  const stored = readFileSync(envFile, 'utf8');
  assert.match(stored, /PLAID_ACCESS_TOKEN=access-synthetic/);
  assert.match(stored, /PLAID_ITEM_ID=item-synthetic/);
  assert.equal(plaidSetupStatus().accessTokenConfigured, true);
});
