import { describe, expect, it, vi } from 'vitest';

import { TaskRepository } from './task.repository';

describe('TaskRepository', () => {
  it('creates a task record with the supplied artifact type', async () => {
    const executeTakeFirstOrThrow = vi.fn(async () => ({
      completed_at: null,
      createdat: new Date('2026-04-13T07:00:00.000Z'),
      description: 'Preview body',
      id: 'task-1',
      owner_userid: 'user-1',
      parent_task_id: null,
      priority: 'medium',
      status: 'pending',
      title: 'Plan the rollout',
      updatedat: new Date('2026-04-13T07:00:00.000Z'),
    }));
    const returningAll = vi.fn(() => ({ executeTakeFirstOrThrow }));
    const values = vi.fn(() => ({ returningAll }));
    const insertInto = vi.fn(() => ({ values }));
    const handle = { insertInto } as never;

    const task = await TaskRepository.create(handle, {
      artifactType: 'task_list',
      description: 'Preview body',
      title: 'Plan the rollout',
      userId: 'user-1',
    });

    expect(insertInto).toHaveBeenCalledWith('app.tasks');
    expect(values).toHaveBeenCalledWith({
      description: 'Preview body',
      owner_userid: 'user-1',
      parent_task_id: null,
      primary_space_id: null,
      title: 'Plan the rollout',
    });
    expect(task).toMatchObject({
      artifactType: 'task_list',
      title: 'Plan the rollout',
    });
  });
});
