/**
 * Machine env resolution (law 4: two machines, no machine paths — binaries,
 * credentials and the db resolve from environment config, and a missing
 * variable fails by name, never by guessing).
 *
 * Charlie's machine env lives in the repo-local `.env` (gitignored — it
 * holds live secrets like STARLING_API_TOKEN, added 2026-11-22). The
 * launcher sources it; direct node runs get the same values through
 * `applyEnvDefaults`, which only fills keys the environment is silent on,
 * so an exported var always wins. Values are never logged and never
 * committed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The env file to read: `HOMINEM_AGENT_ENV_FILE` if set, else the Hominem machine env. */
export function envFilePath(): string {
  return process.env.HOMINEM_AGENT_ENV_FILE ?? join(homedir(), '.hominem', 'env');
}

function expand(value: string): string {
  const withoutTilde = value.startsWith('~/') ? join(homedir(), value.slice(2)) : value;
  return withoutTilde.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (match, braced, bare) => {
      const name = braced ?? bare;
      return process.env[name] ?? match;
    },
  );
}

/** Parse an export KEY=VALUE file without evaluating shell syntax. */
export function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const rawKey = t.slice(0, eq).trim();
    const key = rawKey.startsWith('export ') ? rawKey.slice(7).trim() : rawKey;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = expand(val);
  }
  return out;
}

/** Apply file values only where the environment is silent — env wins. */
export function applyEnvDefaults(file = envFilePath()): void {
  for (const [k, v] of Object.entries(loadEnvFile(file))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

/** A required env/config value is missing — the error names it (law 4). */
export class MissingEnvError extends Error {
  constructor(name: string) {
    super(
      `${name} is not set (checked process env and ${envFilePath()}) — ` +
        `set it in the environment or the machine .env`,
    );
    this.name = 'MissingEnvError';
  }
}

/** Resolve a config value: explicit arg first, then env, else named error. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new MissingEnvError(name);
  return v;
}

/** Resolve an optional env value with a default. */
export function envOr(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}
