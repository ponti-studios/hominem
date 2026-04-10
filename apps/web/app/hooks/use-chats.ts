import { useRpcMutation, useRpcQuery } from '@hominem/rpc/react';
import type { Chat } from '@hominem/rpc/types/chat.types';
import { useQueryClient } from '@tanstack/react-query';

import { chatQueryKeys } from '~/lib/query-keys';

export function useChatsList() {
  return useRpcQuery(({ chats }) => chats.list({ limit: 100 }), {
    queryKey: chatQueryKeys.list,
    staleTime: 1000 * 30,
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();

  return useRpcMutation<Chat, { title: string }>(
    ({ chats }, variables) => chats.create(variables),
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
    ({ chats }, variables) => chats.archive(variables),
    {
      onSuccess: (chat) => {
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.list });
        onSuccess?.(chat);
      },
    },
  );
}
