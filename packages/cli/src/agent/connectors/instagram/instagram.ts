#!/usr/bin/env node
/**
 * Logged wrapper for the Instagram CLI (Mac-local ~/ig-tools).
 *
 * Hominem's Instagram connector, FINAL architecture (2026-11-22): there is
 * no official personal API, and the session cookie is HttpOnly — so the
 * YTM-style cookie harvest is impossible here. The Mac-local toolkit
 * (~/ig-tools/ig) speaks MCP stdio to the Browser MCP daemon, which
 * drives the signed-in Chrome; reads run in-page on the instagram.com
 * origin where the HttpOnly cookies ride along. The retired extension
 * route (archived custom.playwright-chrome) died with the Chrome
 * extension — see CONNECTOR.md.
 *
 * Transparent passthrough (the ytm pattern): the real CLI's stdout,
 * stderr and exit code pass through unchanged, and every invocation
 * records ONE audit row in ~/.hominem/agent.db (events, connector
 * "instagram"). The CLI resolves from the IG_CLI environment variable
 * (law 4: no machine paths); a missing variable is a named error, not
 * a guess.
 *
 * v1 is read-only (profile / me). Mutations land v1.1 behind an
 * explicit irreversible-command guard, same as ytm delete.
 *
 * Usage (through the launcher):
 *   hominem instagram profile <handle>
 *   hominem instagram me
 */
import { spawnSync } from 'node:child_process';

import { asRecord } from '../../guards.ts';
import { logEvent } from '../../log/agent_log.ts';

const CONNECTOR = 'instagram';

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
  const real = process.env.IG_CLI;
  if (!real) {
    process.stderr.write(
      'instagram: IG_CLI is not set — point it at the Instagram CLI (the ~/ig-tools shim).\n',
    );
    return 2;
  }

  const cmd = argv[0] ?? 'other';
  const cleanArgs = argv.slice(1);

  const tsReq = now();
  const start = performance.now();
  const proc = spawnSync(real, argv, { encoding: 'utf-8' });
  const durationMs = Math.round(performance.now() - start);
  const tsRes = now();

  const stdout = proc.stdout ?? '';
  const stderr = proc.stderr ?? '';
  const body = parseJson(stdout);

  // Error triage: a nonzero exit, or an in-band {ok:false} payload.
  let isError = false;
  let error: unknown = null;
  if (proc.status !== 0) {
    isError = true;
    error = {
      error: 'cli_exit_nonzero',
      message: (stderr || (typeof body === 'string' ? body : '')).slice(0, 500),
      requestId: null,
    };
  } else if (asRecord(body)?.['ok'] === false) {
    isError = true;
    error = {
      error: 'cli_error_payload',
      message: asRecord(body)?.['error'],
      requestId: null,
    };
  }

  const ok = proc.status === 0 && !isError;
  logEvent(CONNECTOR, argv, {
    tsRequest: tsReq.iso,
    tsRequestMs: tsReq.ms,
    tsResponse: tsRes.iso,
    tsResponseMs: tsRes.ms,
    durationMs,
    service: cmd,
    params: cleanArgs,
    response: body,
    httpStatus: ok ? 200 : undefined,
    ok,
    isError,
    error: error ?? undefined,
    exitCode: proc.status ?? undefined,
    stderr: stderr || undefined,
  });

  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return proc.status ?? 1;
}
