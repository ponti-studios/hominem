import type { GenerationHistoryEvent as GenerationDomainEvent } from '@hominem/chat';
import { ChatClient } from '@hominem/chat/client';
import type { ChatGenerationController } from '@hominem/chat/client';
import { xhrChatTransport } from '@hominem/chat/transport/xhr';
import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useRef } from 'react';

import type { ChatMessageItem } from '~/components/chat';
import { API_BASE_URL } from '~/constants';
import { getChatResponseLength } from '~/hooks/use-chat-response-length';
import { useAuth } from '~/services/auth/auth-provider';
import { OFFLINE_UNAVAILABLE_ERROR } from '~/services/chat/chat-errors';
import { registerGenerationHandoff } from '~/services/chat/generation-handoff';
import { toMessageOutput } from '~/services/chat/use-chat-messages';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { chatKeys } from '~/services/notes/query-keys';

import { applyGenerationCommitted, invalidateChatQueries } from './chat-cache';

interface StartChatOptions {
  onAccepted?: (event: Extract<GenerationDomainEvent, { type: 'generation.accepted' }>) => void;
}

type StartChatInput = {
  title: string;
  message: string;
  fileIds?: string[];
};

export function useStartChat() {
  const { getAuthHeaders } = useAuth();
  const queryClient = useQueryClient();
  const chatClientRef = useRef<ChatClient | null>(null);
  const generationRef = useRef<ChatGenerationController | null>(null);
  const startedChatIdRef = useRef<string | null>(null);
  if (!chatClientRef.current) {
    chatClientRef.current = new ChatClient({
      baseUrl: API_BASE_URL,
      headers: getAuthHeaders,
      transport: xhrChatTransport(),
    });
  }

  const reconcileStartedChat = useCallback(
    (chatId: string) =>
      Promise.all([
        invalidateInboxQueries(queryClient),
        invalidateChatQueries(queryClient, chatId),
      ]),
    [queryClient],
  );

  const mutation = useMutation<string, Error, StartChatInput & StartChatOptions>({
    mutationFn: async ({ onAccepted, ...input }) => {
      const net = await NetInfo.fetch();
      if (net.isConnected === false) throw new Error(OFFLINE_UNAVAILABLE_ERROR);

      startedChatIdRef.current = null;
      const generation = chatClientRef.current!.start({
        ...input,
        generationId: randomUUID(),
        responseLength: getChatResponseLength(),
      });
      generationRef.current = generation;
      generation.subscribe((_state, event) => {
        if (!('payload' in event)) return;
        if (event.type === 'generation.accepted') {
          startedChatIdRef.current = event.payload.chatId;
          const userMessage = event.payload.userMessage
            ? toMessageOutput(event.payload.userMessage)
            : null;
          queryClient.setQueryData(chatKeys.activeChat(event.payload.chatId), event.payload.chat);
          queryClient.setQueryData<ChatMessageItem[]>(
            chatKeys.messages(event.payload.chatId),
            userMessage ? [userMessage] : [],
          );
          void reconcileStartedChat(event.payload.chatId);
          // Hand the live controller to whichever screen mounts next at this
          // chatId: router.replace to the chat route unmounts this screen
          // (and this ChatClient with it), so the destination screen's own
          // useChatGeneration needs a way to pick up the generation already
          // in flight. Adopting the controller directly -- rather than
          // seeding a checkpoint and letting that screen resume from
          // storage -- means one SSE connection total, and userMessageId
          // travels as a plain object property instead of needing to
          // survive a round trip through MMKV.
          registerGenerationHandoff(event.payload.chatId, {
            controller: generation,
            ...(event.payload.userMessage ? { userMessageId: event.payload.userMessage.id } : {}),
          });
          onAccepted?.(event);
        }
        if (event.type === 'generation.committed' && startedChatIdRef.current) {
          applyGenerationCommitted({
            queryClient,
            chatId: startedChatIdRef.current,
            message: event.payload.message,
          });
        }
      });

      try {
        const completed = await generation.done;
        if (completed.phase === 'failed') {
          throw new Error(completed.error ?? 'Generation failed.');
        }
      } catch (error) {
        if (startedChatIdRef.current) void reconcileStartedChat(startedChatIdRef.current);
        throw error;
      } finally {
        generationRef.current = null;
      }
      if (!startedChatIdRef.current) throw new Error('Chat was not created');
      await reconcileStartedChat(startedChatIdRef.current);
      return startedChatIdRef.current;
    },
  });

  const startChat = useCallback(
    (input: StartChatInput & StartChatOptions): Promise<string> => mutation.mutateAsync(input),
    [mutation],
  );

  const cancel = useCallback(() => {
    generationRef.current?.cancel();
  }, []);

  return {
    cancel,
    isStartingChat: mutation.isPending,
    startChat,
  };
}
