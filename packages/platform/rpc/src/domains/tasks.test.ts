import { describe, expect, it, vi } from 'vitest';

import { createTasksClient } from './tasks';

describe('tasks client', () => {
  it('sends the shared artifact payload to the tasks endpoint', async () => {
    const post = vi.fn(async (_path: string, _options: { json: unknown }) => ({
      json: async () => ({
        artifactType: 'task_list',
        completedAt: null,
        createdAt: '2026-04-13T07:00:00.000Z',
        description: 'Preview body',
        id: 'task-1',
        ownerUserId: 'user-1',
        parentTaskId: null,
        priority: 'medium',
        status: 'pending',
        title: 'Plan the rollout',
        updatedAt: '2026-04-13T07:00:00.000Z',
      }),
    }));

    const client = createTasksClient({ post } as never);
    const task = await client.create({
      artifactType: 'task_list',
      description: 'Preview body',
      title: 'Plan the rollout',
    });

    expect(post).toHaveBeenCalledWith('/api/tasks', {
      json: {
        artifactType: 'task_list',
        description: 'Preview body',
        title: 'Plan the rollout',
      },
    });
    expect(task).toMatchObject({
      artifactType: 'task_list',
      title: 'Plan the rollout',
    });
  });
});
