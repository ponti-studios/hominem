import { CHAT_TITLE_MAX_LENGTH } from '@hominem/rpc/types';
import type { Chat, SessionSource } from '@hominem/rpc/types';
import type { QueryClient } from '@tanstack/react-query';

import { chatKeys, inboxKeys } from '~/services/notes/query-keys';

import type { ChatWithActivity } from './session-types';

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
export function getChatTitle(title: string | null | undefined, source: SessionSource) {
  const customTitle = normalizeWhitespace(title ?? '');

  if (customTitle && customTitle !== DEFAULT_CHAT_TITLE) {
    return customTitle.slice(0, CHAT_TITLE_MAX_LENGTH);
  }

  // Fall back to source-derived title
  if (source.kind === 'artifact') {
    return normalizeWhitespace(source.title) || DEFAULT_CHAT_TITLE;
  }

  if (source.kind === 'capture') {
    return normalizeWhitespace(source.preview).slice(0, CHAT_TITLE_MAX_LENGTH) || DEFAULT_CHAT_TITLE;
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
      ? {
          ...currentChat,
          title,
          ...(updatedAt ? { updatedAt } : null),
        }
      : currentChat,
  );

  queryClient.setQueryData<ChatWithActivity[] | undefined>(chatKeys.resumableSessions, (sessions) =>
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

  queryClient.setQueryData<ChatWithActivity[] | undefined>(chatKeys.archivedSessions, (sessions) =>
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

  void queryClient.invalidateQueries({ queryKey: inboxKeys.all });
}
