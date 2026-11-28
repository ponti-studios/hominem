#!/usr/bin/env node
/**
 * Logged wrapper for the YouTube Music CLI (Mac-local ~/ytm-tools).
 *
 * Hominem TypeScript port of custom.youtube-music, FINAL architecture:
 * the Mac-local toolkit (~/ytm-tools/ytm.py, ytmusicapi, auth = session
 * cookies harvested from this Mac's Chrome profile at runtime) — the
 * retired ytm-bridge route is gone (v1 died silently; Chase killed the
 * approach 2026-10-22).
 *
 * Transparent passthrough: the real CLI's stdout, stderr and exit code
 * pass through unchanged, and every invocation records ONE audit row in
 * ~/.hominem/agent.db (events, connector "youtube-music") — rows, not log
 * files. The CLI resolves from the YTM_CLI environment variable (law 4:
 * no machine paths); a missing variable is a named error, not a guess.
 *
 * The one policy the wrapper owns: `delete` — the irreversible command
 * — refuses without an explicit --yes (exit 3, named, never a side
 * effect, no external call, no audit row because nothing happened).
 *
 * Per the connector doc's rule: verify every mutation by reading the
 * playlist back before reporting it done.
 *
 * Usage (through the launcher):
 *   hominem ytm status                      # library playlists summary
 *   hominem ytm playlists                   # list library playlists
 *   hominem ytm playlist <playlistId>       # a playlist's tracks
 *   hominem ytm search <query...>           # song search (top 10)
 *   hominem ytm create <title> [privacy]     # PRIVATE|PUBLIC|UNLISTED
 *   hominem ytm add <playlistId> <videoId...>
 *   hominem ytm add-playlist <pid> <sourcePid>
 *   hominem ytm remove <playlistId> <videoId...>
 *   hominem ytm edit <pid> [--title T] [--description D] [--privacy P]
 *   hominem ytm delete <playlistId> --yes   # irreversible; --yes required
 *   hominem ytm reauth                      # force the cookie re-harvest
 */
import { spawnSync } from 'node:child_process';

import { asRecord } from '../../guards.ts';
import { logEvent } from '../../log/agent_log.ts';

const CONNECTOR = 'youtube-music';

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
  const real = process.env.YTM_CLI;
  if (!real) {
    process.stderr.write(
      'ytm: YTM_CLI is not set — point it at the YouTube Music CLI (the ~/ytm-tools shim).\n',
    );
    return 2;
  }

  // Irreversible guard: delete requires an explicit --yes, refused
  // before any external call (nothing happened, nothing logged).
  if (argv[0] === 'delete' && !argv.includes('--yes')) {
    process.stderr.write(
      'ytm delete is irreversible. Re-run with --yes to confirm:\n' +
        '  ytm delete <playlistId> --yes\n',
    );
    return 3;
  }
  const cmd = argv[0] ?? 'other';
  const cleanArgs = argv.slice(1).filter((a) => a !== '--yes');

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
