// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { taskKeys } from '~/services/tasks/query-keys';
import type { TaskDetailOutput, TaskListItem } from '~/services/tasks/task-types';

import { renderHookWithQueryClient } from '../../utils/render-hook';

const mockCompleteReminder = vi.fn();

vi.mock('~/services/tasks/reminders-gateway', () => ({
  remindersGateway: {
    completeReminder: mockCompleteReminder,
  },
}));

const { useTaskComplete } = await import('~/services/tasks/use-task-complete');

function taskListItem(id: string, overrides: Partial<TaskListItem> = {}): TaskListItem {
  return {
    id,
    title: `Task ${id}`,
    status: 'pending',
    completedAt: null,
    ...overrides,
  } as unknown as TaskListItem;
}

describe('useTaskComplete', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('optimistically marks the task complete in the list cache', async () => {
    mockCompleteReminder.mockImplementation(() => new Promise(() => {}));
    const { result, queryClient } = renderHookWithQueryClient(() => useTaskComplete());
    queryClient.setQueryData(taskKeys.all, [taskListItem('1'), taskListItem('2')]);

    act(() => {
      result.current.mutate({ taskId: '1', completed: true });
    });

    await waitFor(() => {
      const tasks = queryClient.getQueryData<TaskListItem[]>(taskKeys.all);
      expect(tasks?.find((t) => t.id === '1')?.status).toBe('completed');
    });
    const tasks = queryClient.getQueryData<TaskListItem[]>(taskKeys.all);
    expect(tasks?.find((t) => t.id === '1')?.completedAt).not.toBeNull();
    expect(tasks?.find((t) => t.id === '2')?.status).toBe('pending');
  });

  it('optimistically updates the task detail cache', async () => {
    mockCompleteReminder.mockImplementation(() => new Promise(() => {}));
    const { result, queryClient } = renderHookWithQueryClient(() => useTaskComplete());
    queryClient.setQueryData<TaskDetailOutput>(taskKeys.detail('1'), { task: taskListItem('1') });

    act(() => {
      result.current.mutate({ taskId: '1', completed: true });
    });

    await waitFor(() => {
      const detail = queryClient.getQueryData<TaskDetailOutput>(taskKeys.detail('1'));
      expect(detail?.task.status).toBe('completed');
    });
  });

  it('rolls back the list and detail caches when the request fails', async () => {
    mockCompleteReminder.mockRejectedValueOnce(new Error('network error'));
    const { result, queryClient } = renderHookWithQueryClient(() => useTaskComplete());
    const originalList = [taskListItem('1')];
    const originalDetail: TaskDetailOutput = { task: taskListItem('1') };
    queryClient.setQueryData(taskKeys.all, originalList);
    queryClient.setQueryData(taskKeys.detail('1'), originalDetail);

    await act(async () => {
      await result.current.mutateAsync({ taskId: '1', completed: true }).catch(() => undefined);
    });

    expect(queryClient.getQueryData(taskKeys.all)).toEqual(originalList);
    expect(queryClient.getQueryData(taskKeys.detail('1'))).toEqual(originalDetail);
  });

  it('reconciles the list cache with the server response on success', async () => {
    mockCompleteReminder.mockResolvedValueOnce(
      taskListItem('1', { status: 'completed', title: 'Server title' }),
    );
    const { result, queryClient } = renderHookWithQueryClient(() => useTaskComplete());
    queryClient.setQueryData(taskKeys.all, [taskListItem('1')]);

    await act(async () => {
      await result.current.mutateAsync({ taskId: '1', completed: true });
    });

    const tasks = queryClient.getQueryData<TaskListItem[]>(taskKeys.all);
    expect(tasks?.[0]?.title).toBe('Server title');
  });

  it('reconciles the detail cache with the server response on success', async () => {
    mockCompleteReminder.mockResolvedValueOnce(
      taskListItem('1', { status: 'completed', title: 'Server title' }),
    );
    const { result, queryClient } = renderHookWithQueryClient(() => useTaskComplete());
    queryClient.setQueryData<TaskDetailOutput>(taskKeys.detail('1'), {
      task: taskListItem('1', { title: 'Old title' }),
    });

    await act(async () => {
      await result.current.mutateAsync({ taskId: '1', completed: true });
    });

    const detail = queryClient.getQueryData<TaskDetailOutput>(taskKeys.detail('1'));
    expect(detail?.task.title).toBe('Server title');
  });
});
