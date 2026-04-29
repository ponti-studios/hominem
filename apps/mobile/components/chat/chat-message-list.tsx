import type { ChatMessageItem, ChatRenderIcon, MarkdownComponent } from '@hominem/chat';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { FlatList, Pressable, StyleSheet, View, type FlatList as RNFlatList } from 'react-native';

import { Text } from '~/components/theme';
import { fontFamiliesNative, fontSizes, spacing } from '~/components/theme';

import { renderChatMessage } from './chat-message';
import { ChatShimmerMessage } from './chat-shimmer-message';

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
  const prevCountRef = useRef(displayMessages.length);

  // Scroll to end when a new message is added or streaming content grows
  useEffect(() => {
    const isStreaming = displayMessages.some((m) => m.isStreaming);
    const countChanged = displayMessages.length !== prevCountRef.current;
    prevCountRef.current = displayMessages.length;

    if (countChanged || isStreaming) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: countChanged });
      });
    }
  }, [displayMessages]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessageItem }) =>
      renderChatMessage(item, markdown, renderIcon, formatTimestamp, {
        isActive: !item.isStreaming && activeActionMessageId === item.id,
        onActivate: item.isStreaming
          ? undefined
          : () =>
              setActiveActionMessageId((currentMessageId) =>
                currentMessageId === item.id ? null : item.id,
              ),
        onCopy: item.isStreaming ? undefined : onCopy,
        onDelete: item.isStreaming ? undefined : onDelete,
        onEdit: item.isStreaming ? undefined : onEdit,
        onRegenerate: item.isStreaming ? undefined : onRegenerate,
        onShare: item.isStreaming ? undefined : onShare,
        onSpeak: item.isStreaming ? undefined : onSpeak,
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
    <FlatList
      ref={listRef}
      style={styles.list}
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
      removeClippedSubviews={false}
      renderItem={renderItem}
      scrollEnabled={displayMessages.length > 0}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
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
