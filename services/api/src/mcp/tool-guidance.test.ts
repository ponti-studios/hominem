import { describe, expect, it } from 'vitest';

import './tools/memory';
import './tools/tasks';
import { describeCapability } from './tool-planner';
import { getToolDefinition } from './tool-registry';

// What the model reads about a tool is part of the product: a live model chose `remember`
// over `task_create` for "i need to renew my passport on <date>" when only the former
// said when to use it.
describe('task and memory tool guidance', () => {
  const described = (name: string) => {
    const definition = getToolDefinition(name);
    if (!definition) throw new Error(`${name} is not registered`);
    return describeCapability(definition);
  };

  it('tells the model when to create a task, even without the words "add a task"', () => {
    expect(described('task_create')).toMatch(/Use when: .*need or want to do something/);
    expect(described('task_create')).toContain('even if they never say "add a task"');
    expect(described('task_create')).toMatch(/Do not use when: .*use remember/);
  });

  it('keeps commitments and dates out of memory', () => {
    expect(described('remember')).toMatch(/Do not use when: .*use task_create/);
    expect(described('remember')).toMatch(/deadlines, appointments and reminders are tasks/);
  });

  it('tells the model to resolve loose task references through task_list', () => {
    for (const name of ['task_update', 'task_complete', 'task_delete']) {
      expect(described(name), name).toContain('listing tasks and matching titles');
    }
  });
});
