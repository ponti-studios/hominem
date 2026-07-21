import type { TaskListItem } from '@hominem/rpc/types';
import { describe, expect, it } from 'vitest';

import { filterTasks } from '~/services/tasks/screen-state';

const TASKS: TaskListItem[] = [
  { id: 'task-1', title: 'Draft design constitution', description: 'Write the token rules' },
  { id: 'task-2', title: 'Buy groceries', description: 'Milk, eggs, bread' },
  { id: 'task-3', title: 'Review PR', description: 'Design system button tokens' },
] as TaskListItem[];

describe('filterTasks', () => {
  it('returns every task for an empty query', () => {
    expect(filterTasks(TASKS, '').map((task) => task.id)).toEqual(['task-1', 'task-2', 'task-3']);
  });

  it('matches against the task title', () => {
    expect(filterTasks(TASKS, 'groceries').map((task) => task.id)).toEqual(['task-2']);
  });

  it('matches against the task description', () => {
    expect(filterTasks(TASKS, 'token').map((task) => task.id)).toEqual(['task-1', 'task-3']);
  });

  it('is case-insensitive', () => {
    expect(filterTasks(TASKS, 'DESIGN').map((task) => task.id)).toEqual(['task-1', 'task-3']);
  });

  it('returns no tasks when nothing matches', () => {
    expect(filterTasks(TASKS, 'nonexistent')).toEqual([]);
  });
});
