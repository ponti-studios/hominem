import { useRpcQuery } from '@hominem/rpc/react';

import { chatQueryKeys } from '~/lib/query-keys';

export interface UseChatMessagesOptions {
  chatId: string;
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

export function useChatMessages({ chatId }: UseChatMessagesOptions): UseChatMessagesReturn {
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
