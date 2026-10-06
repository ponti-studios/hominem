// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderHookWithQueryClient } from '../../utils/render-hook';

const service = { create: vi.fn() };

vi.mock('~/services/tasks/task-service-instance', () => ({
  getTaskService: () => service,
}));

const { useTaskCreate } = await import('~/services/tasks/use-task-create');

describe('useTaskCreate', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates the task in the local service without a priority', async () => {
    service.create.mockReturnValue({ id: 'task-1' });
    const { result } = renderHookWithQueryClient(() => useTaskCreate());

    await act(async () => {
      await result.current.mutateAsync({
        title: 'Buy milk',
        dueAt: '2026-10-07T15:00:00.000Z',
        priority: 'high',
      });
    });

    expect(service.create).toHaveBeenCalledWith({
      title: 'Buy milk',
      notes: undefined,
      startAt: undefined,
      dueAt: '2026-10-07T15:00:00.000Z',
      location: undefined,
    });
  });

  it('creates a task with no date', async () => {
    service.create.mockReturnValue({ id: 'task-2' });
    const { result } = renderHookWithQueryClient(() => useTaskCreate());

    await act(async () => {
      await result.current.mutateAsync({ title: 'Someday' });
    });

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Someday', dueAt: undefined, startAt: undefined }),
    );
  });
});
