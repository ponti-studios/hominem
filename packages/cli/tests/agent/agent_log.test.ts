/** Tests for the Hominem audit log: schema, WAL, event/run round-trips. */
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { connect, dbPath, logEvent, logRun } from '../../src/agent/log/agent_log.ts';

let dir: string;
let dbFile: string;
const oldEnv = process.env.HOMINEM_AGENT_DB;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-test-'));
  dbFile = join(dir, 'agent.db');
  process.env.HOMINEM_AGENT_DB = dbFile;
});

test.afterEach(() => {
  if (oldEnv === undefined) delete process.env.HOMINEM_AGENT_DB;
  else process.env.HOMINEM_AGENT_DB = oldEnv;
  rmSync(dir, { recursive: true, force: true });
});

test('schema created and WAL on', () => {
  connect().close();
  const db = new DatabaseSync(dbFile);
  const mode = (db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode;
  const tables = new Set(
    (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name),
  );
  db.close();
  assert.equal(mode, 'wal');
  assert.ok(tables.has('events'));
  assert.ok(tables.has('runs'));
  assert.ok(tables.has('hominem_migrations'));
});

test('event round-trip carries every field', () => {
  const id = logEvent('gws', ['gmail', 'search', '--params', '{"q": "from:charles"}'], {
    tsRequest: '2026-11-22T00:00:00.000Z',
    tsRequestMs: 1732233600000,
    tsResponse: '2026-11-22T00:00:01.000Z',
    tsResponseMs: 1732233601000,
    durationMs: 1000,
    service: 'gmail',
    params: { q: 'from:charles' },
    response: { count: 2 },
    httpStatus: 200,
    ok: true,
    isError: false,
    exitCode: 0,
  });
  const db = new DatabaseSync(dbFile);
  const row = db.prepare('SELECT * FROM events').get() as Record<string, unknown>;
  db.close();
  assert.equal(row['id'], id);
  assert.equal(row['connector'], 'gws');
  assert.equal(row['service'], 'gmail');
  assert.deepEqual(JSON.parse(row['command'] as string), [
    'gmail',
    'search',
    '--params',
    '{"q": "from:charles"}',
  ]);
  assert.deepEqual(JSON.parse(row['params'] as string), { q: 'from:charles' });
  assert.deepEqual(JSON.parse(row['response'] as string), { count: 2 });
  assert.equal(row['http_status'], 200);
  assert.equal(row['ok'], 1);
  assert.equal(row['is_error'], 0);
  assert.equal(row['duration_ms'], 1000);
});

test('run round-trip', () => {
  const id = logRun('cadence_regen', {
    status: 'ok',
    exitCode: 0,
    message: 'created 3 weekly tasks',
    context: { mode: 'weekly' },
  });
  const db = new DatabaseSync(dbFile);
  const row = db.prepare('SELECT * FROM runs').get() as Record<string, unknown>;
  db.close();
  assert.equal(row['id'], id);
  assert.equal(row['source'], 'cadence_regen');
  assert.equal(row['status'], 'ok');
  assert.deepEqual(JSON.parse(row['context'] as string), { mode: 'weekly' });
  assert.ok(row['ts_start']);
});

test('HOMINEM_AGENT_DB is the only path authority', () => {
  assert.equal(dbPath(), dbFile);
});

test('migrations are idempotent across reconnects', () => {
  connect().close();
  connect().close();
  const db = new DatabaseSync(dbFile);
  const n = (db.prepare('SELECT COUNT(*) AS c FROM hominem_migrations').get() as { c: number }).c;
  db.close();
  assert.ok(n >= 1);
});
