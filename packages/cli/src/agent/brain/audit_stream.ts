#!/usr/bin/env node
/**
 * Brain audit stream — law 1 for the brain's own MCP calls.
 *
 * The launcher runs pi with `--mode json` and pipes the event stream here.
 * Every MCP tool call the brain makes (seme, hominem, … — toolName
 * `mcp__<server>__<tool>`, including calls nested inside codemode) becomes
 * ONE `events` row, written by this wrapper — not left to the model's
 * discretion. The brain's final reply is printed to stdout, and the
 * launcher's `runs` row is closed with the outcome.
 *
 * Found by the e2e proof (2026-11-22): `remember` produced an events row
 * only because the model chose to write one; `recall` produced none.
 *
 * Usage: pi --print --mode json … | node brain/audit_stream.ts <run-id>
 */
import { createInterface } from 'node:readline';

import { finishRun, logEvent } from '../log/agent_log.ts';

const MCP_TOOL = /^mcp__(.+?)__(.+)$/;

interface Pending {
  server: string;
  tool: string;
  args: unknown;
  tsMs: number;
}

export interface StreamResult {
  reply: string;
  events: number[];
  failedCalls: number;
}

type Json = Record<string, unknown>;

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((c): c is Json => !!c && typeof c === 'object' && (c as Json)['type'] === 'text')
    .map((c) => String(c['text'] ?? ''))
    .join('');
}

/** Parse an MCP text payload as JSON when it is JSON; keep it raw otherwise. */
function responseOf(result: unknown): unknown {
  const content = (result as Json | undefined)?.['content'];
  const text = textOf(content);
  try {
    return JSON.parse(text);
  } catch {
    return content ?? null;
  }
}

/** Consume a pi JSON event stream; audit MCP calls; return the final reply. */
export async function auditStream(
  lines: AsyncIterable<string>,
  opts: { path?: string } = {},
): Promise<StreamResult> {
  const pending = new Map<string, Pending>();
  const out: StreamResult = { reply: '', events: [], failedCalls: 0 };

  for await (const line of lines) {
    if (!line.trim()) continue;
    let e: Json;
    try {
      e = JSON.parse(line) as Json;
    } catch {
      continue; // non-JSON noise is not an event
    }
    const name = String(e['toolName'] ?? '');
    const match = MCP_TOOL.exec(name);

    if (e['type'] === 'tool_execution_start' && match) {
      pending.set(String(e['toolCallId']), {
        server: match[1]!,
        tool: match[2]!,
        args: e['args'] ?? null,
        tsMs: Date.now(),
      });
    } else if (e['type'] === 'tool_execution_end' && match) {
      const id = String(e['toolCallId']);
      const p = pending.get(id) ?? {
        server: match[1]!,
        tool: match[2]!,
        args: null,
        tsMs: Date.now(),
      };
      pending.delete(id);
      const endMs = Date.now();
      const durationMs =
        typeof e['durationMs'] === 'number' ? Math.round(e['durationMs']) : endMs - p.tsMs;
      const isError = e['isError'] === true;
      if (isError) out.failedCalls++;
      const response = responseOf(e['result']);
      out.events.push(
        logEvent(p.server, [p.tool], {
          tsRequest: new Date(p.tsMs).toISOString(),
          tsRequestMs: p.tsMs,
          tsResponse: new Date(endMs).toISOString(),
          tsResponseMs: endMs,
          durationMs,
          service: 'mcp',
          params: p.args,
          response,
          ok: !isError,
          isError,
          error: isError
            ? {
                error: 'mcp_tool_error',
                message: textOf((e['result'] as Json)?.['content']).slice(0, 500),
                requestId: null,
              }
            : null,
          path: opts.path,
        }),
      );
    } else if (e['type'] === 'agent_end' && Array.isArray(e['messages'])) {
      const assistant = (e['messages'] as Json[]).filter((m) => m['role'] === 'assistant');
      out.reply = textOf(assistant.at(-1)?.['content']);
    }
  }
  return out;
}

/** Loaded by path from tests/agent/run_module.ts, which knip can't see. @public */
export async function main(): Promise<void> {
  const runId = Number(process.argv[2]);
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const result = await auditStream(rl);
  process.stdout.write(result.reply.endsWith('\n') ? result.reply : `${result.reply}\n`);
  if (Number.isInteger(runId) && runId > 0) {
    const empty = result.reply.trim() === '';
    finishRun(runId, {
      status: empty ? 'failed' : 'completed',
      exitCode: empty ? 1 : 0,
      message: `mcp events: ${result.events.join(',') || 'none'}; failed calls: ${result.failedCalls}`,
    });
  }
  if (result.reply.trim() === '') process.exit(1);
}
