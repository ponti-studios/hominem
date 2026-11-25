/**
 * wealth-manager seed: mock-backend tests, synthetic only (the
 * 2026-11-22 ruling — no personal financial data in this repo,
 * fixtures included). Two in-process backends: a Starling HTTP server
 * serving a synthetic accounts list, and a Hominem MCP JSON-RPC
 * server serving finance_doctrine_import + finance_account_create
 * with identity memory (so an idempotent second run comes back
 * created:false / status "unchanged", exactly like the live server).
 * Proves: the doctrine leg (import once, named skip when
 * WEALTH_SEED_DOCTRINE is unset, loud failure on an unreadable or
 * malformed file BEFORE any external call), the accounts leg
 * (identity from the bank, provider+providerAccountId, the
 * PRIMARY→checking / saver→savings mapping, created:false on the
 * re-run), the any-create-failure-fails-the-run semantics, and law 1:
 * one events row per call, one runs row for the routine.
 */
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { j, rows, runWrapper, tmpDb } from './helpers.ts';

const SEED = 'systems/wealth-manager/seed.ts';

const CURRENT_UID = '11111111-aaaa-4bbb-8ccc-111111111111';
const SAVER_UID = '22222222-aaaa-4bbb-8ccc-222222222222';

/** Synthetic doctrine — shape-faithful, contents invented. */
const SYNTH_DOCTRINE = {
  version: 1,
  merchantRules: [
    { matchMode: 'contains', pattern: 'Synth Coffee', category: 'Food', tag: 'Coffee' },
  ],
  tagRules: [],
  amountRules: [],
  transferMerchants: [],
  incomePatterns: [{ pattern: 'Synth Payroll' }],
  coffeePatterns: ['Synth Roasters'],
  lenses: [],
};

let dir: string;
let dbFile: string;
let starlingServer: ReturnType<typeof createServer>;
let starlingPort: number;
let mcpServer: ReturnType<typeof createServer>;
let mcpPort: number;

const fail = {
  accounts: false,
  create: false,
};
const seenIdentities = new Set<string>();
const toolCalls: string[] = [];

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-seed-'));
  dbFile = tmpDb(dir);
  writeFileSync(join(dir, 'empty.env'), '# empty test env\n');
  fail.accounts = false;
  fail.create = false;
  seenIdentities.clear();
  toolCalls.length = 0;

  starlingServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const send = (code: number, payload: unknown) => {
      const body = JSON.stringify(payload);
      res.writeHead(code, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
    };
    if (req.headers.authorization !== 'Bearer starling-token')
      return send(401, { error: 'bad token' });
    if (req.url === '/api/v2/accounts') {
      if (fail.accounts) return send(500, { error: 'synthetic backbone failure' });
      return send(200, {
        accounts: [
          {
            accountUid: CURRENT_UID,
            defaultCategory: 'cat-current',
            currency: 'GBP',
            accountType: 'PRIMARY',
            name: 'Synth Current',
          },
          {
            accountUid: SAVER_UID,
            defaultCategory: 'cat-saver',
            currency: 'GBP',
            accountType: 'FIXED_TERM_SAVINGS',
            name: 'Synth Saver',
          },
        ],
      });
    }
    send(404, { error: 'no route' });
  });
  await new Promise<void>((resolve) => starlingServer.listen(0, '127.0.0.1', resolve));
  starlingPort = (starlingServer.address() as { port: number }).port;

  mcpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
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
          { 'mcp-session-id': 'sess-mock-seed' },
        );
      }
      if (body.method === 'notifications/initialized') {
        res.writeHead(202);
        return res.end();
      }
      if (body.method === 'tools/call') {
        const name = body.params?.name as string;
        const args = body.params?.arguments ?? {};
        toolCalls.push(name);
        if (fail.create && name === 'finance_account_create') {
          return send(200, {
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{ type: 'text', text: 'synthetic create failure' }],
              structuredContent: { error: 'synthetic create failure' },
              isError: true,
            },
          });
        }
        if (name === 'finance_doctrine_import') {
          const first = !seenIdentities.has('__doctrine__');
          seenIdentities.add('__doctrine__');
          return send(200, {
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{ type: 'text', text: 'ok' }],
              structuredContent: {
                fingerprint: 'fp-synth-doctrine',
                status: first ? 'created' : 'unchanged',
                updatedAt: '2026-11-22T09:00:00.000Z',
                dryRun: false,
                ruleCounts: {
                  merchantRules: 1,
                  tagRules: 0,
                  amountRules: 0,
                  transferMerchants: 0,
                  incomePatterns: 1,
                  coffeePatterns: 1,
                  lenses: 0,
                },
              },
              isError: false,
            },
          });
        }
        if (name === 'finance_account_create') {
          assert.equal(args.provider, 'starling');
          const key = String(args.providerAccountId);
          const first = !seenIdentities.has(key);
          seenIdentities.add(key);
          return send(200, {
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{ type: 'text', text: 'ok' }],
              structuredContent: {
                id: first ? `acc-${key.slice(0, 8)}` : `acc-${key.slice(0, 8)}`,
                name: args.name,
                currencyCode: args.currencyCode,
                allowedCurrencies: [args.currencyCode],
                status: 'open',
                includeInNetWorth: true,
                provider: 'starling',
                providerAccountId: key,
                created: first,
                dryRun: false,
              },
              isError: false,
            },
          });
        }
        send(404, {
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32601, message: `no tool ${name}` },
        });
      }
      send(404, { error: 'no route' });
    });
  });
  await new Promise<void>((resolve) => mcpServer.listen(0, '127.0.0.1', resolve));
  mcpPort = (mcpServer.address() as { port: number }).port;
});

afterEach(async () => {
  await Promise.all([
    new Promise<void>((resolve) => starlingServer.close(() => resolve())),
    new Promise<void>((resolve) => mcpServer.close(() => resolve())),
  ]);
  rmSync(dir, { recursive: true, force: true });
});

function env(over: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    HOMINEM_AGENT_DB: dbFile,
    HOMINEM_AGENT_ENV_FILE: join(dir, 'empty.env'),
    STARLING_API_TOKEN: 'starling-token',
    STARLING_API_BASE: `http://127.0.0.1:${starlingPort}`,
    HOMINEM_MCP_URL: `http://127.0.0.1:${mcpPort}/api/mcp`,
    HOMINEM_MCP_TOKEN: 'hmt-test',
    ...over,
  };
}

test('full run: doctrine imported once, both accounts created, one events row per call', async () => {
  const doctrinePath = join(dir, 'doctrine.json');
  writeFileSync(doctrinePath, JSON.stringify(SYNTH_DOCTRINE));
  const r = await runWrapper(SEED, env({ WEALTH_SEED_DOCTRINE: doctrinePath }), []);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.doctrine.status, 'created');
  assert.equal(out.doctrine.fingerprint, 'fp-synth-doctrine');
  assert.equal(out.doctrine.ruleCounts.merchantRules, 1);
  assert.equal(out.accounts.length, 2);
  assert.equal(out.accounts[0].name, 'Synth Current');
  assert.equal(out.accounts[0].provider_account_id, CURRENT_UID);
  assert.equal(out.accounts[0].created, true);
  assert.equal(out.accounts[1].name, 'Synth Saver');
  assert.ok(out.accounts[1].id);

  // Doctrine before accounts, in tool-call order.
  assert.deepEqual(toolCalls, [
    'finance_doctrine_import',
    'finance_account_create',
    'finance_account_create',
  ]);

  // Audit (law 1): 1 starling GET + initialize + initialized + 3 tool calls.
  const sEvents = rows(dbFile, 'events').filter((e) => e.connector === 'starling');
  assert.equal(sEvents.length, 1);
  assert.deepEqual(j(sEvents[0].command as string), ['GET', '/api/v2/accounts']);
  const hEvents = rows(dbFile, 'events').filter((e) => e.connector === 'hominem-mcp');
  assert.equal(hEvents.length, 5); // initialize + initialized + doctrine + 2 creates
  assert.ok(hEvents.every((e) => e.ok === 1));

  const runs = rows(dbFile, 'runs');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].source, 'wealth-seed');
  assert.equal(runs[0].status, 'ok');
  assert.equal(runs[0].message, 'doctrine created, 2 created, 0 existing');
});

test('re-run is idempotent: accounts come back created:false, doctrine unchanged', async () => {
  const doctrinePath = join(dir, 'doctrine.json');
  writeFileSync(doctrinePath, JSON.stringify(SYNTH_DOCTRINE));
  const first = await runWrapper(SEED, env({ WEALTH_SEED_DOCTRINE: doctrinePath }), []);
  assert.equal(first.status, 0);
  const second = await runWrapper(SEED, env({ WEALTH_SEED_DOCTRINE: doctrinePath }), []);
  assert.equal(second.status, 0);
  const out = JSON.parse(second.stdout);
  assert.equal(out.doctrine.status, 'unchanged');
  assert.equal(out.accounts.length, 2);
  assert.ok(out.accounts.every((a: { created: boolean }) => a.created === false));

  const runs = rows(dbFile, 'runs');
  assert.equal(runs.length, 2);
  assert.equal(runs[1].message, 'doctrine unchanged, 0 created, 2 existing');
});

test('the account-type mapping is deliberate: PRIMARY→checking, saver→savings', async () => {
  const r = await runWrapper(SEED, env(), []);
  assert.equal(r.status, 0);
  const hEvents = rows(dbFile, 'events').filter((e) => e.connector === 'hominem-mcp');
  const creates = hEvents.filter((e) => j(e.params as string) === 'finance_account_create');
  assert.equal(creates.length, 2);
  const bodies = creates.map((e) => j(e.json_body as string));
  assert.equal(bodies[0].name, 'finance_account_create');
  assert.equal(bodies[0].arguments.accountType, 'checking'); // PRIMARY
  assert.equal(bodies[1].arguments.accountType, 'savings'); // FIXED_TERM_SAVINGS
  assert.equal(bodies[0].arguments.provider, 'starling');
  assert.equal(bodies[0].arguments.providerAccountId, CURRENT_UID);
});

test('WEALTH_SEED_DOCTRINE unset: doctrine skipped with a named note, accounts still seeded', async () => {
  const r = await runWrapper(SEED, env(), []);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.doctrine, null);
  assert.match(out.doctrine_note, /no WEALTH_SEED_DOCTRINE set/);
  assert.match(out.doctrine_note, /finance_doctrine_import/);
  assert.equal(out.accounts.length, 2);
  assert.ok(!toolCalls.includes('finance_doctrine_import'));
});

test('an unreadable doctrine file fails loudly before any external call', async () => {
  const r = await runWrapper(SEED, env({ WEALTH_SEED_DOCTRINE: join(dir, 'nope.json') }), []);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /WEALTH_SEED_DOCTRINE points at an unreadable file/);
  assert.match(out.error, /nope\.json/);
  assert.equal(rows(dbFile, 'events').length, 0); // nothing was attempted
  assert.equal(rows(dbFile, 'runs')[0].status, 'failed');
});

test('a malformed doctrine file fails loudly before any external call', async () => {
  const doctrinePath = join(dir, 'doctrine.json');
  writeFileSync(doctrinePath, '{not json');
  const r = await runWrapper(SEED, env({ WEALTH_SEED_DOCTRINE: doctrinePath }), []);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /not valid JSON/);
  assert.equal(rows(dbFile, 'events').length, 0);
  assert.equal(rows(dbFile, 'runs')[0].status, 'failed');
});

test('a failed account create fails the whole run — no half-seeded registry', async () => {
  fail.create = true;
  const r = await runWrapper(SEED, env(), []);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /finance_account_create returned an error/);
  assert.match(out.error, /synthetic create failure/);

  // The failing call is visible in the audit: its event row exists and
  // the response column carries the tool error (transport-level ok, the
  // run row records the failure — same semantics as the close's
  // any-tool-failure case).
  const hEvents = rows(dbFile, 'events').filter((e) => e.connector === 'hominem-mcp');
  assert.equal(hEvents.length, 3); // initialize + initialized + the failed create
  const failed = hEvents.find((e) => j(e.params as string) === 'finance_account_create');
  assert.ok(failed, 'the failing create landed an events row');
  assert.ok(JSON.stringify(j(failed!.response as string)).includes('synthetic create failure'));
  assert.equal(rows(dbFile, 'runs')[0].status, 'failed');
});

test('a failed Starling backbone fails the run with one named error event', async () => {
  fail.accounts = true;
  const r = await runWrapper(SEED, env(), []);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.match(out.error, /\/api\/v2\/accounts returned HTTP 500/);

  const sEvents = rows(dbFile, 'events').filter((e) => e.connector === 'starling');
  assert.equal(sEvents.length, 1);
  assert.equal(sEvents[0].is_error, 1);
  assert.equal(rows(dbFile, 'runs')[0].status, 'failed');
});

test('a missing Starling token fails by name (law 4) before any call', async () => {
  const r = await runWrapper(SEED, { ...env(), STARLING_API_TOKEN: undefined }, []);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.ok(out.error.includes('STARLING_API_TOKEN is not set'));
  assert.equal(rows(dbFile, 'events').length, 0);
  assert.equal(rows(dbFile, 'runs')[0].status, 'failed');
});

test('a missing Hominem token fails by name (law 4) before any call', async () => {
  const r = await runWrapper(SEED, { ...env(), HOMINEM_MCP_TOKEN: undefined }, []);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.ok(out.error.includes('HOMINEM_MCP_TOKEN is not set'));
  assert.equal(rows(dbFile, 'events').length, 0);
  assert.equal(rows(dbFile, 'runs')[0].status, 'failed');
});
