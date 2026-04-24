import { useRpcMutation, useRpcQuery } from '@hominem/rpc/react';
import type { Chat } from '@hominem/rpc/types/chat.types';
import { useQueryClient } from '@tanstack/react-query';

import { chatQueryKeys } from '~/lib/query-keys';

export function useChatsList() {
  return useRpcQuery(
    (client) => client.api.chats.$get({ query: { limit: '100' } }).then((r) => r.json()),
    {
      queryKey: chatQueryKeys.list,
      staleTime: 1000 * 30,
    },
  );
}

export function useCreateChat() {
  const queryClient = useQueryClient();

  return useRpcMutation<Chat, { title: string }>(
    (client, variables) =>
      client.api.chats.$post({ json: { title: variables.title } }).then((r) => r.json() as Promise<Chat>),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.list });
      },
    },
  );
}

export function useArchiveChat({
  chatId: _chatId,
  onSuccess,
}: {
  chatId: string;
  onSuccess?: (chat: Chat) => void;
}) {
  const queryClient = useQueryClient();

  return useRpcMutation<Chat, { chatId: string }>(
    (client, variables) =>
      client.api.chats[':id'].archive
        .$post({ param: { id: variables.chatId } })
        .then((r) => r.json() as Promise<Chat>),
    {
      onSuccess: (chat) => {
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.list });
        onSuccess?.(chat);
      },
    },
  );
}
