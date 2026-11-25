/** Tests for brain/audit_stream.ts — the brain's MCP calls become events rows. */
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { auditStream } from '../../src/agent/brain/audit_stream.ts';
import { finishRun, logRun } from '../../src/agent/log/agent_log.ts';
import { ROOT, rows } from './helpers.ts';

let dir: string;
let dbFile: string;

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-stream-'));
  dbFile = join(dir, 'agent.db');
});
test.afterEach(() => rmSync(dir, { recursive: true, force: true }));

const text = (t: string) => ({ content: [{ type: 'text', text: t }] });

/** A pi --mode json stream, shaped like the one recorded in the e2e proof. */
function mockStream(): string[] {
  return [
    { type: 'session', id: 's1' },
    // non-MCP tool: must NOT be audited as an MCP event
    { type: 'tool_execution_start', toolCallId: 't0', toolName: 'codemode', args: { code: '…' } },
    // MCP call nested inside codemode
    {
      type: 'tool_execution_start',
      toolCallId: 't0/1',
      toolName: 'mcp__seme__seme_recall',
      args: { query: 'What is Hominem' },
      parentToolCallId: 't0',
    },
    {
      type: 'tool_execution_end',
      toolCallId: 't0/1',
      toolName: 'mcp__seme__seme_recall',
      result: text('{"memories":[{"kind":"fact"}]}'),
      isError: false,
      durationMs: 108.4,
    },
    {
      type: 'tool_execution_end',
      toolCallId: 't0',
      toolName: 'codemode',
      result: text('done'),
      isError: false,
    },
    // a failing MCP call
    {
      type: 'tool_execution_start',
      toolCallId: 't1',
      toolName: 'mcp__hominem__get_accounts',
      args: {},
    },
    {
      type: 'tool_execution_end',
      toolCallId: 't1',
      toolName: 'mcp__hominem__get_accounts',
      result: text('fetch failed'),
      isError: true,
      durationMs: 5,
    },
    {
      type: 'agent_end',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'q' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'first' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Hominem is the engine.' }] },
      ],
    },
  ]
    .map((e) => JSON.stringify(e))
    .concat(['not json noise', '']);
}

async function* iter(lines: string[]) {
  for (const l of lines) yield l;
}

test('one events row per MCP call; non-MCP tools ignored; final reply returned', async () => {
  const result = await auditStream(iter(mockStream()), { path: dbFile });
  assert.equal(result.reply, 'Hominem is the engine.');
  assert.equal(result.events.length, 2);
  assert.equal(result.failedCalls, 1);

  const ev = rows(dbFile, 'events');
  assert.equal(ev.length, 2);
  assert.equal(ev[0]!['connector'], 'seme');
  assert.equal(ev[0]!['service'], 'mcp');
  assert.equal(ev[0]!['command'], '["seme_recall"]');
  assert.equal(ev[0]!['params'], '{"query":"What is Hominem"}');
  assert.equal(ev[0]!['response'], '{"memories":[{"kind":"fact"}]}');
  assert.equal(ev[0]!['ok'], 1);
  assert.equal(ev[0]!['duration_ms'], 108);

  assert.equal(ev[1]!['connector'], 'hominem');
  assert.equal(ev[1]!['ok'], 0);
  assert.equal(ev[1]!['is_error'], 1);
  assert.match(String(ev[1]!['error']), /fetch failed/);
});

test("finishRun closes the launcher's run row", () => {
  const id = logRun('brain-recall', { status: 'invoked', path: dbFile });
  finishRun(id, { status: 'completed', exitCode: 0, message: 'mcp events: 1', path: dbFile });
  const r = rows(dbFile, 'runs')[0]!;
  assert.equal(r['status'], 'completed');
  assert.equal(r['exit_code'], 0);
  assert.ok(r['ts_end']);
});

test('CLI: prints the reply, closes the run, exits 1 on an empty reply', async () => {
  const run = (input: string, runId: number) =>
    new Promise<{ code: number | null; out: string }>((resolve) => {
      const p = spawn(
        'node',
        [
          join(ROOT, 'tests/agent/run_module.ts'),
          join(ROOT, 'src/agent/brain/audit_stream.ts'),
          String(runId),
        ],
        {
          env: { ...process.env, HOMINEM_AGENT_DB: dbFile },
        },
      );
      let out = '';
      p.stdout.on('data', (d) => (out += d));
      p.on('close', (code) => resolve({ code, out }));
      p.stdin.end(input);
    });

  const ok = logRun('brain-chat', { status: 'invoked', path: dbFile });
  const good = await run(mockStream().join('\n'), ok);
  assert.equal(good.code, 0);
  assert.equal(good.out, 'Hominem is the engine.\n');

  const bad = logRun('brain-chat', { status: 'invoked', path: dbFile });
  const empty = await run(JSON.stringify({ type: 'session' }), bad);
  assert.equal(empty.code, 1);

  const runRows = rows(dbFile, 'runs');
  assert.equal(runRows[0]!['status'], 'completed');
  assert.match(String(runRows[0]!['message']), /mcp events: \d+,\d+; failed calls: 1/);
  assert.equal(runRows[1]!['status'], 'failed');
});
