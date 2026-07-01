import type { Chat } from '@hominem/rpc/types';
import type { QueryClient } from '@tanstack/react-query';

import { chatKeys } from '~/services/notes/query-keys';
import { writeCachedChat, writeCachedChatMessages } from '~/services/content-cache';

import {
  createOptimisticMessage,
  createStreamingPlaceholder,
  type MessageOutput,
} from './chatMessages';

function persistMessages(queryClient: QueryClient, chatId: string) {
  const messages = queryClient.getQueryData<MessageOutput[]>(chatKeys.messages(chatId));
  if (messages) {
    writeCachedChatMessages(chatId, messages);
  }
}

export function seedStartedChat(
  queryClient: QueryClient,
  input: {
    chat: Chat;
    message: string;
    userMessageId: string;
    assistantMessageId: string;
  },
) {
  const { assistantMessageId, chat, message, userMessageId } = input;

  writeCachedChat(chat);
  queryClient.setQueryData(chatKeys.activeChat(chat.id), chat);
  queryClient.setQueryData<MessageOutput[]>(chatKeys.messages(chat.id), [
    createOptimisticMessage(chat.id, message, null, userMessageId),
    createStreamingPlaceholder(chat.id, assistantMessageId),
  ]);
  persistMessages(queryClient, chat.id);
}

export function appendAssistantChunk(
  queryClient: QueryClient,
  input: {
    chatId: string;
    assistantMessageId: string;
    chunk: string;
  },
) {
  const { assistantMessageId, chatId, chunk } = input;

  queryClient.setQueryData<MessageOutput[]>(chatKeys.messages(chatId), (previousMessages) =>
    previousMessages?.map((message) =>
      message.id === assistantMessageId ? { ...message, message: message.message + chunk } : message,
    ),
  );
  persistMessages(queryClient, chatId);
}

export function finishAssistantStream(
  queryClient: QueryClient,
  input: {
    chatId: string;
    assistantMessageId: string;
  },
) {
  const { assistantMessageId, chatId } = input;

  queryClient.setQueryData<MessageOutput[]>(chatKeys.messages(chatId), (previousMessages) =>
    previousMessages?.map((message) =>
      message.id === assistantMessageId ? { ...message, isStreaming: false } : message,
    ),
  );
  persistMessages(queryClient, chatId);
}

export function failAssistantStream(
  queryClient: QueryClient,
  input: {
    chatId: string;
    assistantMessageId: string;
    errorMessage: string;
  },
) {
  const { assistantMessageId, chatId, errorMessage } = input;

  queryClient.setQueryData<MessageOutput[]>(chatKeys.messages(chatId), (previousMessages) =>
    previousMessages?.map((message) =>
      message.id === assistantMessageId
        ? {
            ...message,
            isStreaming: false,
            message:
              message.message.trim().length > 0
                ? message.message
                : `Something went wrong: ${errorMessage}`,
          }
        : message,
    ),
  );
  persistMessages(queryClient, chatId);
}
