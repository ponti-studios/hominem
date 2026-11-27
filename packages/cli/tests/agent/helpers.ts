/** Shared test helpers: mock CLIs, wrapper execution, audit-row reads. */
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const AGENT_RUNNER = join(ROOT, 'tests/agent/run_module.ts');

export function makeMockCli(dir: string, name: string, body: string): string {
  const p = join(dir, name);
  writeFileSync(p, `#!/usr/bin/env node\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}

export async function runWrapper(
  wrapper: string,
  env: Record<string, string | undefined>,
  args: string[],
  stdin = '',
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  // Async spawn, never spawnSync: a synchronous spawn blocks this process's
  // event loop, which deadlocks against an in-process mock HTTP server
  // (the child's fetch waits on us while we wait on the child).
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [AGENT_RUNNER, join(ROOT, 'src/agent', wrapper), ...args], {
      env: { ...process.env, ...env } as Record<string, string>,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    proc.stdin.on('error', () => {}); // wrapper may exit before stdin drains
    proc.stdin.end(stdin);
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`wrapper timed out: ${wrapper}`));
    }, 30_000);
    proc.stdout!.on('data', (d) => (stdout += d));
    proc.stderr!.on('data', (d) => (stderr += d));
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ status: code, stdout, stderr });
    });
  });
}

export function rows(dbPath: string, table: 'events' | 'runs'): Record<string, unknown>[] {
  if (!existsSync(dbPath)) return [];
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

export function tmpDb(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return join(dir, 'agent.db');
}

export function j(v: unknown): any {
  return v === null || v === undefined ? null : JSON.parse(v as string);
}
