#!/usr/bin/env node
/**
 * Logged wrapper for the Notion CLI.
 *
 * Hominem TypeScript port of the tested Python port (original rule:
 * Charlie, 1 Nov 2026). Every Notion call goes through this wrapper; one
 * audit row per call in ~/.hominem/agent.db (events, connector "notion") —
 * rows, not log files. The row carries the original JSONL field set:
 * request (tool name + parsed arguments), full parsed envelope, http_status
 * (from Notion APIResponseError payloads, 200 on clean success, else null),
 * ok/is_error/error details/exit code/stderr.
 *
 * Transparent passthrough. The real CLI resolves from NOTION_CLI (law 4);
 * a missing variable is a named error, not a guess.
 */
import { spawnSync } from 'node:child_process';

import { logEvent } from '../../log/agent_log.ts';

const CONNECTOR = 'notion';

function now(): { iso: string; ms: number } {
  const t = Date.now();
  return { iso: new Date(t).toISOString(), ms: t };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Return [httpStatus, error] if a parsed content payload is an error, else
 * [null, null]. Handles both Linear-style {error, message, status,
 * requestId} and Notion-style APIResponseError {name, code, status,
 * message, request_id, body}. Success payloads must never match: a bare
 * "status" field alone (e.g. an issue's workflow state) is not an error.
 */
function extractError(inner: unknown): [number | null, unknown] {
  if (inner === null || typeof inner !== 'object') return [null, null];
  const rec = inner as Record<string, unknown>;
  if ('error' in rec) {
    // Linear-style
    return [
      typeof rec['status'] === 'number' ? rec['status'] : null,
      { error: rec['error'], message: rec['message'], requestId: rec['requestId'] },
    ];
  }
  if ('status' in rec && ('code' in rec || rec['name'] === 'APIResponseError')) {
    let message = rec['message'];
    let requestId = rec['request_id'];
    const body = rec['body'];
    if (typeof body === 'string') {
      const parsedBody = parseJson(body);
      if (parsedBody !== null && typeof parsedBody === 'object') {
        const b = parsedBody as Record<string, unknown>;
        message = message ?? b['message'];
        requestId = requestId ?? b['request_id'];
      }
    }
    return [
      typeof rec['status'] === 'number' ? rec['status'] : null,
      { error: rec['code'] ?? rec['name'], message, requestId },
    ];
  }
  return [null, null];
}

export function main(argv = process.argv.slice(2)): number {
  const real = process.env.NOTION_CLI;
  if (!real) {
    process.stderr.write(
      'notion_log: NOTION_CLI is not set — point it at the Notion CLI binary.\n',
    );
    return 2;
  }

  const tsReq = now();
  const start = performance.now();
  const proc = spawnSync(real, argv, { encoding: 'utf-8' });
  const durationMs = Math.round(performance.now() - start);
  const tsRes = now();

  const stdout = proc.stdout ?? '';
  const stderr = proc.stderr ?? '';

  let tool: string | null = null;
  let arguments_: unknown = null;
  const nameIdx = argv.indexOf('--name');
  if (nameIdx >= 0 && nameIdx + 1 < argv.length) tool = argv[nameIdx + 1]!;
  const argsIdx = argv.indexOf('--arguments-json');
  if (argsIdx >= 0 && argsIdx + 1 < argv.length) {
    arguments_ = parseJson(argv[argsIdx + 1]!);
  }

  const body = parseJson(stdout);
  const bodyRecord =
    body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const result =
    bodyRecord && typeof bodyRecord['result'] === 'object' && bodyRecord['result'] !== null
      ? (bodyRecord['result'] as Record<string, unknown>)
      : null;

  const ok = bodyRecord ? bodyRecord['ok'] : null;
  const isError = result ? result['isError'] : null;

  let error: unknown = null;
  let httpStatus: number | null = null;
  // Notion's envelope also repeats content at top level; scan result first,
  // then the top-level mirror, until an error payload is found.
  const containers: Record<string, unknown>[] = [];
  if (result) containers.push(result);
  if (bodyRecord) containers.push(bodyRecord);
  outer: for (const container of containers) {
    const content = container['content'];
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (item === null || typeof item !== 'object') continue;
      const text = (item as Record<string, unknown>)['text'];
      if (typeof text !== 'string' || !text) continue;
      const inner = parseJson(text);
      const [statusFound, errorFound] = extractError(inner);
      if (errorFound !== null) {
        httpStatus = statusFound;
        error = errorFound;
        break outer;
      }
    }
  }

  if (httpStatus === null && ok === true && !isError) httpStatus = 200;
  if (error === null && isError) error = { error: 'isError', message: null, requestId: null };
  if (error === null && proc.status !== 0) {
    error = { error: 'cli_exit_nonzero', message: stderr.slice(0, 500), requestId: null };
  }

  logEvent(CONNECTOR, argv, {
    tsRequest: tsReq.iso,
    tsRequestMs: tsReq.ms,
    tsResponse: tsRes.iso,
    tsResponseMs: tsRes.ms,
    durationMs,
    service: tool ?? undefined,
    params: { tool, arguments: arguments_ },
    response: body,
    httpStatus: httpStatus ?? undefined,
    ok: typeof ok === 'boolean' ? ok : undefined,
    isError: Boolean(isError),
    error,
    exitCode: proc.status ?? undefined,
    stderr: stderr || undefined,
  });

  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return proc.status ?? 1;
}
