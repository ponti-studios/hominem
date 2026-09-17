// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { taskKeys } from '~/services/tasks/query-keys';
import type { TaskListItem } from '~/services/tasks/task-types';

import { renderHookWithQueryClient } from '../../utils/render-hook';

const mockCreateReminder = vi.fn();

vi.mock('~/services/tasks/reminders-gateway', () => ({
  remindersGateway: {
    createReminder: mockCreateReminder,
  },
}));

const { useTaskCreate } = await import('~/services/tasks/use-task-create');

function serverTask(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: 'Buy milk',
    notes: null,
    status: 'pending',
    priority: 'medium',
    startAt: null,
    dueAt: null,
    location: null,
    listTitle: 'Omiro',
    completedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useTaskCreate', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('optimistically prepends the new task to the list cache', async () => {
    mockCreateReminder.mockImplementation(() => new Promise(() => {}));
    const { result, queryClient } = renderHookWithQueryClient(() => useTaskCreate());
    queryClient.setQueryData(taskKeys.all, [{ id: 'existing', title: 'Existing' }]);

    act(() => {
      result.current.mutate({ title: 'Buy milk' });
    });

    await waitFor(() => {
      const list = queryClient.getQueryData<TaskListItem[]>(taskKeys.all);
      expect(list).toHaveLength(2);
    });
    const list = queryClient.getQueryData<TaskListItem[]>(taskKeys.all);
    expect(list?.[0]).toEqual(expect.objectContaining({ title: 'Buy milk', status: 'pending' }));
    expect(list?.[1]).toEqual(expect.objectContaining({ id: 'existing' }));
  });

  it('reconciles the optimistic task with the server response on success', async () => {
    const created = serverTask('server-1');
    mockCreateReminder.mockResolvedValueOnce(created);
    const { result, queryClient } = renderHookWithQueryClient(() => useTaskCreate());

    await act(async () => {
      await result.current.mutateAsync({ title: 'Buy milk' });
    });

    const list = queryClient.getQueryData<TaskListItem[]>(taskKeys.all);
    expect(list).toEqual([expect.objectContaining({ id: 'server-1' })]);
    expect(list?.some((task) => task.id.startsWith('optimistic-task-'))).toBe(false);

    const detail = queryClient.getQueryData(taskKeys.detail('server-1'));
    expect(detail).toEqual({ task: created });
  });

  it('rolls back the list cache when the request fails', async () => {
    mockCreateReminder.mockRejectedValueOnce(new Error('network error'));
    const { result, queryClient } = renderHookWithQueryClient(() => useTaskCreate());
    const originalList = [{ id: 'existing', title: 'Existing' }];
    queryClient.setQueryData(taskKeys.all, originalList);

    await act(async () => {
      await result.current.mutateAsync({ title: 'Buy milk' }).catch(() => undefined);
    });

    expect(queryClient.getQueryData(taskKeys.all)).toEqual(originalList);
  });
});
