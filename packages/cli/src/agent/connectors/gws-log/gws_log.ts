#!/usr/bin/env node
/**
 * Logged wrapper for the Google Workspace CLI.
 *
 * Hominem TypeScript port of gws_log.py (Charlie's rule, 1 Nov 2026). Every
 * Google Workspace call (Gmail, Google Calendar, and the rest of the gws
 * surface) goes through this wrapper. It records ONE audit row per call in
 * ~/.hominem/agent.db (events, connector "gws") — rows, not log files.
 *
 * Transparent passthrough: the real CLI's stdout, stderr and exit code are
 * passed through unchanged. The real CLI binary resolves from the GWS_CLI
 * environment variable (law 4: no machine paths); a missing variable is a
 * named error, not a guess.
 */
import { spawnSync } from 'node:child_process';

import { logEvent } from '../../log/agent_log.ts';

const CONNECTOR = 'gws';
const SERVICES = new Set([
  'gmail',
  'calendar',
  'drive',
  'docs',
  'sheets',
  'tasks',
  'people',
  'chat',
  'meet',
]);

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
  const real = process.env.GWS_CLI;
  if (!real) {
    process.stderr.write(
      'gws_log: GWS_CLI is not set — point it at the Google Workspace CLI binary.\n',
    );
    return 2;
  }

  const tsReq = now();
  const start = performance.now();
  const proc = spawnSync(real, argv, { encoding: 'utf-8' });
  const durationMs = Math.round(performance.now() - start);
  const tsRes = now();

  // Service routing: first word, or schema <service>.<method>
  let service = 'other';
  if (argv.length > 0) {
    if (SERVICES.has(argv[0]!)) {
      service = argv[0]!;
    } else if (argv[0] === 'schema' && argv.length > 1) {
      const head = argv[1]!.split('.')[0]!;
      if (SERVICES.has(head)) service = head;
    }
  }

  let params: unknown = null;
  let jsonBody: unknown = null;
  for (const [flag, target] of [
    ['--params', 'params'],
    ['--json', 'json_body'],
  ] as const) {
    const idx = argv.indexOf(flag);
    if (idx >= 0 && idx + 1 < argv.length) {
      const parsed = parseJson(argv[idx + 1]!);
      if (target === 'params') params = parsed;
      else jsonBody = parsed;
    }
  }

  const stdout = proc.stdout ?? '';
  const stderr = proc.stderr ?? '';
  const body = parseJson(stdout);

  let isError = false;
  let error: unknown = null;
  let httpStatus: number | null = null;
  const bodyRecord =
    body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  if (bodyRecord && typeof bodyRecord['error'] === 'object' && bodyRecord['error'] !== null) {
    const gerr = bodyRecord['error'] as Record<string, unknown>;
    isError = true;
    const code = gerr['code'];
    if (typeof code === 'number') httpStatus = code;
    error = { error: gerr['status'] ?? code, message: gerr['message'], requestId: null };
  }
  if (error === null && typeof body === 'string' && body.trim().toLowerCase().startsWith('error')) {
    isError = true;
    error = { error: 'cli_error_text', message: body.trim().slice(0, 500), requestId: null };
  }
  if (error === null && proc.status !== 0) {
    isError = true;
    error = {
      error: 'cli_exit_nonzero',
      message: (stderr || (typeof body === 'string' ? body : '')).slice(0, 500),
      requestId: null,
    };
  }

  const ok = proc.status === 0 && !isError;
  if (httpStatus === null && ok) httpStatus = 200;

  logEvent(CONNECTOR, argv, {
    tsRequest: tsReq.iso,
    tsRequestMs: tsReq.ms,
    tsResponse: tsRes.iso,
    tsResponseMs: tsRes.ms,
    durationMs,
    service,
    params,
    jsonBody,
    response: body,
    httpStatus: httpStatus ?? undefined,
    ok,
    isError,
    error,
    exitCode: proc.status ?? undefined,
    stderr: stderr || undefined,
  });

  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return proc.status ?? 1;
}
