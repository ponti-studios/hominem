import type { ChatMessageItem } from '@hominem/chat';
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import type React from 'react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
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
import { countRender } from '~/services/perf/stream-perf';

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
// Module-level so the list sees one stable component type, not a new one per render.
const itemSeparatorStyle = { height: 20 };
const ItemSeparator = () => <View style={itemSeparatorStyle} />;

// Calls the row renderer from its own render, the way the list does for its items.
function RenderedRow({
  item,
  render,
}: {
  item: ChatMessageItem;
  render: (item: ChatMessageItem) => React.ReactElement;
}) {
  return render(item);
}

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
  // Space the list keeps clear at the top for a floating header drawn over it.
  topInset?: number;
  generation?: ChatGenerationState | null;
}

function getEmptyListState({
  isLoading,
  hasSearchQuery,
  renderedMessages,
  emptyState,
  bottomInset,
  topInset,
  styles,
}: {
  isLoading: boolean;
  hasSearchQuery: boolean;
  renderedMessages: ChatMessageItem[];
  emptyState: React.ReactElement | null | undefined;
  bottomInset: number;
  topInset: number;
  styles: ReturnType<typeof useStyles>;
}): React.ReactElement | null {
  if (isLoading && renderedMessages.length === 0) {
    return (
      <View style={[styles.loadingState, { marginTop: topInset }]}>
        <ChatShimmerMessage />
        <ChatShimmerMessage variant="user" />
        <ChatShimmerMessage />
      </View>
    );
  }

  if (!hasSearchQuery && renderedMessages.length === 0 && emptyState) {
    return (
      <View style={[styles.emptyState, { paddingBottom: bottomInset, paddingTop: topInset }]}>
        {emptyState}
      </View>
    );
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
  topInset = 0,
  generation,
}: ChatMessageListProps) {
  countRender('ChatMessageList');
  const styles = useStyles((theme) => ({
    emptySearch: { alignItems: 'center', paddingTop: 28 },
    emptySearchText: { fontFamily: fontFamilies.mono, color: theme.colors.tertiary },
    loadingState: { flex: 1, paddingTop: 12 },
    emptyState: { flex: 1 },
    list: { flex: 1 },
    streamingRow: { marginTop: 20 },
    bottomSentinel: { flexGrow: 1, minHeight: 32 },
  }));
  const targetMessageId = generation?.targetMessageId;
  const renderedMessages = useMemo(
    () =>
      targetMessageId
        ? displayMessages.filter((message) => message.id !== targetMessageId)
        : displayMessages,
    [displayMessages, targetMessageId],
  );
  // The reply still arriving lives in the list footer, not in the data: its height changes
  // every word, and as a list item that would re-lay-out every row around it.
  const streamingMessage = useMemo(
    () => renderedMessages.find((message) => message.isStreaming),
    [renderedMessages],
  );
  const listData = useMemo(
    () =>
      streamingMessage
        ? renderedMessages.filter((message) => !message.isStreaming)
        : renderedMessages,
    [renderedMessages, streamingMessage],
  );
  const hasSearchQuery = search.isOpen && search.query.length > 0;
  // The list first paints at an estimated offset and then jumps once rows are measured. Keep it
  // invisible until it has been pinned to the real bottom, so opening a chat doesn't visibly scroll.
  const [settled, setSettled] = useState(false);
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
  const hasList = renderedMessages.length > 0;

  // Rows are measured after first paint, so the content height keeps growing. Re-pin to the bottom on
  // every size change and reveal the list once the size has stopped changing.
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinToBottomUntilStable = useCallback(() => {
    if (settled) {
      return;
    }
    listRef.current?.scrollToEnd({ animated: false });
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
    }
    settleTimeoutRef.current = setTimeout(() => setSettled(true), 150);
  }, [settled]);

  // Never leave the list hidden if no size change ever arrives.
  useEffect(() => {
    if (!hasList || settled) {
      return;
    }
    const timeout = setTimeout(() => setSettled(true), 800);
    return () => clearTimeout(timeout);
  }, [hasList, settled]);

  useEffect(
    () => () => {
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
    },
    [],
  );

  const onActivate = useCallback(
    (messageId: string) =>
      setActiveActionMessageId((currentMessageId) =>
        currentMessageId === messageId ? null : messageId,
      ),
    [],
  );

  const renderRow = useCallback(
    (item: ChatMessageItem) => {
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
  const renderItem = useCallback<ListRenderItem<ChatMessageItem>>(
    ({ item }) => renderRow(item),
    [renderRow],
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
    topInset,
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
          style={[styles.list, { opacity: settled ? 1 : 0 }]}
          onLoad={pinToBottomUntilStable}
          onContentSizeChange={pinToBottomUntilStable}
          pointerEvents={generation ? 'box-none' : 'auto'}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={streamingMessage ? null : listEmptyComponent}
          ListFooterComponent={
            renderedMessages.length > 0 ? (
              <>
                {streamingMessage ? (
                  <View
                    key={streamingMessage.renderKey ?? streamingMessage.id}
                    style={listData.length > 0 ? styles.streamingRow : undefined}
                  >
                    <RenderedRow item={streamingMessage} render={renderRow} />
                  </View>
                ) : null}
                <Pressable
                  accessibilityLabel="Chat message list bottom"
                  onPress={() => setActiveActionMessageId(null)}
                  style={styles.bottomSentinel}
                  testID="chat-message-list-bottom-sentinel"
                />
              </>
            ) : null
          }
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: topInset }}
          ItemSeparatorComponent={ItemSeparator}
          renderScrollComponent={ChatScrollView}
          data={listData}
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
