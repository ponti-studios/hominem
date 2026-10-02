import type { ChatMessageItem } from '@hominem/chat';
import type { Note } from '@hominem/rpc/types';

import type { TaskListItem } from '~/services/tasks/task-types';

export function makeTaskListItem(id: string, overrides: Partial<TaskListItem> = {}): TaskListItem {
  return {
    id,
    title: `Task ${id}`,
    status: 'pending',
    completedAt: null,
    createdAt: '2026-07-28T09:00:00.000Z',
    notes: null,
    dueAt: null,
    location: null,
    listTitle: 'Omiro',
    priority: 'medium',
    startAt: null,
    ...overrides,
  };
}

export function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    userId: 'user-1',
    kind: 'note',
    title: 'Original title',
    content: 'Original content',
    excerpt: 'Original content',
    files: [],
    createdAt: '2026-07-28T09:00:00.000Z',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeChatMessage(overrides: Partial<ChatMessageItem> = {}): ChatMessageItem {
  return {
    id: 'm1',
    role: 'user',
    message: 'hello',
    createdAt: new Date().toISOString(),
    chatId: 'chat-1',
    reasoning: null,
    toolCalls: null,
    isStreaming: false,
    ...overrides,
  };
}
