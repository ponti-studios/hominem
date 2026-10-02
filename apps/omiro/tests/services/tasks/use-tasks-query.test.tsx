// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeTaskListItem } from '../../fixtures';
import { renderHookWithQueryClient } from '../../utils/render-hook';

const mockListReminders = vi.fn();
const mockSubscribeToStoreChange = vi.fn(() => ({ remove: vi.fn() }));

vi.mock('~/services/tasks/reminders-gateway', () => ({
  remindersGateway: {
    listReminders: mockListReminders,
    subscribeToStoreChange: mockSubscribeToStoreChange,
  },
}));

const { useTasksQuery } = await import('~/services/tasks/use-tasks-query');

describe('useTasksQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns the tasks list', async () => {
    mockListReminders.mockResolvedValueOnce([makeTaskListItem('1'), makeTaskListItem('2')]);
    const { result } = renderHookWithQueryClient(() => useTasksQuery());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([makeTaskListItem('1'), makeTaskListItem('2')]);
  });

  it('surfaces a query error', async () => {
    mockListReminders.mockRejectedValueOnce(new Error('network error'));
    const { result } = renderHookWithQueryClient(() => useTasksQuery());

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error('network error'));
  });

  it('does not fetch when disabled', () => {
    const { result } = renderHookWithQueryClient(() => useTasksQuery({ enabled: false }));

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockListReminders).not.toHaveBeenCalled();
  });
});
