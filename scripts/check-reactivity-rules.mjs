import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { exit } from 'node:process';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '..');
const runtimeSearchRoots = ['apps', 'packages', 'services'];
const excludedGlobs = ['--glob=!**/*.stories.*', '--glob=!**/*.test.*', '--glob=!**/node_modules/**'];

function runRg(args) {
  const result = spawnSync('rg', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr || 'Failed to execute rg');
  }

  return result.stdout.trim();
}

function parseConfig() {
  const configPath = join(repoRoot, 'scripts/config/reactivity-shims.json');
  const raw = readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

function isExpired(dateText) {
  const today = new Date();
  const expiry = new Date(`${dateText}T23:59:59.999Z`);
  return Number.isFinite(expiry.valueOf()) && expiry.valueOf() < today.valueOf();
}

function reportSynchronizedStateCandidates(files) {
  const synchronizedCandidates = [];

  for (const file of files) {
    const absolute = join(repoRoot, file);
    const content = readFileSync(absolute, 'utf8');
    const hasSyncPattern = /useEffect\s*\([\s\S]{0,300}?set[A-Z][A-Za-z0-9_]*/m.test(content);
    if (hasSyncPattern) {
      synchronizedCandidates.push(file);
    }
  }

  if (synchronizedCandidates.length === 0) {
    return;
  }

  console.log('\n[reactivity-check] synchronized-state candidates (manual review):');
  for (const file of synchronizedCandidates) {
    console.log(`  - ${file}`);
  }
}

function main() {
  const config = parseConfig();

  if (isExpired(config.expiresOn)) {
    console.error(
      `[reactivity-check] migration shim window expired on ${config.expiresOn}. Remove remaining useEffect occurrences or extend with explicit approval.`,
    );
    exit(1);
  }

  const output = runRg([
    '-l',
    '\\b(useEffect|React\\.useEffect)\\s*\\(',
    ...runtimeSearchRoots,
    ...excludedGlobs,
  ]);

  if (!output) {
    console.log('[reactivity-check] pass: no runtime useEffect usage found.');
    exit(0);
  }

  const discoveredFiles = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();

  const allowed = new Set(config.files);
  const disallowed = discoveredFiles.filter((file) => !allowed.has(file));

  if (disallowed.length > 0) {
    console.error('[reactivity-check] fail: runtime useEffect usage is restricted to migration shims.');
    console.error(`[reactivity-check] allowlisted shims expire on ${config.expiresOn}.`);
    for (const file of disallowed) {
      console.error(`  - ${file}`);
    }
    exit(1);
  }

  console.log(
    `[reactivity-check] pass with migration shims (${discoveredFiles.length} files, expires ${config.expiresOn}).`,
  );

  reportSynchronizedStateCandidates(discoveredFiles);
}

main();
