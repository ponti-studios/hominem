import { useRpcMutation } from '@hominem/rpc/react';
import type { Chat } from '@hominem/rpc/types/chat.types';
import { useQueryClient } from '@tanstack/react-query';

import { inboxQueryKeys } from '~/lib/query-keys';

export function useCreateChat() {
  const queryClient = useQueryClient();

  return useRpcMutation<Chat, { title: string }>(
    (client, variables) =>
      client.api.chats
        .$post({ json: { title: variables.title } })
        .then((r) => r.json() as Promise<Chat>),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: inboxQueryKeys.pages() });
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
        queryClient.invalidateQueries({ queryKey: inboxQueryKeys.pages() });
        onSuccess?.(chat);
      },
    },
  );
}
