#!/usr/bin/env node
/**
 * Logged wrapper for the Ponti API MCP clients.
 *
 * Hominem TypeScript port of the tested Python port (original rule: Charlie,
 * 1 Nov 2026). Every Ponti call goes through this wrapper; one audit row
 * per call in ~/.hominem/agent.db (events, connector "ponti") — rows, not
 * log files. The original's mcp/mcp2 client selector lands in the `service`
 * column; `tool` and arguments fold into `params`. Transparent passthrough.
 *
 * The real client resolves from the PONTI_CLI environment variable (law 4);
 * a missing variable is a named error, not a guess.
 */
import { spawnSync } from 'node:child_process';

import { asRecord } from '../../guards.ts';
import { logEvent } from '../../log/agent_log.ts';

const CONNECTOR = 'ponti';

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

export function main(args = process.argv.slice(2)): number {
  const real = process.env.PONTI_CLI;
  if (!real) {
    process.stderr.write(
      'ponti_log: PONTI_CLI is not set — point it at the Ponti MCP client binary.\n',
    );
    return 2;
  }

  // Client selector: `mcp`/`mcp2` as the first argument (audit column:
  // events.service), otherwise the default client.
  let argv = args;
  let client: string | null = null;
  if (argv.length > 0 && (argv[0] === 'mcp' || argv[0] === 'mcp2')) {
    client = argv[0]!;
    argv = argv.slice(1);
  }

  const tsReq = now();
  const start = performance.now();
  const proc = spawnSync(real, argv, { encoding: 'utf-8' });
  const durationMs = Math.round(performance.now() - start);
  const tsRes = now();

  const stdout = proc.stdout ?? '';
  const stderr = proc.stderr ?? '';

  // Request side: `call <tool> --args '{...}'` / `--params`
  let tool: string | null = null;
  let arguments_: unknown = null;
  const named = argv[1];
  if (
    (argv[0] === 'call' || argv[0] === 'confirm') &&
    named !== undefined &&
    !named.startsWith('-')
  ) {
    tool = named;
  }
  for (const flag of ['--args', '--params']) {
    const idx = argv.indexOf(flag);
    if (idx >= 0 && idx + 1 < argv.length) {
      arguments_ = parseJson(argv[idx + 1]!);
    }
  }

  // Response side
  const body = parseJson(stdout);
  const bodyRecord = asRecord(body);

  let isError = false;
  let error: unknown = null;
  let httpStatus: number | null = null;

  if (bodyRecord) {
    isError = Boolean(bodyRecord['isError']);
    const rpcErr = asRecord(bodyRecord['error']);
    if (rpcErr) {
      // JSON-RPC error object
      isError = true;
      error = { error: rpcErr['code'], message: rpcErr['message'], requestId: null };
    }
    const containers: Record<string, unknown>[] = [];
    const result = asRecord(bodyRecord['result']);
    if (result) containers.push(result);
    containers.push(bodyRecord);
    for (const container of containers) {
      const content = container['content'];
      if (!Array.isArray(content)) continue;
      for (const item of content) {
        const text = asRecord(item)?.['text'];
        if (typeof text !== 'string' || !text) continue;
        const inner = parseJson(text);
        const innerRecord = asRecord(inner);
        if (!innerRecord || !('error' in innerRecord)) continue;
        isError = true;
        const innerError = asRecord(innerRecord['error']);
        if (innerError) {
          const code = innerError['code'];
          error = {
            error: code ?? innerError['status'],
            message: innerError['message'],
            requestId: null,
          };
          if (typeof code === 'number' && code >= 100) httpStatus = code;
        } else {
          error = { error: innerRecord['error'], message: innerRecord['message'], requestId: null };
        }
      }
    }
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
  if (error === null && stderr && stderr.toLowerCase().includes('error')) {
    isError = true;
    error = { error: 'stderr_error', message: stderr.trim().slice(0, 500), requestId: null };
  }

  const ok = proc.status === 0 && !isError;
  if (httpStatus === null && ok) httpStatus = 200;

  logEvent(
    CONNECTOR,
    [client, ...argv].filter((x) => x !== null),
    {
      tsRequest: tsReq.iso,
      tsRequestMs: tsReq.ms,
      tsResponse: tsRes.iso,
      tsResponseMs: tsRes.ms,
      durationMs,
      service: client ?? undefined,
      params: { client, tool, arguments: arguments_ },
      response: body,
      httpStatus: httpStatus ?? undefined,
      ok,
      isError,
      error,
      exitCode: proc.status ?? undefined,
      stderr: stderr || undefined,
    },
  );

  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return proc.status ?? 1;
}
