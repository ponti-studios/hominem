#!/usr/bin/env node
/**
 * Logged wrapper for the Linear MCP CLI.
 *
 * Hominem TypeScript port of the tested Python port (original rule: Charlie,
 * 1 Nov 2026). Every Linear call goes through this wrapper; one audit row
 * per call in ~/.hominem/agent.db (events, connector "linear") — rows, not
 * log files. The original's `tool` and request fields fold into `params`.
 * Transparent passthrough of stdout, stderr and exit code.
 *
 * The real CLI resolves from the LINEAR_CLI environment variable (law 4);
 * a missing variable is a named error, not a guess.
 */
import { spawnSync } from 'node:child_process';

import { asRecord } from '../../guards.ts';
import { logEvent } from '../../log/agent_log.ts';

const CONNECTOR = 'linear';

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

export function main(argv = process.argv.slice(2)): number {
  const real = process.env.LINEAR_CLI;
  if (!real) {
    process.stderr.write(
      'linear_log: LINEAR_CLI is not set — point it at the Linear MCP CLI binary.\n',
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

  // Request side
  let tool: string | null = null;
  let arguments_: unknown = null;
  const nameIdx = argv.indexOf('--name');
  if (nameIdx >= 0 && nameIdx + 1 < argv.length) tool = argv[nameIdx + 1]!;
  const argsIdx = argv.indexOf('--arguments-json');
  if (argsIdx >= 0 && argsIdx + 1 < argv.length) {
    arguments_ = parseJson(argv[argsIdx + 1]!);
  }

  // Response side
  const body = parseJson(stdout);
  const bodyRecord = asRecord(body);
  const result = asRecord(bodyRecord?.['result']);

  const ok = bodyRecord ? bodyRecord['ok'] : null;
  const isError = result ? result['isError'] : null;

  // Extract Linear's own error payload (carries status + requestId) when
  // present. Require the "error" key: success payloads (e.g. an issue
  // object, which has its own unrelated "status" field) must not match.
  let error: unknown = null;
  let httpStatus: number | null = null;
  if (result && Array.isArray(result['content'])) {
    for (const item of result['content']) {
      const text = asRecord(item)?.['text'];
      if (typeof text !== 'string' || !text) continue;
      const rec = asRecord(parseJson(text));
      if (rec && 'error' in rec) {
        if (typeof rec['status'] === 'number') httpStatus = rec['status'];
        error = {
          error: rec['error'],
          message: rec['message'],
          requestId: rec['requestId'],
        };
        break;
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
    service: 'linear',
    params: { tool, arguments: arguments_ },
    response: body,
    httpStatus: httpStatus ?? undefined,
    ok: typeof ok === 'boolean' ? ok : undefined,
    isError: isError === null || isError === undefined ? undefined : Boolean(isError),
    error,
    exitCode: proc.status ?? undefined,
    stderr: stderr || undefined,
  });

  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return proc.status ?? 1;
}
