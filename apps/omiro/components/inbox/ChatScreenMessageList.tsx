import { RefreshControl } from 'react-native';

import { ChatMessageList } from '~/components/chat';
import { EmptyState } from '~/components/ui';
import type { useChatSearch } from '~/hooks/use-chat-search';
import type { ChatGenerationState } from '~/services/chat/chat-generation';
import { formatRelativeAge } from '~/services/date/format-relative-age';
import t from '~/translations';

type ChatMessagesStatus = {
  phase: 'loading' | 'refreshing' | 'ready';
  error: 'missing' | 'load' | null;
};

type ChatScreenMessageListProps = {
  status: ChatMessagesStatus;
  refetchMessages: () => Promise<unknown>;
  onGoBack: () => void;
  search: ReturnType<typeof useChatSearch>;
  showDebug: boolean;
  onEdit: (messageId: string, content: string) => void;
  onRegenerate: (messageId: string) => void;
  onRetry: (messageId: string) => void;
  generation: ChatGenerationState | null;
  topInset: number;
};

export function ChatScreenMessageList({
  status,
  refetchMessages,
  onGoBack,
  search,
  showDebug,
  onEdit,
  onRegenerate,
  onRetry,
  generation,
  topInset,
}: ChatScreenMessageListProps) {
  const emptyState = (
    <EmptyState
      description={t.chat.emptyState.description}
      sfSymbol="bubble.left"
      title={t.chat.emptyState.title}
    />
  );
  const errorState =
    status.error === 'load' ? (
      <EmptyState
        action={{
          label: t.chat.loadErrorRetry,
          onPress: () => {
            void refetchMessages();
          },
        }}
        sfSymbol="arrow.clockwise.circle"
        title={t.chat.loadErrorTitle}
      />
    ) : null;
  const missingConversationState =
    status.error === 'missing' ? (
      <EmptyState
        action={{ label: t.chat.goBack, onPress: onGoBack }}
        description={t.chat.missingMessage}
        sfSymbol="bubble.left.and.exclamationmark.bubble.right"
        title={t.chat.missingTitle}
      />
    ) : null;

  return (
    <ChatMessageList
      topInset={topInset}
      isMessagesLoading={status.phase === 'loading'}
      displayMessages={search.displayMessages}
      search={{
        isOpen: search.showSearch,
        query: search.searchQuery,
        isLoading: search.isSearching,
      }}
      showDebug={showDebug}
      onEdit={onEdit}
      onRegenerate={onRegenerate}
      onRetry={onRetry}
      generation={generation}
      formatTimestamp={formatRelativeAge}
      emptyState={missingConversationState ?? errorState ?? emptyState}
      refreshControl=<RefreshControl
        refreshing={status.phase === 'refreshing'}
        onRefresh={() => {
          void refetchMessages();
        }}
      />
    />
  );
}
