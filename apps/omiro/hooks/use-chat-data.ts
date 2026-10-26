import type { ChatMessageItem } from '@hominem/chat';

import { useChatRows } from '~/services/chat/chat-rows';
import { useChatMessages } from '~/services/chat/use-chat-messages';
import {
  hasNonEmptyListData,
  resolveRestoredQueryState,
} from '~/services/query/restored-query-state';

const NO_MESSAGES: ChatMessageItem[] = [];

interface UseChatDataInput {
  chatId: string;
}

export function useChatData({ chatId }: UseChatDataInput) {
  const {
    error: messagesError,
    isFetching: isMessagesFetching,
    isPending: isMessagesPending,
    refetch: refetchMessages,
    data: messages,
  } = useChatMessages({ chatId });
  const messageRows = useChatRows(chatId, messages ?? NO_MESSAGES);
  const messagesState = resolveRestoredQueryState({
    data: messages,
    isPending: isMessagesPending,
    isFetching: isMessagesFetching,
    isReady: hasNonEmptyListData,
  });

  return {
    messages: messageRows,
    messagesError,
    isMessagesLoading: messagesState.isInitialLoading,
    isMessagesRefreshing: messagesState.isRefreshing,
    refetchMessages,
  };
}
