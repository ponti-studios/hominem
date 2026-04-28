import { useRpcQuery } from '@hominem/rpc/react';
import type { ChatMessageDto } from '@hominem/rpc/types/chat.types';

import { chatQueryKeys } from '~/lib/query-keys';

export interface UseChatMessagesOptions {
  chatId: string;
  initialData?: ChatMessageDto[];
}

export interface UseChatMessagesReturn {
  messages: import('@hominem/rpc/types/chat.types').ChatMessageDto[];
  isLoading: boolean;
  error: Error | null;
  deleteMessage: (messageId: string) => Promise<void>;
  updateMessage: (messageId: string, content: string) => Promise<void>;
}

export type ExtendedMessage = import('@hominem/rpc/types/chat.types').ChatMessageDto & {
  isStreaming?: boolean;
};

export function useChatMessages({
  chatId,
  initialData,
}: UseChatMessagesOptions): UseChatMessagesReturn {
  const messagesQuery = useRpcQuery(
    (client) =>
      client.api.chats[':id'].messages
        .$get({ param: { id: chatId }, query: { limit: '50' } })
        .then((r) => r.json()),
    {
      queryKey: chatQueryKeys.messages(chatId),
      enabled: !!chatId,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000,
      ...(initialData ? { initialData } : {}),
    },
  );

  const messages = Array.isArray(messagesQuery.data) ? messagesQuery.data : [];
  const isLoading = messagesQuery.isLoading;
  const error = messagesQuery.error;

  return {
    messages: messages as import('@hominem/rpc/types/chat.types').ChatMessageDto[],
    isLoading,
    error,
    deleteMessage: async () => undefined,
    updateMessage: async () => undefined,
  };
}
