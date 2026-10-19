import type { RouteConfigEntry } from '@react-router/dev/routes';
import { describe, expect, it } from 'vitest';

import routes from './routes';

function collectPaths(entries: RouteConfigEntry[]): string[] {
  return entries.flatMap((entry) => [
    ...(entry.path ? [entry.path] : []),
    ...(entry.children ? collectPaths(entry.children) : []),
  ]);
}

describe('finance app route config', () => {
  const paths = collectPaths(routes);

  it('does not register import pages or APIs', () => {
    expect(paths.some((path) => path === 'import' || path.startsWith('api/finance/import'))).toBe(
      false,
    );
  });
});
