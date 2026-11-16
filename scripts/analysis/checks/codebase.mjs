// Codebase size, surface, and debt metrics. All counts come from the working
// tree (see lib/repo.mjs), so they reflect uncommitted work too. Counts are
// approximate: they use text patterns, not an AST.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { git, listFiles } from '../lib/repo.mjs';

const SOURCE_EXT = /\.(ts|tsx|mjs|js|sql)$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx|mjs|js)$/;
const GENERATED = /(^|\/)(build|dist|\.cache|\.turbo|node_modules|Pods|\.expo|coverage)\//;

function readText(root, rel) {
  try {
    return readFileSync(join(root, rel), 'utf8');
  } catch {
    return '';
  }
}

function countMatches(text, re) {
  return (text.match(re) ?? []).length;
}

// Top-level workspace: apps/web, services/api, packages/db, and so on.
function workspaceOf(file) {
  const [top, second] = file.split('/');
  if (top === 'apps' || top === 'services' || top === 'packages') return `${top}/${second}`;
  return top;
}

export function codebaseMetrics(root) {
  const files = listFiles(root).filter((f) => !GENERATED.test(f));
  const source = files.filter((f) => SOURCE_EXT.test(f) && !TEST_FILE.test(f));
  const tests = files.filter((f) => TEST_FILE.test(f));

  const loc = {};
  let totalLoc = 0;
  for (const file of source) {
    const lines = readText(root, file).split('\n').length;
    const ws = workspaceOf(file);
    loc[ws] = (loc[ws] ?? 0) + lines;
    totalLoc += lines;
  }

  let testCases = 0;
  for (const file of tests) {
    testCases += countMatches(readText(root, file), /\b(it|test)\(\s*['"`]/g);
  }

  const apiRouteFiles = source.filter((f) => f.startsWith('services/api/src/rpc/routes/'));
  let apiEndpoints = 0;
  for (const file of apiRouteFiles) {
    apiEndpoints += countMatches(readText(root, file), /\.(get|post|put|patch|delete)\(\s*'/g);
  }

  const mcpTools = source
    .filter((f) => f.startsWith('services/api/src/mcp/tools/'))
    .reduce((n, f) => n + countMatches(readText(root, f), /registerTool\(/g), 0);

  const apiSource = source.filter((f) => f.startsWith('services/api/src/'));
  const debt = { anyTypes: 0, neverCasts: 0, doubleCasts: 0, todos: 0 };
  for (const file of apiSource) {
    const text = readText(root, file);
    debt.anyTypes += countMatches(text, /:\s*any\b|as any\b/g);
    debt.neverCasts += countMatches(text, /\bas never\b/g);
    debt.doubleCasts += countMatches(text, /\bas unknown as\b/g);
    debt.todos += countMatches(text, /\b(TODO|FIXME)\b/g);
  }

  const migrations = files.filter((f) => /^packages\/db\/migrations\/.+\.sql$/.test(f)).length;

  const status = git(root, ['status', '--porcelain']).split('\n').filter(Boolean);
  const dirty = {
    modified: status.filter((l) => /^.M|^M/.test(l)).length,
    deleted: status.filter((l) => /^.D|^D/.test(l)).length,
    untracked: status.filter((l) => l.startsWith('??')).length,
  };

  return {
    git: {
      branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
      head: git(root, ['rev-parse', '--short', 'HEAD']),
      dirty,
    },
    loc: { total: totalLoc, byWorkspace: loc },
    tests: { files: tests.length, casesApprox: testCases },
    surface: { apiEndpointsApprox: apiEndpoints, mcpToolsApprox: mcpTools, migrations },
    debt,
  };
}
