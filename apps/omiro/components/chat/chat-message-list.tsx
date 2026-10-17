import type { ChatMessageItem } from '@hominem/chat';
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import type React from 'react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  type RefreshControlProps,
  type ScrollViewProps,
  Text,
  View,
} from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import type Animated from 'react-native-reanimated';

import { fontFamilies, useStyles } from '~/components/theme';
import type { ChatGenerationState } from '~/services/chat/chat-generation';

import { MessageEditModal } from './chat-message-edit-modal';
import { ChatMessageListRow } from './chat-message-list-row';
import { ChatShimmerMessage } from './chat-shimmer-message';
import { useChatMessageListEditing } from './use-chat-message-list-editing';
import { useChatMessageListLifecycle } from './use-chat-message-list-lifecycle';

const AUTO_SCROLL_TO_BOTTOM_THRESHOLD = 0.25;

// How far the list's bottom edge sits above the keyboard's resting spot, so
// the scroll view lifts its content by exactly the amount the keyboard (and the
// composer riding on it) covers.
const KeyboardOffsetContext = createContext(0);

// The list's scroll view: when the keyboard opens the messages move up with it
// (and back down when it closes), so the bottom of the conversation stays in
// view instead of ending up behind the composer.
const ChatScrollView = forwardRef<Animated.ScrollView, ScrollViewProps>(
  function ChatScrollView(props, ref) {
    const offset = useContext(KeyboardOffsetContext);
    return (
      <KeyboardChatScrollView {...props} keyboardLiftBehavior="always" offset={offset} ref={ref} />
    );
  },
);
const keyExtractor = (item: ChatMessageItem) => item.renderKey ?? item.id;

interface ChatMessageListProps {
  isMessagesLoading: boolean;
  displayMessages: ChatMessageItem[];
  search: { isOpen: boolean; query: string; isLoading: boolean };
  showDebug: boolean;
  onEdit?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  formatTimestamp: (value: string) => string;
  emptyState?: React.ReactElement | null;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  // Bottom space the empty state keeps clear while the keyboard is open.
  bottomInset?: number;
  // Where the list's bottom edge rests above the keyboard (see ChatScrollView).
  keyboardOffset?: number;
  generation?: ChatGenerationState | null;
}

function getEmptyListState({
  isLoading,
  hasSearchQuery,
  renderedMessages,
  emptyState,
  bottomInset,
  styles,
}: {
  isLoading: boolean;
  hasSearchQuery: boolean;
  renderedMessages: ChatMessageItem[];
  emptyState: React.ReactElement | null | undefined;
  bottomInset: number;
  styles: ReturnType<typeof useStyles>;
}): React.ReactElement | null {
  if (isLoading && renderedMessages.length === 0) {
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

  return null;
}

export function ChatMessageList({
  isMessagesLoading,
  displayMessages,
  search,
  showDebug,
  onEdit,
  onRegenerate,
  onDelete,
  onRetry,
  formatTimestamp,
  emptyState,
  refreshControl,
  bottomInset = 0,
  keyboardOffset = 0,
  generation,
}: ChatMessageListProps) {
  const styles = useStyles((theme) => ({
    emptySearch: { alignItems: 'center', paddingTop: 28 },
    emptySearchText: { fontFamily: fontFamilies.mono, color: theme.colors.tertiary },
    loadingState: { flex: 1, paddingTop: 12 },
    emptyState: { flex: 1 },
    list: { flex: 1 },
    bottomSentinel: { flexGrow: 1, minHeight: 32 },
    itemSeparator: { height: 20 },
  }));
  const targetMessageId = generation?.targetMessageId;
  const renderedMessages = useMemo(
    () =>
      targetMessageId
        ? displayMessages.filter((message) => message.id !== targetMessageId)
        : displayMessages,
    [displayMessages, targetMessageId],
  );
  const hasSearchQuery = search.isOpen && search.query.length > 0;
  const [activeActionMessageId, setActiveActionMessageId] = useState<string | null>(null);
  // A single shared edit modal + its draft state, instead of every row
  // carrying its own -- at most one message is ever being edited at a time,
  // and RN's Modal already no-ops when never opened, so this only saves the
  // per-row useStyles/useState overhead, but it's one source of truth
  // either way (same reasoning as activeActionMessageId above).
  const listRef = useRef<FlashListRef<ChatMessageItem> | null>(null);
  const { announcedMessagesRef, didInitializeAnnouncementsRef } = useChatMessageListLifecycle({
    displayMessages,
    renderedMessages,
    isMessagesLoading,
    showSearch: search.isOpen,
    hasSearchQuery,
    listRef,
  });
  const editing = useChatMessageListEditing({ messages: renderedMessages, onEdit });

  const onActivate = useCallback(
    (messageId: string) =>
      setActiveActionMessageId((currentMessageId) =>
        currentMessageId === messageId ? null : messageId,
      ),
    [],
  );

  const renderItem = useCallback<ListRenderItem<ChatMessageItem>>(
    ({ item }) => {
      const previousMessage = announcedMessagesRef.current.get(item.id);
      return (
        <ChatMessageListRow
          message={item}
          wasInitialized={didInitializeAnnouncementsRef.current && !hasSearchQuery}
          previousMessage={previousMessage}
          isActive={activeActionMessageId === item.id}
          onActivate={onActivate}
          onRequestEdit={onEdit ? editing.requestEdit : undefined}
          onRegenerate={onRegenerate}
          onDelete={onDelete}
          onRetry={onRetry}
          formatTimestamp={formatTimestamp}
          showDebug={showDebug}
        />
      );
    },
    [
      activeActionMessageId,
      onActivate,
      formatTimestamp,
      onDelete,
      onEdit,
      onRegenerate,
      onRetry,
      showDebug,
      editing.requestEdit,
      didInitializeAnnouncementsRef,
      announcedMessagesRef,
      hasSearchQuery,
    ],
  );

  const emptySearch = hasSearchQuery ? (
    <View style={styles.emptySearch}>
      <Text style={styles.emptySearchText}>No messages matching &ldquo;{search.query}&rdquo;</Text>
    </View>
  ) : null;

  const listEmptyComponent = hasSearchQuery ? emptySearch : (emptyState ?? null);
  const emptyListState = getEmptyListState({
    isLoading: isMessagesLoading || (hasSearchQuery && search.isLoading),
    hasSearchQuery,
    renderedMessages,
    emptyState,
    bottomInset,
    styles,
  });
  if (emptyListState) {
    return emptyListState;
  }

  return (
    <>
      <MessageEditModal
        content={editing.message?.message ?? ''}
        draftMessage={editing.draft}
        onCancel={editing.close}
        onChangeDraft={editing.setDraft}
        onSave={editing.save}
        visible={editing.messageId !== null}
      />
      <KeyboardOffsetContext.Provider value={keyboardOffset}>
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
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          renderScrollComponent={ChatScrollView}
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
      </KeyboardOffsetContext.Provider>
    </>
  );
}
