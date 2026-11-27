/** youtube-music connector: logged passthrough over the Mac-local CLI. */
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { j, makeMockCli, rows, runWrapper, tmpDb } from './helpers.ts';

const YTM = 'connectors/youtube-music/ytm.ts';

let dir: string;
let dbFile: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-ytm-'));
  dbFile = tmpDb(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('ytm: missing YTM_CLI is a named error, nothing external', async () => {
  const p = await runWrapper(YTM, { HOMINEM_AGENT_DB: dbFile }, ['status']);
  assert.equal(p.status, 2);
  assert.match(p.stderr, /YTM_CLI/);
  assert.equal(rows(dbFile, 'events').length, 0);
});

test('ytm: status success passes through and audits one row', async () => {
  const mock = makeMockCli(
    dir,
    'ok',
    `
console.log(JSON.stringify({ ok: true, library_playlists: 42, playlists: [] }));`,
  );
  const p = await runWrapper(YTM, { HOMINEM_AGENT_DB: dbFile, YTM_CLI: mock }, ['status']);
  assert.equal(p.status, 0);
  assert.equal(JSON.parse(p.stdout).library_playlists, 42);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['connector'], 'youtube-music');
  assert.equal(row['service'], 'status');
  assert.equal(row['ok'], 1);
  assert.equal(row['is_error'], 0);
  assert.equal(row['http_status'], 200);
  assert.equal(j(row['response']).library_playlists, 42);
});

test('ytm: positional args pass through verbatim (search)', async () => {
  const mock = makeMockCli(
    dir,
    'echo',
    `
console.log(JSON.stringify({ ok: true, argv: process.argv.slice(2) }));`,
  );
  const p = await runWrapper(YTM, { HOMINEM_AGENT_DB: dbFile, YTM_CLI: mock }, [
    'search',
    'electro',
    'arson',
  ]);
  assert.equal(p.status, 0);
  assert.deepEqual(JSON.parse(p.stdout).argv, ['search', 'electro', 'arson']);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['service'], 'search');
  assert.deepEqual(j(row['params']), ['electro', 'arson']);
});

test('ytm: delete without --yes is refused before any external call', async () => {
  const mock = makeMockCli(
    dir,
    'boom',
    `
console.log("SHOULD NOT RUN");`,
  );
  const p = await runWrapper(YTM, { HOMINEM_AGENT_DB: dbFile, YTM_CLI: mock }, ['delete', 'PL123']);
  assert.equal(p.status, 3);
  assert.match(p.stderr, /--yes/);
  assert.equal(p.stdout, ''); // the mock never ran
  assert.equal(rows(dbFile, 'events').length, 0);
});

test('ytm: delete with --yes passes through; the audit row drops the guard flag from params', async () => {
  const mock = makeMockCli(
    dir,
    'ok2',
    `
console.log(JSON.stringify({ ok: true, result: "deleted" }));`,
  );
  const p = await runWrapper(YTM, { HOMINEM_AGENT_DB: dbFile, YTM_CLI: mock }, [
    'delete',
    'PL123',
    '--yes',
  ]);
  assert.equal(p.status, 0);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['service'], 'delete');
  assert.equal(row['ok'], 1);
  assert.deepEqual(j(row['params']), ['PL123']);
  assert.deepEqual(j(row['command']), ['delete', 'PL123', '--yes']);
});

test('ytm: in-band {ok:false} payload marks the error', async () => {
  const mock = makeMockCli(
    dir,
    'err',
    `
console.log(JSON.stringify({ ok: false, error: "cookie harvest failed" }));`,
  );
  const p = await runWrapper(YTM, { HOMINEM_AGENT_DB: dbFile, YTM_CLI: mock }, ['playlists']);
  assert.equal(p.status, 0); // ytm.py reports failures in-band
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 1);
  assert.equal(row['ok'], 0);
  assert.equal(j(row['error']).error, 'cli_error_payload');
  assert.match(String(j(row['error']).message), /cookie harvest failed/);
});

test('ytm: nonzero exit marks the error, stderr and exit code pass through', async () => {
  const mock = makeMockCli(
    dir,
    'fail',
    `
process.stderr.write("connection refused\\n"); process.exit(3);`,
  );
  const p = await runWrapper(YTM, { HOMINEM_AGENT_DB: dbFile, YTM_CLI: mock }, ['reauth']);
  assert.equal(p.status, 3);
  assert.match(p.stderr, /connection refused/);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 1);
  assert.equal(row['exit_code'], 3);
  assert.equal(j(row['error']).error, 'cli_exit_nonzero');
});
