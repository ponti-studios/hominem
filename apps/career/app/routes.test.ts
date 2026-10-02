import type { RouteConfigEntry } from '@react-router/dev/routes';
import { describe, expect, it } from 'vitest';

import routes from './routes';

function flattenPaths(nodes: readonly RouteConfigEntry[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.path ? [node.path] : []),
    ...flattenPaths(node.children ?? []),
  ]);
}

describe('route config', () => {
  it('registers the unified project routes and removes the nested work projects route', () => {
    const paths = flattenPaths(routes);

    expect(paths).toContain('projects');
    expect(paths).toContain('projects/new');
    expect(paths).toContain('projects/:id');
    expect(paths).not.toContain('work/:id/projects');
  });
});
