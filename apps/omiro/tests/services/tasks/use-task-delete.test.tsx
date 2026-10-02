// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { taskKeys } from '~/services/tasks/query-keys';
import type { TaskListItem } from '~/services/tasks/task-types';

import { makeTaskListItem } from '../../fixtures';
import { renderHookWithQueryClient } from '../../utils/render-hook';

const mockDeleteReminder = vi.fn();

vi.mock('~/services/tasks/reminders-gateway', () => ({
  remindersGateway: {
    deleteReminder: mockDeleteReminder,
  },
}));

const { useTaskDelete } = await import('~/services/tasks/use-task-delete');

describe('useTaskDelete', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('removes the task from the list cache and its own detail cache on success', async () => {
    mockDeleteReminder.mockResolvedValueOnce(undefined);
    const { result, queryClient } = renderHookWithQueryClient(() => useTaskDelete());
    queryClient.setQueryData(taskKeys.all, [makeTaskListItem('1'), makeTaskListItem('2')]);
    queryClient.setQueryData(taskKeys.detail('1'), { task: makeTaskListItem('1') });

    await act(async () => {
      await result.current.mutateAsync('1');
    });

    expect(queryClient.getQueryData<TaskListItem[]>(taskKeys.all)).toEqual([makeTaskListItem('2')]);
    expect(queryClient.getQueryData(taskKeys.detail('1'))).toBeUndefined();
  });

  it('calls the gateway with the task id', async () => {
    mockDeleteReminder.mockResolvedValueOnce(undefined);
    const { result, queryClient } = renderHookWithQueryClient(() => useTaskDelete());
    queryClient.setQueryData(taskKeys.all, [makeTaskListItem('1')]);

    await act(async () => {
      await result.current.mutateAsync('1');
    });

    expect(mockDeleteReminder).toHaveBeenCalledWith('1');
  });
});
