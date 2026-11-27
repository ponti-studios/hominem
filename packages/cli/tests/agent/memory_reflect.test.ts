/** memory-reflect: mock-backend tests for the conversation-end routine. */
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, test } from 'node:test';

import { j, makeMockCli, rows, runWrapper, tmpDb } from './helpers.ts';

let dir: string;
let dbFile: string;
let mockSeme: string;

// A stateful mock of the seme MCP server (apps/api dist mcp-server):
// JSON-RPC over stdio, seme_recall / seme_save only. Saves are remembered
// so the routine's read-back verify finds them — what you save becomes
// recallable, like the real engine.
const MOCK_SEME_BODY = `
const readline = require("readline");
const saved = [];
function send(o) { process.stdout.write(JSON.stringify(o) + "\\n"); }
function toolResult(id, obj) {
  send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(obj) }] } });
}
const CANNED = [
  { match: "twinings", memory: { id: "622bee4c-f7b4-4921-98cb-6c5ad8c32a25", kind: "fact",
    value_text: "Charles drinks twinings english breakfast every morning",
    confidence: 0.9, observed_at: "2026-11-22T08:23:57Z" } },
  { match: "yorkshire", memory: { id: "1929a303-5abe-4e0e-b9df-9d240d4040d5", kind: "fact",
    value_text: "Charles drinks yorkshire gold every morning with milk",
    confidence: 0.9, observed_at: "2026-11-22T08:26:03Z" } },
  // List-only: recall NEVER returns this one (its match keyword appears in
  // no query) — only the recent window sees it. Models the live finding.
  { match: "zzz-never-a-recall-hit", memory: { id: "aaa1list-0000-0000-0000-000000000001", kind: "fact",
    value_text: "Charles keeps his flat keys in the drawer by the door",
    confidence: 0.9, observed_at: "2026-11-21T10:00:00Z" } },
];
const LIST_FAILS = /*FAIL_SWITCH*/false;
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); return; }
  if (req.method === "initialize") {
    send({ jsonrpc: "2.0", id: req.id, result: { protocolVersion: "2024-11-05",
      capabilities: { tools: {} }, serverInfo: { name: "seme-mock", version: "1.0.0" } } });
    return;
  }
  if (req.method === "notifications/initialized") return;
  if (req.method === "tools/call") {
    const name = req.params && req.params.name;
    const a = (req.params && req.params.arguments) || {};
    if (name === "seme_save") {
      saved.push(a.content);
      toolResult(req.id, { saved: true, turn_id: "turn-" + saved.length });
      return;
    }
    if (name === "seme_recall") {
      const q = String(a.query || "");
      if (q.includes("exploding")) {
        send({ jsonrpc: "2.0", id: req.id, result: { content: [{ type: "text", text: "Error: seme exploded" }], isError: true } });
        return;
      }
      const hit = saved.find((c) => c === q);
      if (hit) {
        toolResult(req.id, { memories: [{ id: "mem-saved-" + saved.indexOf(hit), kind: a.kind || "fact",
          value_text: hit, confidence: 0.9, observed_at: "2026-11-22T09:00:00Z" }], abstain: false, profile_text: "" });
        return;
      }
      const canned = CANNED.find((c) => q.includes(c.match));
      if (canned) { toolResult(req.id, { memories: [canned.memory], abstain: false, profile_text: "" }); return; }
      toolResult(req.id, { memories: [], abstain: true, profile_text: "" });
      return;
    }
    if (name === "seme_list_memories") {
      if (LIST_FAILS) {
        send({ jsonrpc: "2.0", id: req.id, result: { content: [{ type: "text", text: "Error: list exploded" }], isError: true } });
        return;
      }
      const savedMems = saved.map((c, i) => ({ id: "mem-saved-" + i, kind: "fact",
        value_text: c, confidence: 0.9, observed_at: "2026-11-22T09:00:00Z" }));
      const cannedMems = CANNED.map((c) => c.memory);
      toolResult(req.id, { memories: savedMems.concat(cannedMems), total: savedMems.length + cannedMems.length });
      return;
    }
    send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "Method not found: " + name } });
    return;
  }
  send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "Method not found: " + req.method } });
});
`;

const REFLECT = 'systems/memory/reflect.ts';

/** The runs.message column as a string (rows() hands back unknown). */
function msg(row: Record<string, unknown>): string {
  return String(row['message'] ?? '');
}
const NEW_FACT =
  '{"content": "Charles\'s favorite test biscotti is the almond one", "kind": "fact"}';
const DUP_FACT =
  '{"content": "Charles drinks twinings english breakfast every morning", "kind": "fact"}';
const VARIANT_FACT =
  '{"content": "Charles drinks yorkshire gold every morning with sugar", "kind": "preference"}';
const BOOM_FACT = '{"content": "The exploding fact for error handling", "kind": "fact"}';

function env(): Record<string, string | undefined> {
  return { HOMINEM_AGENT_DB: dbFile, SEME_MCP_CMD: `node ${mockSeme}` };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-reflect-'));
  dbFile = tmpDb(dir);
  mockSeme = makeMockCli(dir, 'seme-mock', MOCK_SEME_BODY);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------------------ config gates

test('reflect: missing SEME_MCP_CMD is a named error, no rows written', async () => {
  const p = await runWrapper(
    REFLECT,
    { HOMINEM_AGENT_DB: dbFile, SEME_MCP_CMD: undefined },
    [],
    NEW_FACT,
  );
  assert.equal(p.status, 2);
  assert.match(p.stderr, /SEME_MCP_CMD/);
  assert.equal(rows(dbFile, 'events').length, 0);
  assert.equal(rows(dbFile, 'runs').length, 0);
});

test('reflect: no facts on stdin is a named error', async () => {
  const p = await runWrapper(REFLECT, env(), []);
  assert.equal(p.status, 2);
  assert.match(p.stderr, /no facts on stdin/);
  assert.equal(rows(dbFile, 'runs').length, 0);
});

test('reflect: malformed JSONL names the line', async () => {
  const p = await runWrapper(REFLECT, env(), [], 'not json at all');
  assert.equal(p.status, 2);
  assert.match(p.stderr, /line 1/);
  assert.match(p.stderr, /not JSON/);
});

test('reflect: unknown kind names itself and lists the valid ones', async () => {
  const p = await runWrapper(REFLECT, env(), [], '{"content": "x", "kind": "vibe"}');
  assert.equal(p.status, 2);
  assert.match(p.stderr, /vibe/);
  assert.match(p.stderr, /fact, preference, routine/);
});

test('reflect: missing content is a named error', async () => {
  const p = await runWrapper(REFLECT, env(), [], '{"kind": "fact"}');
  assert.equal(p.status, 2);
  assert.match(p.stderr, /content/);
});

// ------------------------------------------------------------- the routine

test('reflect: new fact is saved verbatim, verified by read-back, fully audited', async () => {
  const p = await runWrapper(REFLECT, env(), ['--session', 'run-test-1'], NEW_FACT);
  assert.equal(p.status, 0);
  assert.match(p.stdout, /SAVED/);
  assert.match(p.stdout, /read-back verified/);
  assert.match(p.stdout, /dedup window: 3/);

  const events = rows(dbFile, 'events');
  assert.equal(events.length, 4); // window list, recall, save, read-back recall
  const commands = events.map((r) => j(r['command']));
  assert.deepEqual(commands, [
    ['seme_list_memories'],
    ['seme_recall'],
    ['seme_save'],
    ['seme_recall'],
  ]);
  for (const r of events) {
    assert.equal(r['connector'], 'seme');
    assert.equal(r['service'], 'mcp');
    assert.equal(r['ok'], 1);
    assert.equal(r['is_error'], 0);
  }
  assert.deepEqual(j(events[0]!['params']), { status: 'active', limit: 200 });
  const save = events[2]!;
  assert.deepEqual(j(save['params']), {
    content: "Charles's favorite test biscotti is the almond one",
    kind: 'fact',
    session_id: 'run-test-1',
  });
  assert.equal(j(save['response']).turn_id, 'turn-1');

  const runs = rows(dbFile, 'runs');
  assert.equal(runs.length, 1);
  const run = runs[0]!;
  assert.equal(run['source'], 'memory-reflect');
  assert.equal(run['status'], 'completed');
  assert.equal(run['exit_code'], 0);
  assert.notEqual(run['ts_end'], null);
  assert.equal(j(run['context']).facts, 1);
  assert.match(msg(run), /saved=1/);
  assert.match(msg(run), /unverified=0/);
});

test('reflect: exact duplicate is already stored — idempotent, no save', async () => {
  const p = await runWrapper(REFLECT, env(), [], DUP_FACT);
  assert.equal(p.status, 0);
  assert.match(p.stdout, /ALREADY/);
  assert.match(p.stdout, /622bee4c/);

  const events = rows(dbFile, 'events');
  assert.equal(events.length, 2); // window list + recall — no save
  assert.deepEqual(j(events[0]!['command']), ['seme_list_memories']);
  assert.deepEqual(j(events[1]!['command']), ['seme_recall']);
  assert.match(msg(rows(dbFile, 'runs')[0]!), /already=1/);
});

test("reflect: close variant is a conflict — kept seme's copy, nothing written, exit 1", async () => {
  const p = await runWrapper(REFLECT, env(), [], VARIANT_FACT);
  assert.equal(p.status, 1);
  assert.match(p.stdout, /CONFLICT/);
  assert.match(p.stdout, /1929a303/);
  assert.match(p.stdout, /kept seme's, flagged for review/);

  const events = rows(dbFile, 'events');
  assert.equal(events.length, 2); // window list + recall — no save happened
  const run = rows(dbFile, 'runs')[0]!;
  assert.equal(run['status'], 'completed');
  assert.equal(run['exit_code'], 1);
  assert.match(msg(run), /conflict=1/);
});

test('reflect: dry run recalls but never writes', async () => {
  const p = await runWrapper(REFLECT, env(), ['--dry-run'], `${NEW_FACT}\n${VARIANT_FACT}`);
  assert.equal(p.status, 1); // the conflict is a finding even when dry
  assert.match(p.stdout, /WOULD-SAVE/);
  assert.match(p.stdout, /dry run, nothing written/);
  assert.match(p.stdout, /CONFLICT/);

  const events = rows(dbFile, 'events');
  assert.equal(events.length, 3); // window list + two recalls, zero saves
  assert.deepEqual(
    events.map((r) => j(r['command'])),
    [['seme_list_memories'], ['seme_recall'], ['seme_recall']],
  );
  const run = rows(dbFile, 'runs')[0]!;
  assert.equal(j(run['context']).dry_run, true);
  assert.match(msg(run), /would=1/);
});

test('reflect: tool error fails the fact, the batch continues', async () => {
  const p = await runWrapper(REFLECT, env(), [], `${BOOM_FACT}\n${NEW_FACT}`);
  assert.equal(p.status, 1);
  assert.match(p.stdout, /FAILED/);
  assert.match(p.stdout, /Error: seme exploded/);
  assert.match(p.stdout, /SAVED/); // second fact still processed

  const events = rows(dbFile, 'events');
  assert.equal(events.length, 5); // window list, failed recall, then recall, save, verify
  const failedCall = events[1]!;
  assert.equal(failedCall['is_error'], 1);
  assert.equal(failedCall['ok'], 0);
  assert.equal(j(failedCall['error']).error, 'mcp_tool_error');
  assert.match(j(failedCall['error']).message, /seme exploded/);
  assert.match(msg(rows(dbFile, 'runs')[0]!), /saved=1 already=0 conflict=0 failed=1/);
});

test('reflect: within-batch duplicate — second occurrence is already', async () => {
  const p = await runWrapper(REFLECT, env(), [], `${NEW_FACT}\n${NEW_FACT}`);
  assert.equal(p.status, 0);
  assert.match(p.stdout, /SAVED/);
  assert.match(p.stdout, /ALREADY/);
  const saves = rows(dbFile, 'events').filter((r) => j(r['command'])[0] === 'seme_save');
  assert.equal(saves.length, 1); // saved exactly once
});

test("reflect: --session lands in every call's params", async () => {
  const p = await runWrapper(REFLECT, env(), ['--session', 'conv-42'], NEW_FACT);
  assert.equal(p.status, 0);
  for (const r of rows(dbFile, 'events')) {
    // the window call is run-scoped, not fact-scoped — it carries no session_id
    if (j(r['command'])[0] === 'seme_list_memories') continue;
    assert.equal(j(r['params']).session_id, 'conv-42');
  }
  assert.equal(j(rows(dbFile, 'runs')[0]!['context']).session, 'conv-42');
});

test('reflect: fact-level session_id overrides --session', async () => {
  const fact = '{"content": "Charles\'s per-fact session fact", "session_id": "solo-7"}';
  const p = await runWrapper(REFLECT, env(), ['--session', 'conv-42'], fact);
  assert.equal(p.status, 0);
  for (const r of rows(dbFile, 'events')) {
    if (j(r['command'])[0] === 'seme_list_memories') continue;
    assert.equal(j(r['params']).session_id, 'solo-7');
  }
});

test('reflect: server dying at spawn fails the run by name', async () => {
  const failFast = makeMockCli(dir, 'seme-dead', `process.exit(3);`);
  const p = await runWrapper(
    REFLECT,
    { HOMINEM_AGENT_DB: dbFile, SEME_MCP_CMD: `node ${failFast}` },
    [],
    NEW_FACT,
  );
  assert.equal(p.status, 1);
  assert.match(p.stderr, /seme MCP server exited/);
  assert.equal(rows(dbFile, 'events').length, 0);
  const run = rows(dbFile, 'runs')[0]!;
  assert.equal(run['status'], 'failed');
  assert.match(msg(run), /exited/);
});

test('reflect: empty blank lines in the input are skipped, not errors', async () => {
  const p = await runWrapper(REFLECT, env(), [], `\n${NEW_FACT}\n\n`);
  assert.equal(p.status, 0);
  assert.match(p.stdout, /SAVED/);
  assert.equal(j(rows(dbFile, 'runs')[0]!['context']).facts, 1);
});

test('reflect: reworded dup that recall never returns is caught by the recent window', async () => {
  // The live 0.714 finding, as a regression: recall's ranking missed the
  // stored near-dup entirely; only the window can catch it.
  const reworded =
    '{"content": "The drawer by the door is where the flat keys live", "kind": "fact"}';
  const p = await runWrapper(REFLECT, env(), [], reworded);
  assert.equal(p.status, 1);
  assert.match(p.stdout, /CONFLICT/);
  assert.match(p.stdout, /aaa1list/);
  const saves = rows(dbFile, 'events').filter((r) => j(r['command'])[0] === 'seme_save');
  assert.equal(saves.length, 0); // nothing written — the whole point
  assert.match(msg(rows(dbFile, 'runs')[0]!), /conflict=1/);
});

test('reflect: rewording of a fact saved earlier in the SAME run conflicts', async () => {
  const two = [
    '{"content": "Charles\'s test umbrella lives in the hall closet by the coats", "kind": "fact"}',
    '{"content": "The hall closet by the coats is where the test umbrella lives", "kind": "fact"}',
  ].join('\n');
  const p = await runWrapper(REFLECT, env(), [], two);
  assert.equal(p.status, 1);
  assert.match(p.stdout, /SAVED/);
  assert.match(p.stdout, /CONFLICT/);
  assert.match(p.stdout, /this-run/); // kept the copy saved moments ago
  const saves = rows(dbFile, 'events').filter((r) => j(r['command'])[0] === 'seme_save');
  assert.equal(saves.length, 1); // the rewording never saves twice
});

test('reflect: seme_list_memories failing degrades to recall-only, never fatal', async () => {
  const listDead = makeMockCli(
    dir,
    'seme-list-dead',
    MOCK_SEME_BODY.replace('/*FAIL_SWITCH*/false', 'true'),
  );
  const p = await runWrapper(
    REFLECT,
    { HOMINEM_AGENT_DB: dbFile, SEME_MCP_CMD: `node ${listDead}` },
    [],
    NEW_FACT,
  );
  assert.equal(p.status, 0);
  assert.match(p.stderr, /seme_list_memories failed/);
  assert.match(p.stderr, /recall-only dedup/);
  assert.match(p.stdout, /dedup window: 0/);
  assert.match(p.stdout, /SAVED/); // the recall gate still works alone
  const events = rows(dbFile, 'events');
  assert.equal(j(events[0]!['command'])[0], 'seme_list_memories');
  assert.equal(events[0]!['is_error'], 1);
  assert.match(msg(rows(dbFile, 'runs')[0]!), /window=0 saved=1/);
});
