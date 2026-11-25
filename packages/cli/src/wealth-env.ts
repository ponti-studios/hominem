import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { HOMINEM_HOME } from './paths.js';

export function envFilePath(): string {
  return process.env.HOMINEM_AGENT_ENV_FILE ?? join(HOMINEM_HOME, 'env');
}

export async function loadEnvFile(path: string): Promise<Record<string, string>> {
  let contents: string;
  try {
    contents = await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  }
  const values: Record<string, string> = {};
  for (const line of contents.split('\n')) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;
    const separator = text.indexOf('=');
    if (separator <= 0) continue;
    const key = text
      .slice(0, separator)
      .trim()
      .replace(/^export\s+/, '');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = text.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.startsWith('~/')) value = join(homedir(), value.slice(2));
    values[key] = value.replace(
      /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
      (match, braced: string | undefined, bare: string | undefined) =>
        process.env[braced ?? bare ?? ''] ?? match,
    );
  }
  return values;
}

export async function applyEnvDefaults(path = envFilePath()): Promise<void> {
  for (const [key, value] of Object.entries(await loadEnvFile(path))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
