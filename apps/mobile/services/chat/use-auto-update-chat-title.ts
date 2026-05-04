import { useApiClient } from '@hominem/rpc/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { chatKeys } from '~/services/notes/query-keys';

import { updateChatTitleCaches } from './chat-title';

const DEFAULT_TITLE = 'New conversation';
const MAX_LENGTH = 64;

function normalizeTitle(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_LENGTH) || DEFAULT_TITLE;
}

function isDefaultTitle(title?: string | null) {
  return (title ?? '').trim() === DEFAULT_TITLE;
}

export function useAutoUpdateChatTitle(chatId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useCallback(
    async (message: string) => {
      if (!message) return;
      const currentChat = queryClient.getQueryData<{ title: string } | null>(
        chatKeys.activeChat(chatId),
      );
      if (!currentChat || !isDefaultTitle(currentChat.title)) return;
      const nextTitle = normalizeTitle(message);
      if (isDefaultTitle(nextTitle)) return;

      const updatedAt = new Date().toISOString();
      updateChatTitleCaches(queryClient, { chatId, title: nextTitle, updatedAt });
      try {
        await client.api.chats[':id'].$patch({
          param: { id: chatId },
          json: { title: nextTitle },
        });
      } catch {
        await queryClient.invalidateQueries({ queryKey: chatKeys.activeChat(chatId) });
      }
    },
    [chatId, client, queryClient],
  );
}
