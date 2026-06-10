import { useRpcMutation } from '@hominem/rpc/react';
import type { ChatsArchiveOutput, ChatsCreateOutput } from '@hominem/rpc/types/chat.types';
import { useQueryClient } from '@tanstack/react-query';

import { inboxQueryKeys } from '~/lib/query-keys';

export function useCreateChat() {
  const queryClient = useQueryClient();

  return useRpcMutation<ChatsCreateOutput, { title: string }>(
    (client, variables) =>
      client.api.chats
        .$post({ json: { title: variables.title } })
        .then((r) => r.json()),
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
  onSuccess?: (chat: ChatsArchiveOutput) => void;
}) {
  const queryClient = useQueryClient();

  return useRpcMutation<ChatsArchiveOutput, { chatId: string }>(
    (client, variables) =>
      client.api.chats[':id'].archive
        .$post({ param: { id: variables.chatId } })
        .then((r) => r.json()),
    {
      onSuccess: (chat) => {
        queryClient.invalidateQueries({ queryKey: inboxQueryKeys.pages() });
        onSuccess?.(chat);
      },
    },
  );
}
