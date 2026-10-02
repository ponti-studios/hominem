import { describe, expect, it } from 'vitest';

import './tools/memory';
import './tools/notes';
import './tools/tasks';
import { listTools } from './tool-registry';

// A standalone write may run without a preceding read, so adding one is a decision.
describe('standalone writes', () => {
  it('are exactly the creates that need no target', () => {
    const names = listTools()
      .filter((tool) => tool.standaloneWrite)
      .map((tool) => tool.name)
      .sort();

    expect(names).toEqual(['note_create', 'remember', 'task_create']);
  });

  it('are never read-only, destructive or confirmation-gated', () => {
    for (const tool of listTools().filter((candidate) => candidate.standaloneWrite)) {
      expect(tool.readOnly, tool.name).toBe(false);
      expect(tool.destructive, tool.name).toBeFalsy();
      expect(tool.requiresConfirmation, tool.name).toBeFalsy();
    }
  });
});
