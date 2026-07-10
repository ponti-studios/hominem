import type { ChatMessageItem, ChatRenderIcon, MarkdownComponent } from '@hominem/chat';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import type React from 'react';
import { Pressable, type RefreshControlProps, StyleSheet, View } from 'react-native';

import { Text, fontFamiliesNative, fontSizes, spacing } from '~/components/theme';

import { renderChatMessage } from './chat-message';
import { ChatShimmerMessage } from './chat-shimmer-message';

const CHAT_TURN_GAP = spacing[5];
const keyExtractor = (item: ChatMessageItem) => item.id;

interface ChatMessageListProps {
  isMessagesLoading: boolean;
  displayMessages: ChatMessageItem[];
  showSearch: boolean;
  searchQuery: string;
  markdown: MarkdownComponent | null;
  showDebug: boolean;
  onCopy: (message: ChatMessageItem) => void;
  onEdit?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onShare: (message: ChatMessageItem) => void;
  renderIcon: ChatRenderIcon;
  formatTimestamp: (value: string) => string;
  contentPaddingBottom?: number;
  emptyState?: React.ReactElement | null;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function ChatMessageList({
  isMessagesLoading,
  displayMessages,
  showSearch,
  searchQuery,
  markdown,
  showDebug,
  onCopy,
  onEdit,
  onRegenerate,
  onDelete,
  onShare,
  renderIcon,
  formatTimestamp,
  contentPaddingBottom = 0,
  emptyState,
  refreshControl,
}: ChatMessageListProps) {
  const hasSearchQuery = showSearch && searchQuery.length > 0;
  const [activeActionMessageId, setActiveActionMessageId] = useState<string | null>(null);

  const renderItem = useCallback<ListRenderItem<ChatMessageItem>>(
    ({ item }) =>
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
        showDebug,
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
      renderIcon,
      showDebug,
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

  if (isMessagesLoading && displayMessages.length === 0) {
    return (
      <View style={styles.shimmerContainer}>
        <ChatShimmerMessage />
        <ChatShimmerMessage variant="user" />
        <ChatShimmerMessage />
      </View>
    );
  }

  return (
    <FlashList
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
      onScrollBeginDrag={() => setActiveActionMessageId(null)}
      renderItem={renderItem}
      refreshControl={refreshControl}
      scrollEnabled={displayMessages.length > 0 || refreshControl !== undefined}
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
