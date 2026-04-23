import type { ChatMessageItem, ChatRenderIcon, MarkdownComponent } from '@hominem/chat';
import { useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { FlatList, Pressable, StyleSheet, View, type FlatList as RNFlatList } from 'react-native';

import { Text } from '~/components/theme';
import { fontFamiliesNative, fontSizes, spacing } from '~/components/theme';

import { renderChatMessage } from './chat-message';
import { ChatShimmerMessage } from './chat-shimmer-message';
import { ChatThinkingIndicator } from './chat-thinking-indicator';

const CHAT_COMPOSER_CLEARANCE = 220;
const CHAT_TURN_GAP = spacing[5];
const keyExtractor = (item: ChatMessageItem) => item.id;

interface ChatMessageListProps {
  isMessagesLoading: boolean;
  displayMessages: ChatMessageItem[];
  showSearch: boolean;
  searchQuery: string;
  markdown: MarkdownComponent | null;
  showDebug: boolean;
  speakingId: string | null;
  chatSendStatus: 'idle' | 'submitted' | 'streaming' | 'error';
  onCopy: (message: ChatMessageItem) => void;
  onEdit: (messageId: string, content: string) => void;
  onRegenerate: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onSpeak: (message: ChatMessageItem) => void;
  onShare: (message: ChatMessageItem) => void;
  renderIcon: ChatRenderIcon;
  formatTimestamp: (value: string) => string;
  contentPaddingBottom?: number;
  emptyState?: React.ReactElement | null;
}

export function ChatMessageList({
  isMessagesLoading,
  displayMessages,
  showSearch,
  searchQuery,
  markdown,
  showDebug,
  speakingId,
  chatSendStatus,
  onCopy,
  onEdit,
  onRegenerate,
  onDelete,
  onSpeak,
  onShare,
  renderIcon,
  formatTimestamp,
  contentPaddingBottom = CHAT_COMPOSER_CLEARANCE,
  emptyState,
}: ChatMessageListProps) {
  const hasSearchQuery = showSearch && searchQuery.length > 0;
  const [activeActionMessageId, setActiveActionMessageId] = useState<string | null>(null);
  const listRef = useRef<RNFlatList<ChatMessageItem> | null>(null);
  const didInitialScrollRef = useRef(false);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessageItem }) =>
      renderChatMessage(item, markdown, renderIcon, formatTimestamp, {
        isActive: activeActionMessageId === item.id,
        onActivate: () =>
          setActiveActionMessageId((currentMessageId) =>
            currentMessageId === item.id ? null : item.id,
          ),
        onCopy,
        onDelete,
        onEdit,
        onRegenerate,
        onShare,
        onSpeak,
        showDebug,
        speakingId,
      }),
    [
      activeActionMessageId,
      formatTimestamp,
      markdown,
      onCopy,
      onDelete,
      onEdit,
      onRegenerate,
      onShare,
      onSpeak,
      renderIcon,
      showDebug,
      speakingId,
    ],
  );

  const emptySearch = useMemo(() => {
    if (!hasSearchQuery) return null;

    return (
      <View style={styles.emptySearch}>
        <Text color="text-tertiary" style={styles.emptySearchText}>
          No messages matching &ldquo;{searchQuery}&rdquo;
        </Text>
      </View>
    );
  }, [hasSearchQuery, searchQuery]);

  const listEmptyComponent = hasSearchQuery ? emptySearch : (emptyState ?? null);
  const messagesContainerStyle = useMemo(
    () => [styles.messagesContainer, { paddingBottom: contentPaddingBottom }],
    [contentPaddingBottom],
  );

  if (isMessagesLoading) {
    return (
      <View style={styles.shimmerContainer}>
        <ChatShimmerMessage />
        <ChatShimmerMessage variant="user" />
        <ChatShimmerMessage />
      </View>
    );
  }

  return (
    <>
      <FlatList
        ref={listRef}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={
          displayMessages.length > 0 ? (
            <Pressable onPress={() => setActiveActionMessageId(null)} style={styles.dismissArea} />
          ) : null
        }
        contentContainerStyle={messagesContainerStyle}
        data={displayMessages}
        keyExtractor={keyExtractor}
        inverted={false}
        onScrollBeginDrag={() => setActiveActionMessageId(null)}
        onContentSizeChange={() => {
          if (didInitialScrollRef.current || displayMessages.length === 0 || isMessagesLoading)
            return;

          didInitialScrollRef.current = true;
          requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated: false });
          });
        }}
        removeClippedSubviews={false}
        renderItem={renderItem}
        scrollEnabled={displayMessages.length > 0}
      />
      {chatSendStatus === 'submitted' ? <ChatShimmerMessage /> : null}
      {chatSendStatus === 'streaming' ? <ChatThinkingIndicator /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  dismissArea: {
    flexGrow: 1,
    minHeight: spacing[8],
  },
  emptySearch: {
    alignItems: 'center',
    paddingTop: spacing[7],
  },
  emptySearchText: {
    fontFamily: fontFamiliesNative.mono,
    fontSize: fontSizes.sm,
  },
  messagesContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[1],
    rowGap: CHAT_TURN_GAP,
  },
  shimmerContainer: {
    flex: 1,
    paddingTop: spacing[3],
  },
});
