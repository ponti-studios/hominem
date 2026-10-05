import { describe, expect, it } from 'vitest';

import { getOpenTasks, taskTimeLabel } from '~/components/tasks/task-time';
import type { TaskListItem } from '~/services/tasks/task-types';

const task = (overrides: Partial<TaskListItem> = {}): TaskListItem => ({
  completedAt: null,
  createdAt: '2026-07-28T09:00:00.000Z',
  dueAt: null,
  id: 'task-1',
  listTitle: 'Omiro',
  location: null,
  notes: null,
  priority: 'medium',
  startAt: null,
  status: 'pending',
  title: 'Write brief',
  ...overrides,
});

describe('getOpenTasks', () => {
  it('drops completed tasks', () => {
    const open = task({ id: 'open' });
    const done = task({ id: 'done', status: 'completed' });
    expect(getOpenTasks([open, done])).toEqual([open]);
  });
});

describe('taskTimeLabel', () => {
  it('is null when the task has no time', () => {
    expect(taskTimeLabel(task())).toBeNull();
  });

  it('shows a single time or a range', () => {
    const single = taskTimeLabel({ dueAt: '2026-07-28T10:30:00.000Z', startAt: null });
    const range = taskTimeLabel({
      dueAt: '2026-07-28T10:30:00.000Z',
      startAt: '2026-07-28T10:00:00.000Z',
    });
    expect(single).toBeTruthy();
    expect(range).toContain('–');
  });
});
