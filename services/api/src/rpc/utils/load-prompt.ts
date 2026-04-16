import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cache = new Map<string, string>();

/**
 * Reads a prompt from `src/rpc/prompts/<name>.md` and caches the result.
 * Pass just the base name without extension, e.g. `'chat-assistant'`.
 */
export function loadPrompt(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const filePath = join(import.meta.dirname, '..', 'prompts', `${name}.md`);
  const content = readFileSync(filePath, 'utf-8').trim();
  cache.set(name, content);
  return content;
}
