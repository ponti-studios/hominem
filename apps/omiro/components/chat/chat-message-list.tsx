import type { ChatMessageItem } from '@hominem/chat';
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, type RefreshControlProps, Text, View } from 'react-native';

import { useStyles } from '~/components/theme';
import type { ChatGenerationState } from '~/services/chat/chat-generation';

import { ChatMessage } from './chat-message';
import { MessageEditModal } from './chat-message-edit-modal';
import { ChatShimmerMessage } from './chat-shimmer-message';

const AUTO_SCROLL_TO_BOTTOM_THRESHOLD = 0.25;
const keyExtractor = (item: ChatMessageItem) => item.renderKey ?? item.id;
function announceMessage(message: ChatMessageItem, previous?: ChatMessageItem) {
  const failed = Boolean(message.failed || message.error);
  const wasFailed = Boolean(previous?.failed || previous?.error);

  if (failed && !wasFailed) {
    AccessibilityInfo.announceForAccessibility('Message failed to send. Tap retry.');
    return;
  }

  if (!previous) {
    if (message.role === 'user') {
      AccessibilityInfo.announceForAccessibility('Message sent.');
    } else if (message.isStreaming) {
      AccessibilityInfo.announceForAccessibility('Assistant is responding.');
    } else {
      AccessibilityInfo.announceForAccessibility('New assistant message.');
    }
    return;
  }

  if (previous.isStreaming && !message.isStreaming && !failed) {
    AccessibilityInfo.announceForAccessibility('Assistant reply complete.');
  }
}

interface ChatMessageListProps {
  isMessagesLoading: boolean;
  displayMessages: ChatMessageItem[];
  showSearch: boolean;
  searchQuery: string;
  showDebug: boolean;
  onEdit?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  onToolCallRespond?: (input: { messageId: string; toolCallId: string; approved: boolean }) => void;
  isRespondingToToolCall?: boolean;
  formatTimestamp: (value: string) => string;
  emptyState?: React.ReactElement | null;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  // Extra bottom space to reserve while the keyboard is open and the composer
  // lifts above its normal spot. Stays 0 at rest since the composer already
  // takes up real layout space there.
  bottomInset?: number;
  generation?: ChatGenerationState | null;
}

export function ChatMessageList({
  isMessagesLoading,
  displayMessages,
  showSearch,
  searchQuery,
  showDebug,
  onEdit,
  onRegenerate,
  onDelete,
  onRetry,
  onToolCallRespond,
  isRespondingToToolCall,
  formatTimestamp,
  emptyState,
  refreshControl,
  bottomInset = 0,
  generation,
}: ChatMessageListProps) {
  const styles = useStyles((theme) => ({
    emptySearch: { alignItems: 'center', paddingTop: 28 },
    emptySearchText: { fontFamily: 'Menlo', color: theme.colors.tertiary },
    loadingState: { flex: 1, paddingTop: 12 },
    emptyState: { flex: 1 },
    list: { flex: 1 },
    bottomSentinel: { flexGrow: 1, minHeight: 32 },
    itemSeparator: { height: 20 },
  }));
  const renderedMessages = useMemo(
    () =>
      generation?.targetMessageId
        ? displayMessages.filter((message) => message.id !== generation.targetMessageId)
        : displayMessages,
    [displayMessages, generation?.targetMessageId],
  );
  const hasSearchQuery = showSearch && searchQuery.length > 0;
  const [activeActionMessageId, setActiveActionMessageId] = useState<string | null>(null);
  // A single shared edit modal + its draft state, instead of every row
  // carrying its own -- at most one message is ever being edited at a time,
  // and RN's Modal already no-ops when never opened, so this only saves the
  // per-row useStyles/useState overhead, but it's one source of truth
  // either way (same reasoning as activeActionMessageId above).
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const listRef = useRef<FlashListRef<ChatMessageItem> | null>(null);
  const prevCountRef = useRef(renderedMessages.length);
  const prevLastMessageIdRef = useRef(renderedMessages.at(-1)?.id ?? null);
  const announcedMessagesRef = useRef(new Map<string, ChatMessageItem>());
  const didInitializeAnnouncementsRef = useRef(false);

  useEffect(() => {
    const previousMessages = announcedMessagesRef.current;
    if (
      !didInitializeAnnouncementsRef.current &&
      isMessagesLoading &&
      displayMessages.length === 0
    ) {
      return;
    }

    if (!didInitializeAnnouncementsRef.current) {
      for (const message of renderedMessages) {
        previousMessages.set(message.id, message);
      }
      didInitializeAnnouncementsRef.current = true;
      return;
    }

    for (const message of renderedMessages) {
      const previous = previousMessages.get(message.id);
      announceMessage(message, previous);
      previousMessages.set(message.id, message);
    }
  }, [displayMessages.length, isMessagesLoading, renderedMessages]);

  // Force-scroll to the bottom when the user sends a new message, even if
  // they'd scrolled up. Staying near the bottom otherwise (including while a
  // reply streams in) is handled by FlashList's maintainVisibleContentPosition
  // below, which avoids the flash-then-jump you'd get from imperative scrollToEnd.
  useEffect(() => {
    const lastMessage = renderedMessages.at(-1) ?? null;
    const countChanged = renderedMessages.length !== prevCountRef.current;
    const lastMessageIdChanged = lastMessage?.id !== prevLastMessageIdRef.current;
    const shouldScrollForNewUserMessage =
      countChanged && lastMessageIdChanged && lastMessage?.role === 'user';

    prevCountRef.current = renderedMessages.length;
    prevLastMessageIdRef.current = lastMessage?.id ?? null;

    if (showSearch || !shouldScrollForNewUserMessage) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [renderedMessages, showSearch]);

  const onActivate = useCallback(
    (messageId: string) =>
      setActiveActionMessageId((currentMessageId) =>
        currentMessageId === messageId ? null : messageId,
      ),
    [],
  );

  const editingMessage = editingMessageId
    ? (renderedMessages.find((candidate) => candidate.id === editingMessageId) ?? null)
    : null;

  const onRequestEdit = useCallback(
    (messageId: string) => {
      const message = renderedMessages.find((candidate) => candidate.id === messageId);
      if (!message) {
        return;
      }
      setEditingMessageId(messageId);
      setDraftMessage(message.message);
    },
    [renderedMessages],
  );

  const closeEditModal = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  const saveEditModal = useCallback(() => {
    const trimmedContent = draftMessage.trim();
    if (!editingMessageId || !trimmedContent) {
      return;
    }
    onEdit?.(editingMessageId, trimmedContent);
    setEditingMessageId(null);
  }, [draftMessage, editingMessageId, onEdit]);

  const renderItem = useCallback<ListRenderItem<ChatMessageItem>>(
    ({ item }) => {
      // A row only counts as "new" if the announcement tracking above hasn't
      // seen its id -- that tracking gets seeded on the first non-loading
      // render, so historical rows (chat open, pagination) never qualify,
      // only messages added after that.
      const isNewMessage =
        didInitializeAnnouncementsRef.current && !announcedMessagesRef.current.has(item.id);
      // Same "haven't we already seen this id" tracking as isNewMessage above,
      // but for the failed-state transition specifically: a message that was
      // already failed the first time we saw it (chat open, pagination, or a
      // row recycled by FlashList into a message we haven't tracked yet)
      // shouldn't replay its retry-banner entrance; one that just flipped
      // from not-failed to failed while we were watching (live retry
      // failure, stream interrupted) should. Can't derive this from a
      // mount-scoped ref inside ChatMessage itself -- FlashList recycles the
      // same component instance across different messages, so "just
      // mounted" doesn't mean "just became this message."
      const previousMessage = announcedMessagesRef.current.get(item.id);
      const isNewlyFailed =
        didInitializeAnnouncementsRef.current &&
        Boolean(item.failed || item.error) &&
        !(previousMessage?.failed || previousMessage?.error);
      return (
        <ChatMessage
          formatTimestamp={formatTimestamp}
          isNewMessage={isNewMessage}
          isNewlyFailed={isNewlyFailed}
          message={item}
          {...{
            isActive: !item.isStreaming && activeActionMessageId === item.id,
            onActivate: item.isStreaming ? undefined : onActivate,
            onRequestEdit: item.isStreaming || !onEdit ? undefined : onRequestEdit,
            onRegenerate: item.isStreaming ? undefined : onRegenerate,
            onDelete: item.isStreaming ? undefined : onDelete,
            onRetry,
            onToolCallRespond,
            isRespondingToToolCall,
            showDebug,
          }}
        />
      );
    },
    [
      activeActionMessageId,
      onActivate,
      formatTimestamp,
      onDelete,
      onEdit,
      onRequestEdit,
      onRegenerate,
      onRetry,
      onToolCallRespond,
      isRespondingToToolCall,
      showDebug,
    ],
  );

  const emptySearch = hasSearchQuery ? (
    <View style={styles.emptySearch}>
      <Text style={styles.emptySearchText}>No messages matching &ldquo;{searchQuery}&rdquo;</Text>
    </View>
  ) : null;

  const listEmptyComponent = hasSearchQuery ? emptySearch : (emptyState ?? null);
  if (isMessagesLoading && renderedMessages.length === 0) {
    return (
      <View style={styles.loadingState}>
        <ChatShimmerMessage />
        <ChatShimmerMessage variant="user" />
        <ChatShimmerMessage />
      </View>
    );
  }

  if (!hasSearchQuery && renderedMessages.length === 0 && emptyState) {
    return <View style={[styles.emptyState, { paddingBottom: bottomInset }]}>{emptyState}</View>;
  }

  return (
    <>
      <MessageEditModal
        content={editingMessage?.message ?? ''}
        draftMessage={draftMessage}
        onCancel={closeEditModal}
        onChangeDraft={setDraftMessage}
        onSave={saveEditModal}
        visible={editingMessageId !== null}
      />
      <FlashList
        ref={listRef}
        style={styles.list}
        pointerEvents={generation ? 'box-none' : 'auto'}
        contentInsetAdjustmentBehavior="automatic"
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={
          renderedMessages.length > 0 ? (
            <Pressable
              accessibilityLabel="Chat message list bottom"
              onPress={() => setActiveActionMessageId(null)}
              style={styles.bottomSentinel}
              testID="chat-message-list-bottom-sentinel"
            />
          ) : null
        }
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 8 }}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        // Composer sits in normal flow at rest (bottomInset 0, nothing extra
        // reserved). When the keyboard's open it lifts by translating instead
        // of resizing, so bottomInset just covers that transient overlap.
        contentInset={{ bottom: bottomInset }}
        scrollIndicatorInsets={{ bottom: bottomInset }}
        data={renderedMessages}
        keyExtractor={keyExtractor}
        maintainVisibleContentPosition={{
          startRenderingFromBottom: true,
          autoscrollToBottomThreshold: AUTO_SCROLL_TO_BOTTOM_THRESHOLD,
        }}
        onScrollBeginDrag={() => setActiveActionMessageId(null)}
        renderItem={renderItem}
        refreshControl={refreshControl}
        scrollEnabled={renderedMessages.length > 0 || refreshControl !== undefined}
        testID="chat-message-list"
      />
    </>
  );
}
