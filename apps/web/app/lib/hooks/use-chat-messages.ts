import type { HonoClient } from '@hominem/rpc';
import { useApiClient } from '@hominem/rpc/react';
import { useQuery } from '@tanstack/react-query';

import { chatQueryKeys } from '~/lib/query-keys';

type ChatMessagesOutput = Awaited<
  ReturnType<Awaited<ReturnType<HonoClient['api']['chats'][':id']['messages']['$get']>>['json']>
>;
type ChatMessage = ChatMessagesOutput[number];

export interface UseChatMessagesOptions {
  chatId: string;
  initialData?: ChatMessagesOutput;
}

export interface UseChatMessagesReturn {
  messages: ChatMessagesOutput;
  isLoading: boolean;
  error: Error | null;
  deleteMessage: (messageId: string) => Promise<void>;
  updateMessage: (messageId: string, content: string) => Promise<void>;
}

export type ExtendedMessage = ChatMessage & {
  isStreaming?: boolean;
};

export function useChatMessages({
  chatId,
  initialData,
}: UseChatMessagesOptions): UseChatMessagesReturn {
  const client = useApiClient();

  const messagesQuery = useQuery({
    queryKey: chatQueryKeys.messages(chatId),
    enabled: !!chatId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
    queryFn: () =>
      client.api.chats[':id'].messages
        .$get({ param: { id: chatId }, query: { limit: '50' } })
        .then((r) => r.json()),
    ...(initialData ? { initialData } : {}),
  });

  const messages = Array.isArray(messagesQuery.data) ? messagesQuery.data : [];
  const isLoading = messagesQuery.isLoading;
  const error = messagesQuery.error;

  return {
    messages: messages as ChatMessagesOutput,
    isLoading,
    error,
    deleteMessage: async () => undefined,
    updateMessage: async () => undefined,
  };
}
