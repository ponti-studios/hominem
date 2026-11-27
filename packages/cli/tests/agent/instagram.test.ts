/** instagram connector: logged passthrough over the Mac-local CLI. */
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { j, makeMockCli, rows, runWrapper, tmpDb } from './helpers.ts';

const IG = 'connectors/instagram/instagram.ts';

let dir: string;
let dbFile: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-instagram-'));
  dbFile = tmpDb(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('instagram: missing IG_CLI is a named error, nothing external', async () => {
  const p = await runWrapper(IG, { HOMINEM_AGENT_DB: dbFile, IG_CLI: '' }, [
    'profile',
    'somehandle',
  ]);
  assert.equal(p.status, 2);
  assert.match(p.stderr, /IG_CLI/);
  assert.equal(rows(dbFile, 'events').length, 0);
});

test('instagram: profile success passes through and audits one row', async () => {
  const mock = makeMockCli(
    dir,
    'ok',
    `
console.log(JSON.stringify({ ok: true, username: 'somehandle', followers: 1200, is_private: false }));`,
  );
  const p = await runWrapper(IG, { HOMINEM_AGENT_DB: dbFile, IG_CLI: mock }, [
    'profile',
    'somehandle',
  ]);
  assert.equal(p.status, 0);
  assert.equal(JSON.parse(p.stdout).username, 'somehandle');
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['connector'], 'instagram');
  assert.equal(row['service'], 'profile');
  assert.equal(row['ok'], 1);
  assert.equal(row['is_error'], 0);
  assert.equal(row['http_status'], 200);
  assert.deepEqual(j(row['command']), ['profile', 'somehandle']);
  assert.deepEqual(j(row['params']), ['somehandle']);
  assert.equal(j(row['response']).followers, 1200);
});

test('instagram: me success audits with service me and empty params', async () => {
  const mock = makeMockCli(
    dir,
    'me',
    `
console.log(JSON.stringify({ ok: true, viewer_handle: 'somehandle', username: 'somehandle' }));`,
  );
  const p = await runWrapper(IG, { HOMINEM_AGENT_DB: dbFile, IG_CLI: mock }, ['me']);
  assert.equal(p.status, 0);
  assert.equal(JSON.parse(p.stdout).viewer_handle, 'somehandle');
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['service'], 'me');
  assert.equal(row['ok'], 1);
  assert.deepEqual(j(row['params']), []);
});

test('instagram: in-band {ok:false} payload marks the error', async () => {
  const mock = makeMockCli(
    dir,
    'err',
    `
console.log(JSON.stringify({ ok: false, error: "no viewer handle found - is Instagram signed in?" }));`,
  );
  const p = await runWrapper(IG, { HOMINEM_AGENT_DB: dbFile, IG_CLI: mock }, ['me']);
  assert.equal(p.status, 0); // the toolkit reports failures in-band
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 1);
  assert.equal(row['ok'], 0);
  assert.equal(j(row['error']).error, 'cli_error_payload');
  assert.match(String(j(row['error']).message), /signed in/);
});

test('instagram: nonzero exit marks the error, stderr and exit code pass through', async () => {
  const mock = makeMockCli(
    dir,
    'fail',
    `
process.stderr.write("daemon not reachable\\n"); process.exit(3);`,
  );
  const p = await runWrapper(IG, { HOMINEM_AGENT_DB: dbFile, IG_CLI: mock }, [
    'profile',
    'somehandle',
  ]);
  assert.equal(p.status, 3);
  assert.match(p.stderr, /daemon not reachable/);
  const row = rows(dbFile, 'events')[0]!;
  assert.equal(row['is_error'], 1);
  assert.equal(row['exit_code'], 3);
  assert.equal(j(row['error']).error, 'cli_exit_nonzero');
});
