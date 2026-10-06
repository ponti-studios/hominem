// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderHookWithQueryClient } from '../../utils/render-hook';

const service = { complete: vi.fn() };

vi.mock('~/services/tasks/task-service-instance', () => ({
  getTaskService: () => service,
}));

const { useTaskComplete } = await import('~/services/tasks/use-task-complete');

describe('useTaskComplete', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('completes the task in the local service', async () => {
    const { result } = renderHookWithQueryClient(() => useTaskComplete());

    await act(async () => {
      await result.current.mutateAsync({ taskId: 'task-1', completed: true });
    });

    expect(service.complete).toHaveBeenCalledWith('task-1', true);
  });

  it('can reopen a completed task', async () => {
    const { result } = renderHookWithQueryClient(() => useTaskComplete());

    await act(async () => {
      await result.current.mutateAsync({ taskId: 'task-1', completed: false });
    });

    expect(service.complete).toHaveBeenCalledWith('task-1', false);
  });
});
