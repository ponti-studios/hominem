// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderHookWithQueryClient } from '../../utils/render-hook';

const service = { remove: vi.fn() };

vi.mock('~/services/tasks/task-service-instance', () => ({
  getTaskService: () => service,
}));

const { useTaskDelete } = await import('~/services/tasks/use-task-delete');

describe('useTaskDelete', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('removes the task from the local service', async () => {
    const { result } = renderHookWithQueryClient(() => useTaskDelete());

    await act(async () => {
      await result.current.mutateAsync('task-1');
    });

    expect(service.remove).toHaveBeenCalledWith('task-1');
  });
});
