import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Suite } from '../lib/suite';

// Everything under the package root is walked, so skip what isn't source.
const skippedDirs = new Set(['node_modules', 'runs', 'baselines', 'eval-costs']);
const root = new URL('../', import.meta.url).pathname;

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() && !skippedDirs.has(entry.name)
        ? walk(join(dir, entry.name))
        : Promise.resolve(entry.name.endsWith('.suite.ts') ? [join(dir, entry.name)] : []),
    ),
  );
  return nested.flat().sort();
};

/** Loads every `*.suite.ts` default export. Offline: building a suite never calls a model. */
export async function discoverSuites(): Promise<Suite[]> {
  const files = await walk(root);
  const suites: Suite[] = [];
  for (const file of files) {
    const module = (await import(pathToFileURL(file).href)) as { default?: Suite };
    if (!module.default) throw new Error(`${file} must export a Suite as its default export`);
    suites.push(module.default);
  }
  const names = suites.map((suite) => suite.name);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate) throw new Error(`Duplicate suite name: ${duplicate}`);
  return suites;
}
