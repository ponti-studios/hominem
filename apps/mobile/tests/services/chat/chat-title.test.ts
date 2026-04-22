import type { Chat, SessionSource } from '@hominem/rpc/types';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CHAT_TITLE,
  isDefaultChatTitle,
  normalizeChatTitle,
  resolveChatScreenTitle,
  updateChatTitleCaches,
} from '~/services/chat/chat-title';
import type { ChatWithActivity } from '~/services/chat/session-state';
import { chatKeys } from '~/services/notes/query-keys';

describe('chat title helpers', () => {
  it('normalizes titles and recognizes the default title', () => {
    expect(normalizeChatTitle('  hello   world  ')).toBe('hello world');
    expect(normalizeChatTitle('   ')).toBe(DEFAULT_CHAT_TITLE);
    expect(isDefaultChatTitle(DEFAULT_CHAT_TITLE)).toBe(true);
    expect(isDefaultChatTitle('Something else')).toBe(false);
  });

  it('derives the screen title from the resolved source when the stored title is generic', () => {
    const source: SessionSource = {
      kind: 'thought',
      preview: 'First real message',
    };

    expect(resolveChatScreenTitle(DEFAULT_CHAT_TITLE, source)).toBe('First real message');
    expect(resolveChatScreenTitle('Saved title', source)).toBe('Saved title');
  });

  it('updates the active and session caches together', () => {
    const queryClient = new QueryClient();
    const chat: Chat = {
      archivedAt: null,
      createdAt: '2026-04-13T01:29:18.000Z',
      id: 'chat-1',
      noteId: null,
      title: DEFAULT_CHAT_TITLE,
      updatedAt: '2026-04-13T01:29:18.000Z',
      userId: 'user-1',
    };
    const session: ChatWithActivity = {
      ...chat,
      activityAt: chat.updatedAt,
    };

    queryClient.setQueryData(chatKeys.activeChat(chat.id), chat);
    queryClient.setQueryData(chatKeys.resumableSessions, [session]);

    updateChatTitleCaches(queryClient, {
      chatId: chat.id,
      title: 'A better title',
      updatedAt: '2026-04-13T01:30:00.000Z',
    });

    expect(queryClient.getQueryData(chatKeys.activeChat(chat.id))).toMatchObject({
      title: 'A better title',
      updatedAt: '2026-04-13T01:30:00.000Z',
    });
    expect(queryClient.getQueryData(chatKeys.resumableSessions)).toMatchObject([
      {
        title: 'A better title',
        updatedAt: '2026-04-13T01:30:00.000Z',
        activityAt: '2026-04-13T01:30:00.000Z',
      },
    ]);
  });
});
