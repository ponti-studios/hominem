import { ChatClient } from '@hominem/chat/client';
import type { GenerationClientState } from '@hominem/chat/client';
import { xhrChatTransport } from '@hominem/chat/transport/xhr';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type { ChatMessageItem } from '~/components/chat';
import { API_BASE_URL } from '~/constants';
import { useAuth } from '~/services/auth/auth-provider';
import { mirrorCompletedChatTasks } from '~/services/tasks/mirror-chat-tasks';

import { chatKeys } from '../notes/query-keys';

export function useToolCallRespond({ chatId }: { chatId: string }) {
  const { getAuthHeaders } = useAuth();
  const queryClient = useQueryClient();
  const [isResponding, setIsResponding] = useState(false);
  const [client] = useState(() => {
    const checkpoints = new Map<string, GenerationClientState>();
    return new ChatClient({
      baseUrl: API_BASE_URL,
      headers: getAuthHeaders,
      transport: xhrChatTransport(),
      checkpointStore: {
        get: (generationId) => checkpoints.get(generationId) ?? null,
        set: (state) => {
          checkpoints.set(state.generationId, state);
        },
        remove: (generationId) => {
          checkpoints.delete(generationId);
        },
      },
    });
  });

  const respond = useCallback(
    async (input: { messageId: string; toolCallId: string; approved: boolean }) => {
      setIsResponding(true);
      try {
        const generation = client.respondToToolCall({
          chatId,
          messageId: input.messageId,
          toolCallId: input.toolCallId,
          body: { approved: input.approved },
        });
        await generation.done;
      } finally {
        setIsResponding(false);
        await queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
        await queryClient.invalidateQueries({ queryKey: chatKeys.activeChat(chatId) });
        const answered = queryClient
          .getQueryData<ChatMessageItem[]>(chatKeys.messages(chatId))
          ?.find((message) => message.id === input.messageId);
        await mirrorCompletedChatTasks(queryClient, answered?.toolCalls);
      }
    },
    [chatId, client, queryClient],
  );

  return { isResponding, respond };
}
