// Small helpers over git so the analysis reads the working tree as it is now.
//
// listFiles uses --cached --others --exclude-standard: tracked files plus
// untracked files that git does not ignore. Uncommitted work is included on
// purpose, because "where we are" includes changes not yet committed.

import { execFileSync } from 'node:child_process';

import { globToRegExp } from './glob.mjs';

export function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

let cache = null;

export function listFiles(root) {
  if (!cache) {
    cache = git(root, ['ls-files', '--cached', '--others', '--exclude-standard'])
      .split('\n')
      .filter(Boolean);
  }
  return cache;
}

// Files matching a glob such as `services/api/src/**/*.ts`.
export function listMatching(root, pattern) {
  const re = globToRegExp(pattern);
  return listFiles(root).filter((file) => re.test(file));
}
