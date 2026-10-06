// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeTaskListItem } from '../../fixtures';
import { renderHookWithQueryClient } from '../../utils/render-hook';

const service = { list: vi.fn(), sync: vi.fn() };

vi.mock('~/services/tasks/task-service-instance', () => ({
  getTaskService: () => service,
}));

const { useTasksQuery } = await import('~/services/tasks/use-tasks-query');

describe('useTasksQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the tasks from the local database', async () => {
    service.list.mockReturnValue([makeTaskListItem('1'), makeTaskListItem('2')]);
    const { result } = renderHookWithQueryClient(() => useTasksQuery());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([makeTaskListItem('1'), makeTaskListItem('2')]);
    expect(service.sync).not.toHaveBeenCalled();
  });

  it('surfaces a query error', async () => {
    service.list.mockImplementation(() => {
      throw new Error('disk error');
    });
    const { result } = renderHookWithQueryClient(() => useTasksQuery());

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error('disk error'));
  });

  it('does not read while disabled', () => {
    renderHookWithQueryClient(() => useTasksQuery({ enabled: false }));

    expect(service.list).not.toHaveBeenCalled();
  });

  it('asks the server for changes before refetching', async () => {
    service.list.mockReturnValue([]);
    service.sync.mockResolvedValue({ online: true });
    const { result } = renderHookWithQueryClient(() => useTasksQuery());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    service.list.mockClear();

    await result.current.refetch();

    expect(service.sync).toHaveBeenCalledTimes(1);
    expect(service.list).toHaveBeenCalledTimes(1);
  });
});
