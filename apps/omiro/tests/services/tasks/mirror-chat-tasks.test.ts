import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const mockGetPermission = vi.fn();
const mockRequestPermission = vi.fn();
const mockCreateReminder = vi.fn();

vi.mock('~/services/storage/mmkv', () => ({
  storage: {
    getString: (key: string) => store.get(key),
    set: (key: string, value: string) => store.set(key, value),
  },
}));

vi.mock('~/services/tasks/reminders-gateway', () => ({
  remindersGateway: {
    getPermission: mockGetPermission,
    requestPermission: mockRequestPermission,
    createReminder: mockCreateReminder,
  },
}));

const { mirrorCompletedChatTasks } = await import('~/services/tasks/mirror-chat-tasks');

function toolCall(overrides: Record<string, unknown> = {}) {
  return {
    type: 'tool-call' as const,
    toolName: 'task_create',
    toolCallId: 'call-1',
    args: { title: 'Buy milk', description: 'Oat', priority: 'high', artifactType: 'task' },
    executionStatus: 'completed' as const,
    ...overrides,
  };
}

describe('mirrorCompletedChatTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    mockGetPermission.mockResolvedValue('authorized');
    mockCreateReminder.mockResolvedValue({ id: 'r1' });
  });

  it('creates a reminder for a completed task_create call and refreshes the list', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await mirrorCompletedChatTasks(queryClient, [toolCall()]);

    expect(mockCreateReminder).toHaveBeenCalledWith({
      title: 'Buy milk',
      notes: 'Oat',
      dueAt: null,
      location: null,
      priority: 'high',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });

  it('mirrors a tool call only once', async () => {
    const queryClient = new QueryClient();
    await mirrorCompletedChatTasks(queryClient, [toolCall()]);
    await mirrorCompletedChatTasks(queryClient, [toolCall()]);

    expect(mockCreateReminder).toHaveBeenCalledTimes(1);
  });

  it('ignores calls that are not completed task_create calls', async () => {
    const queryClient = new QueryClient();
    await mirrorCompletedChatTasks(queryClient, [
      toolCall({ executionStatus: 'pending', toolCallId: 'a' }),
      toolCall({ executionStatus: 'failed', toolCallId: 'b' }),
      toolCall({ toolName: 'note_create', toolCallId: 'c' }),
    ]);

    expect(mockCreateReminder).not.toHaveBeenCalled();
  });

  it('skips when Reminders access is denied', async () => {
    mockGetPermission.mockResolvedValue('denied');
    mockRequestPermission.mockResolvedValue('denied');

    await mirrorCompletedChatTasks(new QueryClient(), [toolCall()]);

    expect(mockCreateReminder).not.toHaveBeenCalled();
  });

  it('does not throw when creating the reminder fails', async () => {
    mockCreateReminder.mockRejectedValue(new Error('EventKit'));

    await expect(
      mirrorCompletedChatTasks(new QueryClient(), [toolCall()]),
    ).resolves.toBeUndefined();
  });
});
