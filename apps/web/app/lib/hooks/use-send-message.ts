import { useRpcMutation } from '@hominem/rpc/react';
import type { ChatsSendInput, ChatsSendOutput } from '@hominem/rpc/types/chat.types';
import { useQueryClient } from '@tanstack/react-query';

import { chatQueryKeys } from '~/lib/query-keys';

type ChatStatus = 'idle' | 'submitted' | 'error';

export function useSendMessage({ chatId }: { chatId: string }) {
  const queryClient = useQueryClient();

  const mutation = useRpcMutation<ChatsSendOutput, ChatsSendInput>(
    ({ chats }, variables) =>
      chats.send({
        chatId: variables.chatId || chatId,
        message: variables.message,
        ...(variables.fileIds && variables.fileIds.length > 0
          ? { fileIds: variables.fileIds }
          : {}),
        ...(variables.noteIds && variables.noteIds.length > 0
          ? { noteIds: variables.noteIds }
          : {}),
      }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.get(chatId) });
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.messages(chatId) });
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.list });
      },
    },
  );

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    status: (mutation.isPending ? 'submitted' : mutation.isError ? 'error' : 'idle') as ChatStatus,
    error: mutation.error,
  };
}
