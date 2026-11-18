// Build and typecheck timings, plus the size of the built web client.
// Slow: runs real package commands. Only runs under `--full`.
//
// A failed command is recorded as `failed` with its exit code. It is never
// dropped, so a broken build shows up in the weekly report.

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TASKS = [
  { name: 'api.typecheck', args: ['--filter', '@hominem/api', 'typecheck'] },
  { name: 'finance.typecheck', args: ['--filter', '@hominem/finance-services', 'typecheck'] },
  { name: 'web.build', args: ['--filter', '@hominem/web', 'build'] },
];

function run(root, args) {
  const start = performance.now();
  const seconds = () => Math.round((performance.now() - start) / 1000);
  try {
    const out = execFileSync('pnpm', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 900_000,
    });
    // pnpm exits 0 when a filter matches nothing. Treat that as a failure.
    if (out.includes('No projects matched')) {
      return {
        status: 'failed',
        exitCode: 0,
        seconds: seconds(),
        note: 'pnpm filter matched no package',
      };
    }
    return { status: 'ok', seconds: seconds() };
  } catch (err) {
    return {
      status: 'failed',
      exitCode: err.status ?? null,
      seconds: seconds(),
      stderrTail: String(err.stderr ?? '')
        .split('\n')
        .slice(-8)
        .join('\n'),
    };
  }
}

function dirBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? dirBytes(path) : statSync(path).size;
  }
  return total;
}

export function buildTimings(root) {
  const timings = {};
  for (const task of TASKS) {
    timings[task.name] = run(root, task.args);
  }
  const clientDir = join(root, 'apps/web/build/client');
  timings.webClientBytes = existsSync(clientDir) ? dirBytes(clientDir) : null;
  return timings;
}
