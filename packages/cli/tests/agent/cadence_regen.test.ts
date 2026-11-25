import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { makeMockCli, rows, runWrapper, tmpDb } from './helpers.ts';

const ROUTINE = 'routines/cadence_regen.ts';

let dir: string;
let dbFile: string;
let stateFile: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-cadence-'));
  dbFile = tmpDb(dir);
  stateFile = join(dir, 'tasks.json');
  writeFileSync(stateFile, '[]');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function mockTasks(): string {
  return makeMockCli(
    dir,
    'gws-tasks',
    `
const fs = require("node:fs");
const argv = process.argv.slice(2);
const read = () => JSON.parse(fs.readFileSync(process.env.GWS_TASKS_STATE, "utf8"));
const write = (items) => fs.writeFileSync(process.env.GWS_TASKS_STATE, JSON.stringify(items));
if (process.env.GWS_TASKS_FAIL === "1") {
  process.stderr.write("tasks API error (UNAVAILABLE): tasks down\\n");
  process.exit(1);
}
if (argv[0] === "tasklists") {
  console.log(JSON.stringify({ items: [
    { id: "weekly-id", title: "Weekly Cadence" },
    { id: "monthly-id", title: "Monthly Cadence" },
  ] }));
  process.exit(0);
}
if (argv[0] === "list") {
  console.log(JSON.stringify({ items: read() }));
  process.exit(0);
}
if (argv[0] === "insert") {
  const bodyIndex = argv.indexOf("--json");
  const body = JSON.parse(argv[bodyIndex + 1]);
  const items = read();
  items.push({ id: "task-" + (items.length + 1), title: body.title });
  write(items);
  console.log(JSON.stringify({ id: "task-" + items.length, title: body.title }));
  process.exit(0);
}
process.exit(8);
`,
  );
}

test('cadence: invalid argument is a usage error without an audit row', async () => {
  const result = await runWrapper(ROUTINE, { HOMINEM_AGENT_DB: dbFile }, ['yearly']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /weekly or monthly/);
  assert.deepEqual(rows(dbFile, 'runs'), []);
});

test('cadence: missing Google token is named and closes the run', async () => {
  const result = await runWrapper(
    ROUTINE,
    {
      HOMINEM_AGENT_DB: dbFile,
      GOOGLE_TOKEN_FILE: join(dir, 'missing-token.json'),
      GOOGLE_TASKS_CLI: undefined,
    },
    ['weekly'],
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Google token could not be read/);
  const run = rows(dbFile, 'runs')[0]!;
  assert.equal(run['source'], 'cadence-regen');
  assert.equal(run['status'], 'failed');
  assert.match(String(run['message']), /Google token could not be read/);
});

test('cadence: Google Tasks in-band failure is audited and fails the run', async () => {
  const result = await runWrapper(
    ROUTINE,
    {
      HOMINEM_AGENT_DB: dbFile,
      GOOGLE_TASKS_CLI: mockTasks(),
      GWS_TASKS_STATE: stateFile,
      GWS_TASKS_FAIL: '1',
    },
    ['weekly'],
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /UNAVAILABLE.*tasks down/);
  assert.equal(rows(dbFile, 'runs')[0]!['status'], 'failed');
});

test('cadence: creates missing weekly tasks and is idempotent on rerun', async () => {
  const env = {
    HOMINEM_AGENT_DB: dbFile,
    GOOGLE_TASKS_CLI: mockTasks(),
    GWS_TASKS_STATE: stateFile,
  };

  const first = await runWrapper(ROUTINE, env, ['weekly']);
  assert.equal(first.status, 0);
  assert.equal(first.stdout, 'Weekly Cadence: created 13, already open 0\n');
  const second = await runWrapper(ROUTINE, env, ['weekly']);
  assert.equal(second.status, 0);
  assert.equal(second.stdout, 'Weekly Cadence: created 0, already open 13\n');

  const runs = rows(dbFile, 'runs');
  assert.equal(runs.length, 2);
  assert.ok(runs.every((run) => run['source'] === 'cadence-regen'));
  assert.ok(runs.every((run) => run['status'] === 'ok'));
  assert.equal(runs[0]!['message'], 'Weekly Cadence: created 13, already open 0');
  assert.equal(runs[1]!['message'], 'Weekly Cadence: created 0, already open 13');
});

test('cadence: monthly selects its own list and template', async () => {
  const result = await runWrapper(
    ROUTINE,
    {
      HOMINEM_AGENT_DB: dbFile,
      GOOGLE_TASKS_CLI: mockTasks(),
      GWS_TASKS_STATE: stateFile,
    },
    ['monthly'],
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'Monthly Cadence: created 7, already open 0\n');
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.equal(state.length, 7);
});

test('cadence: rejects malformed template files before making external calls', async () => {
  const templates = join(dir, 'templates.json');
  writeFileSync(templates, JSON.stringify({ 'Weekly Cadence': ['duplicate', 'duplicate'] }));
  const result = await runWrapper(
    ROUTINE,
    {
      HOMINEM_AGENT_DB: dbFile,
      CADENCE_TEMPLATES_FILE: templates,
      GOOGLE_TASKS_CLI: mockTasks(),
      GWS_TASKS_STATE: stateFile,
    },
    ['weekly'],
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate titles/);
  assert.equal(rows(dbFile, 'runs')[0]!['status'], 'failed');
});
