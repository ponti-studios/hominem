/** Connector wrapper ports: mock-backend tests (gws, notion, linear, ponti). */
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, test } from 'node:test';

import { j, makeMockCli, rows, runWrapper, tmpDb } from './helpers.ts';

let dir: string;
let dbFile: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-conn-'));
  dbFile = tmpDb(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- gws

const GWS = 'connectors/gws-log/gws_log.ts';

test('gws: missing GWS_CLI is a named error', async () => {
  const p = await runWrapper(GWS, { HOMINEM_AGENT_DB: dbFile, GWS_CLI: undefined }, [
    'gmail',
    'search',
  ]);
  assert.equal(p.status, 2);
  assert.match(p.stderr, /GWS_CLI/);
});

test('gws: success passthrough and audit row', async () => {
  const mock = makeMockCli(
    dir,
    'ok',
    `
console.log(JSON.stringify({ count: 1, argv: process.argv.slice(2) }));`,
  );
  const p = await runWrapper(GWS, { HOMINEM_AGENT_DB: dbFile, GWS_CLI: mock }, [
    'gmail',
    'search',
    '--params',
    '{"q": "test"}',
  ]);
  assert.equal(p.status, 0);
  const payload = JSON.parse(p.stdout);
  assert.deepEqual(payload.argv, ['gmail', 'search', '--params', '{"q": "test"}']);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['connector'], 'gws');
  assert.equal(row['service'], 'gmail');
  assert.equal(row['ok'], 1);
  assert.equal(row['is_error'], 0);
  assert.equal(row['http_status'], 200);
  assert.deepEqual(j(row['params']), { q: 'test' });
  assert.equal(j(row['response']).count, 1);
});

test('gws: google error payload marks error with http status', async () => {
  const mock = makeMockCli(
    dir,
    'http',
    `
console.log(JSON.stringify({ error: { code: 429, status: "RATE_LIMIT", message: "slow down" } }));`,
  );
  const p = await runWrapper(GWS, { HOMINEM_AGENT_DB: dbFile, GWS_CLI: mock }, [
    'calendar',
    'events',
  ]);
  assert.equal(p.status, 0); // in-band error
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 1);
  assert.equal(row['ok'], 0);
  assert.equal(row['http_status'], 429);
  assert.equal(j(row['error']).error, 'RATE_LIMIT');
});

test('gws: nonzero exit marks error', async () => {
  const mock = makeMockCli(
    dir,
    'fail',
    `
process.stderr.write("connection refused\\n"); process.exit(3);`,
  );
  const p = await runWrapper(GWS, { HOMINEM_AGENT_DB: dbFile, GWS_CLI: mock }, ['drive', 'ls']);
  assert.equal(p.status, 3);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 1);
  assert.equal(row['exit_code'], 3);
  assert.equal(j(row['error']).error, 'cli_exit_nonzero');
});

test('gws: schema routing and unrouted service', async () => {
  const mock = makeMockCli(dir, 'ok2', `console.log("{}");`);
  await runWrapper(GWS, { HOMINEM_AGENT_DB: dbFile, GWS_CLI: mock }, ['schema', 'gmail.messages']);
  await runWrapper(GWS, { HOMINEM_AGENT_DB: dbFile, GWS_CLI: mock }, ['other', 'thing']);
  const services = rows(dbFile, 'events').map((r) => r['service']);
  assert.deepEqual(services, ['gmail', 'other']);
});

// ---------------------------------------------------------------- notion

const NOTION = 'connectors/notion-log/notion_log.ts';

test('notion: missing NOTION_CLI is a named error', async () => {
  const p = await runWrapper(NOTION, { HOMINEM_AGENT_DB: dbFile, NOTION_CLI: undefined }, ['call']);
  assert.equal(p.status, 2);
  assert.match(p.stderr, /NOTION_CLI/);
});

test('notion: success with tool in service column and params', async () => {
  const mock = makeMockCli(
    dir,
    'nok',
    `
console.log(JSON.stringify({ ok: true, result: { isError: false,
  content: [{ text: JSON.stringify({ id: "page-1" }) }] } }));`,
  );
  const p = await runWrapper(NOTION, { HOMINEM_AGENT_DB: dbFile, NOTION_CLI: mock }, [
    'call',
    '--name',
    'page_get',
    '--arguments-json',
    '{"page": "doctrine"}',
  ]);
  assert.equal(p.status, 0);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['connector'], 'notion');
  assert.equal(row['service'], 'page_get');
  assert.equal(row['ok'], 1);
  assert.equal(row['is_error'], 0);
  assert.equal(row['http_status'], 200);
  assert.deepEqual(j(row['params']), { tool: 'page_get', arguments: { page: 'doctrine' } });
});

test('notion: APIResponseError payload marks error with status', async () => {
  const mock = makeMockCli(
    dir,
    'nerr',
    `
console.log(JSON.stringify({ ok: true, result: { isError: false,
  content: [{ text: JSON.stringify({ name: "APIResponseError", code: "unauthorized",
    status: 401, message: "bad token" }) }] } }));`,
  );
  const p = await runWrapper(NOTION, { HOMINEM_AGENT_DB: dbFile, NOTION_CLI: mock }, [
    'call',
    '--name',
    't',
  ]);
  assert.equal(p.status, 0);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 0); // faithful: envelope isError false; the error is in-band
  assert.equal(row['http_status'], 401);
  assert.equal(j(row['error']).error, 'unauthorized');
  assert.equal(j(row['error']).message, 'bad token');
});

test('notion: bare status field is not an error', async () => {
  const mock = makeMockCli(
    dir,
    'nstat',
    `
console.log(JSON.stringify({ ok: true, result: { isError: false,
  content: [{ text: JSON.stringify({ id: "x", status: "In Progress" }) }] } }));`,
  );
  await runWrapper(NOTION, { HOMINEM_AGENT_DB: dbFile, NOTION_CLI: mock }, ['call', '--name', 't']);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 0);
  assert.equal(row['ok'], 1);
});

test('notion: isError envelope', async () => {
  const mock = makeMockCli(
    dir,
    'nis',
    `
console.log(JSON.stringify({ ok: true, result: { isError: true, content: [] } }));`,
  );
  await runWrapper(NOTION, { HOMINEM_AGENT_DB: dbFile, NOTION_CLI: mock }, ['call', '--name', 't']);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 1);
  assert.equal(j(row['error']).error, 'isError');
});

// ---------------------------------------------------------------- linear

const LINEAR = 'connectors/linear-log/linear_log.ts';

test('linear: missing LINEAR_CLI is a named error', async () => {
  const p = await runWrapper(LINEAR, { HOMINEM_AGENT_DB: dbFile, LINEAR_CLI: undefined }, ['call']);
  assert.equal(p.status, 2);
  assert.match(p.stderr, /LINEAR_CLI/);
});

test('linear: success and audit row', async () => {
  const mock = makeMockCli(
    dir,
    'lok',
    `
console.log(JSON.stringify({ ok: true, result: { isError: false,
  content: [{ text: JSON.stringify({ id: "ISS-1", title: "ship it" }) }] } }));`,
  );
  const p = await runWrapper(LINEAR, { HOMINEM_AGENT_DB: dbFile, LINEAR_CLI: mock }, [
    'call',
    '--name',
    'issue_get',
    '--arguments-json',
    '{"team": "WYA"}',
  ]);
  assert.equal(p.status, 0);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['connector'], 'linear');
  assert.equal(row['ok'], 1);
  assert.equal(row['http_status'], 200);
  assert.deepEqual(j(row['params']), { tool: 'issue_get', arguments: { team: 'WYA' } });
});

test('linear: error payload keeps ok true, carries status and requestId', async () => {
  const mock = makeMockCli(
    dir,
    'lerr',
    `
console.log(JSON.stringify({ ok: true, result: { isError: false,
  content: [{ text: JSON.stringify({ error: "not_found", message: "no such issue",
    status: 404, requestId: "req-9" }) }] } }));`,
  );
  const p = await runWrapper(LINEAR, { HOMINEM_AGENT_DB: dbFile, LINEAR_CLI: mock }, [
    'call',
    '--name',
    'issue_get',
    '--arguments-json',
    '{}',
  ]);
  assert.equal(p.status, 0);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 0);
  assert.equal(row['ok'], 1); // CLI ok; the error was in-band
  assert.equal(row['http_status'], 404);
  assert.equal(j(row['error']).requestId, 'req-9');
});

test('linear: nonzero exit — error in the error column, is_error stays null', async () => {
  const mock = makeMockCli(
    dir,
    'lfail',
    `
process.stderr.write("linear cli crashed\\n"); process.exit(5);`,
  );
  const p = await runWrapper(LINEAR, { HOMINEM_AGENT_DB: dbFile, LINEAR_CLI: mock }, [
    'call',
    '--name',
    't',
  ]);
  assert.equal(p.status, 5);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], null); // faithful: error lives in the error column
  assert.equal(row['exit_code'], 5);
  assert.equal(j(row['error']).error, 'cli_exit_nonzero');
});

// ---------------------------------------------------------------- ponti

const PONTI = 'connectors/ponti-log/ponti_log.ts';

test('ponti: missing PONTI_CLI is a named error', async () => {
  const p = await runWrapper(PONTI, { HOMINEM_AGENT_DB: dbFile, PONTI_CLI: undefined }, ['call']);
  assert.equal(p.status, 2);
  assert.match(p.stderr, /PONTI_CLI/);
});

test('ponti: success with client selector in service column', async () => {
  const mock = makeMockCli(
    dir,
    'pok',
    `
console.log(JSON.stringify({ isError: false,
  result: { content: [{ text: JSON.stringify({ done: true }) }] } }));`,
  );
  const p = await runWrapper(PONTI, { HOMINEM_AGENT_DB: dbFile, PONTI_CLI: mock }, [
    'mcp2',
    'call',
    'order_status',
    '--args',
    '{"id": 7}',
  ]);
  assert.equal(p.status, 0);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['connector'], 'ponti');
  assert.equal(row['service'], 'mcp2'); // client selector audited
  assert.equal(row['ok'], 1);
  assert.equal(row['http_status'], 200);
  assert.deepEqual(j(row['params']), {
    client: 'mcp2',
    tool: 'order_status',
    arguments: { id: 7 },
  });
  assert.deepEqual(j(row['command']), ['mcp2', 'call', 'order_status', '--args', '{"id": 7}']);
});

test('ponti: json-rpc error', async () => {
  const mock = makeMockCli(
    dir,
    'prpc',
    `
console.log(JSON.stringify({ error: { code: -32000, message: "rpc broke" } }));`,
  );
  await runWrapper(PONTI, { HOMINEM_AGENT_DB: dbFile, PONTI_CLI: mock }, ['call', 'tool']);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 1);
  assert.equal(j(row['error']).error, -32000);
  assert.equal(j(row['error']).message, 'rpc broke');
});

test('ponti: content error payload with http status', async () => {
  const mock = makeMockCli(
    dir,
    'pcerr',
    `
console.log(JSON.stringify({ isError: false,
  result: { content: [{ text: JSON.stringify(
    { error: { code: 403, message: "denied" } }) }] } }));`,
  );
  await runWrapper(PONTI, { HOMINEM_AGENT_DB: dbFile, PONTI_CLI: mock }, ['call', 'tool']);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 1);
  assert.equal(row['http_status'], 403);
  assert.equal(j(row['error']).message, 'denied');
});

test('ponti: error text prefix', async () => {
  const mock = makeMockCli(dir, 'petext', `console.log("Error: gateway unreachable");`);
  await runWrapper(PONTI, { HOMINEM_AGENT_DB: dbFile, PONTI_CLI: mock }, ['call', 'tool']);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 1);
  assert.equal(j(row['error']).error, 'cli_error_text');
});

test('ponti: nonzero exit marks error', async () => {
  const mock = makeMockCli(
    dir,
    'pfail',
    `
process.stderr.write("boom\\n"); process.exit(4);`,
  );
  const p = await runWrapper(PONTI, { HOMINEM_AGENT_DB: dbFile, PONTI_CLI: mock }, [
    'call',
    'tool',
  ]);
  assert.equal(p.status, 4);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 1);
  assert.equal(row['exit_code'], 4);
  assert.equal(j(row['error']).error, 'cli_exit_nonzero');
});
