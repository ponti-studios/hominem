import { CHAT_TITLE_MAX_LENGTH } from '@hominem/rpc/types';
import type { Chat, SessionSource } from '@hominem/rpc/types';
import type { QueryClient } from '@tanstack/react-query';

import { chatKeys, inboxKeys } from '~/services/notes/query-keys';
import { writeCachedChat } from '~/services/content-cache';

import type { ChatWithActivity } from './chat-types';

export const DEFAULT_CHAT_TITLE = 'New conversation';

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Gets the display title for a chat.
 * - If a custom title exists, returns it (normalized + truncated)
 * - Otherwise falls back to source-derived title
 * - Returns default title if nothing else is available
 */
export function normalizeChatTitle(value: string) {
  return normalizeWhitespace(value).slice(0, CHAT_TITLE_MAX_LENGTH) || DEFAULT_CHAT_TITLE;
}

export function isDefaultChatTitle(title?: string | null) {
  return normalizeWhitespace(title ?? '') === DEFAULT_CHAT_TITLE;
}

export function getChatTitle(title: string | null | undefined, source: SessionSource) {
  const customTitle = normalizeWhitespace(title ?? '');

  if (customTitle && !isDefaultChatTitle(customTitle)) {
    return normalizeChatTitle(customTitle);
  }

  // Fall back to source-derived title
  if (source.kind === 'artifact') {
    return normalizeChatTitle(source.title) || DEFAULT_CHAT_TITLE;
  }

  if (source.kind === 'capture') {
    return normalizeChatTitle(source.preview) || DEFAULT_CHAT_TITLE;
  }

  return DEFAULT_CHAT_TITLE;
}

export function updateChatTitleCaches(
  queryClient: QueryClient,
  input: { chatId: string; title: string; updatedAt?: string },
) {
  const { chatId, title, updatedAt } = input;

  queryClient.setQueryData<Chat | null>(chatKeys.activeChat(chatId), (currentChat) =>
    currentChat
      ? (() => {
          const nextChat = {
            ...currentChat,
            title,
            ...(updatedAt ? { updatedAt } : null),
          };
          writeCachedChat(nextChat);
          return nextChat;
        })()
      : currentChat,
  );

  queryClient.setQueryData<ChatWithActivity[] | undefined>(chatKeys.resumableChats, (sessions) =>
    sessions?.map((session) =>
      session.id === chatId
        ? {
            ...session,
            title,
            ...(updatedAt ? { updatedAt, activityAt: updatedAt } : null),
          }
        : session,
    ),
  );

  queryClient.setQueryData<ChatWithActivity[] | undefined>(chatKeys.archivedChats, (sessions) =>
    sessions?.map((session) =>
      session.id === chatId
        ? {
            ...session,
            title,
            ...(updatedAt ? { updatedAt, activityAt: updatedAt } : null),
          }
        : session,
    ),
  );

  void queryClient.invalidateQueries({ queryKey: inboxKeys.pages() });
}
