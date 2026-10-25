import type { ChatMessageItem } from '@hominem/chat';
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  type RefreshControlProps,
  Text,
  View,
} from 'react-native';

import { fontFamilies, useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import type { ChatGenerationState } from '~/services/chat/chat-generation';
import { countRender } from '~/services/perf/stream-perf';

import { MessageEditModal } from './chat-message-edit-modal';
import { ChatMessageListRow } from './chat-message-list-row';
import { ChatShimmerMessage } from './chat-shimmer-message';
import { useChatMessageListEditing } from './use-chat-message-list-editing';
import { useChatMessageListLifecycle } from './use-chat-message-list-lifecycle';

const AUTO_SCROLL_TO_BOTTOM_THRESHOLD = 0.25;
// Within this many points of the end the list counts as "at the bottom" and keeps following new content.
const FOLLOW_BOTTOM_DISTANCE = 120;
// Far enough from the end that the reader has clearly left it (about a screen).
const JUMP_PILL_DISTANCE = 600;

// Reports a row's height. FlashList recycles native views, and a recycled view that happens to keep
// its size never fires onLayout for its new message, so also measure whenever the key changes.
function MeasuredRow({
  rowKey,
  onMeasure,
  onLayout,
  children,
}: {
  rowKey: string;
  onMeasure: (key: string, height: number) => void;
  onLayout: (key: string, event: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    ref.current?.measure((_x, _y, _width, height) => {
      if (height > 0) {
        onMeasure(rowKey, height);
      }
    });
  }, [rowKey, onMeasure]);
  return (
    <View ref={ref} collapsable={false} onLayout={(event) => onLayout(rowKey, event)}>
      {children}
    </View>
  );
}

const keyExtractor = (item: ChatMessageItem) => item.renderKey ?? item.id;
// Module-level so the list sees one stable component type, not a new one per render.
const ITEM_SEPARATOR_HEIGHT = 20;
const FOOTER_HEIGHT = 24;
const itemSeparatorStyle = { height: ITEM_SEPARATOR_HEIGHT };
const ItemSeparator = () => <View style={itemSeparatorStyle} />;

const FADE_STEPS = 10;
const FADE_STEP_HEIGHT = 3;
const fadeStrips = Array.from({ length: FADE_STEPS }, (_, index) => {
  const t = (index + 1) / FADE_STEPS;
  return { key: index, opacity: t * t * (3 - 2 * t) };
});

// The list ends flush against the composer; this softens that edge so
// messages dissolve into the page instead of being cut off.
function BottomFade({ color }: { color: string }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
      testID="chat-list-bottom-fade"
    >
      {fadeStrips.map((strip) => (
        <View
          key={strip.key}
          style={{ height: FADE_STEP_HEIGHT, backgroundColor: color, opacity: strip.opacity }}
        />
      ))}
    </View>
  );
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
  // Space the list keeps clear at the top for a floating header drawn over it.
  topInset?: number;
  generation?: ChatGenerationState | null;
}

function getEmptyListState({
  isLoading,
  hasSearchQuery,
  renderedMessages,
  emptyState,
  topInset,
  styles,
}: {
  isLoading: boolean;
  hasSearchQuery: boolean;
  renderedMessages: ChatMessageItem[];
  emptyState: React.ReactElement | null | undefined;
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
    return <View style={[styles.emptyState, { paddingTop: topInset }]}>{emptyState}</View>;
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
    bottomSentinel: { height: FOOTER_HEIGHT },
    jumpPill: {
      position: 'absolute',
      alignSelf: 'center',
      bottom: 12,
      height: 36,
      width: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.bar,
    },
  }));
  const { barForeground, background } = useAppTheme().colors;
  const targetMessageId = generation?.targetMessageId;
  const renderedMessages = useMemo(
    () =>
      targetMessageId
        ? displayMessages.filter((message) => message.id !== targetMessageId)
        : displayMessages,
    [displayMessages, targetMessageId],
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

  // Anchor-to-top: sending a message scrolls it to the top of the viewport and leaves blank space
  // below it (a native bottom content inset, so no row relayouts). The reply grows into that space
  // and we only start following the bottom once it has filled the viewport.
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [blank, setBlank] = useState(0);
  const anchorKeyRef = useRef<string | null>(null);
  const blankRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const rowHeightsRef = useRef(new Map<string, number>());
  const needsAnchorScrollRef = useRef(false);
  // Once the reader drags, the anchor stops steering the scroll position.
  const anchorDetachedRef = useRef(false);
  const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderedMessagesRef = useRef<ChatMessageItem[]>(renderedMessages);
  useEffect(() => {
    renderedMessagesRef.current = renderedMessages;
  }, [renderedMessages]);
  // The streaming reply grows without any data change, so the list's own autoscroll never fires.
  // Once settled, follow the bottom ourselves for as long as the reader is still there; scrolling
  // up to read stops following until they come back.
  const followingBottomRef = useRef(true);

  const recomputeBlank = useCallback(() => {
    const key = anchorKeyRef.current;
    if (!key) {
      return;
    }
    const messages = renderedMessagesRef.current;
    const anchorIndex = messages.findIndex((message) => (message.renderKey ?? message.id) === key);
    const viewport = viewportHeightRef.current;
    if (anchorIndex < 0 || viewport <= 0) {
      return;
    }
    let below = FOOTER_HEIGHT;
    for (let index = anchorIndex; index < messages.length; index++) {
      const message = messages[index];
      if (!message) {
        continue;
      }
      below += rowHeightsRef.current.get(message.renderKey ?? message.id) ?? 0;
      if (index > anchorIndex) {
        below += ITEM_SEPARATOR_HEIGHT;
      }
    }
    // The anchor sits flush under the floating header, so the usable viewport excludes it.
    const next = Math.max(0, Math.round(viewport - topInset - below));
    if (next !== blankRef.current) {
      blankRef.current = next;
      setBlank(next);
    }
    if (next === 0 && !needsAnchorScrollRef.current) {
      // The reply has filled the viewport: hand over to follow-the-bottom.
      anchorKeyRef.current = null;
      setAnchorKey(null);
      followingBottomRef.current = true;
    }
  }, [topInset]);

  // The blank inset is sized so the furthest the list can scroll is exactly "anchor flush under the
  // header". The native scroll view knows its true content size (ours lags a layout pass, and
  // scrollToIndex is unreliable over virtualized rows), so just ask it for its end, then re-ask
  // while rows are still measuring.
  const scrollToAnchor = useCallback(() => {
    const key = anchorKeyRef.current;
    if (!key) {
      return;
    }
    listRef.current?.getScrollResponder()?.scrollToEnd({ animated: true });
    if (verifyTimeoutRef.current) {
      clearTimeout(verifyTimeoutRef.current);
    }
    let attempts = 0;
    const verify = () => {
      if (anchorKeyRef.current !== key || attempts++ >= 3) {
        return;
      }
      listRef.current?.getScrollResponder()?.scrollToEnd({ animated: true });
      verifyTimeoutRef.current = setTimeout(verify, 300);
    };
    verifyTimeoutRef.current = setTimeout(verify, 400);
  }, []);

  const lastAnchoredKeyRef = useRef<string | null>(null);
  const onNewUserMessage = useCallback((key: string) => {
    if (lastAnchoredKeyRef.current === key) {
      return;
    }
    lastAnchoredKeyRef.current = key;
    anchorKeyRef.current = key;
    needsAnchorScrollRef.current = true;
    anchorDetachedRef.current = false;
    followingBottomRef.current = false;
    setAnchorKey(key);
    setSettled(true);
  }, []);

  const { announcedMessagesRef, didInitializeAnnouncementsRef } = useChatMessageListLifecycle({
    displayMessages,
    renderedMessages,
    isMessagesLoading,
    showSearch: search.isOpen,
    hasSearchQuery,
    onNewUserMessage,
  });
  const editing = useChatMessageListEditing({ messages: renderedMessages, onEdit });
  const hasList = renderedMessages.length > 0;

  // Rows are measured after first paint, so the content height keeps growing. Re-pin to the bottom on
  // every size change and reveal the list once the size has stopped changing.
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Scrolled well away from the end: offer a way back instead of leaving the reader stranded.
  const [showJump, setShowJump] = useState(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distance = contentSize.height - layoutMeasurement.height - contentOffset.y;
    followingBottomRef.current = distance < FOLLOW_BOTTOM_DISTANCE;
    setShowJump(distance > JUMP_PILL_DISTANCE);
  }, []);
  const jumpToLatest = useCallback(() => {
    setShowJump(false);
    if (anchorKeyRef.current) {
      scrollToAnchor();
      return;
    }
    followingBottomRef.current = true;
    listRef.current?.scrollToEnd({ animated: true });
  }, [scrollToAnchor]);
  // FlashList's scrollToEnd stops at the last row and can miss the footer; the native scroll view
  // knows its real content size, so ask it to go to the true end.
  const scrollToExactEnd = useCallback(() => {
    const scroller = listRef.current?.getScrollResponder();
    if (scroller) {
      scroller.scrollToEnd({ animated: false });
    } else {
      listRef.current?.scrollToEnd({ animated: false });
    }
  }, []);
  const pinToBottomUntilStable = useCallback(() => {
    // While a reply is growing into the anchor's blank space the list must stay put.
    if (anchorKeyRef.current) {
      recomputeBlank();
      return;
    }
    if (settled) {
      if (followingBottomRef.current) {
        scrollToExactEnd();
      }
      return;
    }
    scrollToExactEnd();
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
    }
    settleTimeoutRef.current = setTimeout(() => setSettled(true), 150);
  }, [settled, scrollToExactEnd, recomputeBlank]);

  // A chat opened straight into a live reply (e.g. just started from the inbox) never sees the
  // send happen here, so anchor to the message that is being answered.
  const isGenerating = Boolean(generation);
  useEffect(() => {
    if (!isGenerating) {
      return;
    }
    // The message being answered is either the last row, or the one right before the reply that is
    // still streaming. A finished older reply means the send hasn't landed yet; the lifecycle hook
    // announces that one.
    const last = renderedMessages.at(-1);
    const beforeLast = renderedMessages.at(-2);
    const answered =
      last?.role === 'user'
        ? last
        : last?.isStreaming && beforeLast?.role === 'user'
          ? beforeLast
          : null;
    if (answered) {
      onNewUserMessage(answered.renderKey ?? answered.id);
    }
  }, [isGenerating, renderedMessages, onNewUserMessage]);

  // Scroll the sent message to the top once its blank space is in place (the inset is native, so
  // it has to exist before the offset is reachable).
  useEffect(() => {
    if (!anchorKey || blank <= 0) {
      return;
    }
    if (needsAnchorScrollRef.current) {
      // Not cancelled on re-run: `blank` keeps changing while rows measure, and the flag is already
      // cleared, so cancelling here would drop the scroll for good.
      needsAnchorScrollRef.current = false;
      requestAnimationFrame(scrollToAnchor);
      return;
    }
    // The inset moved after we landed (keyboard closing, the reply row re-measuring): keep the
    // anchor flush under the header unless the reader has taken over.
    if (!anchorDetachedRef.current) {
      requestAnimationFrame(() =>
        listRef.current?.getScrollResponder()?.scrollToEnd({ animated: false }),
      );
    }
  }, [anchorKey, blank, scrollToAnchor]);

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
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
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
      const previousMessage = announcedMessagesRef.current.get(item.renderKey ?? item.id);
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
  const onRowHeight = useCallback(
    (key: string, height: number) => {
      if (rowHeightsRef.current.get(key) === height) {
        return;
      }
      rowHeightsRef.current.set(key, height);
      recomputeBlank();
    },
    [recomputeBlank],
  );
  const onRowLayout = useCallback(
    (key: string, event: LayoutChangeEvent) => onRowHeight(key, event.nativeEvent.layout.height),
    [onRowHeight],
  );
  const renderItem = useCallback<ListRenderItem<ChatMessageItem>>(
    ({ item }) => {
      const key = item.renderKey ?? item.id;
      return (
        <MeasuredRow rowKey={key} onMeasure={onRowHeight} onLayout={onRowLayout}>
          {renderRow(item)}
        </MeasuredRow>
      );
    },
    [renderRow, onRowHeight, onRowLayout],
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
      <View
        onLayout={(event) => {
          viewportHeightRef.current = event.nativeEvent.layout.height;
          pinToBottomUntilStable();
        }}
        style={styles.list}
      >
        <FlashList
          ref={listRef}
          style={[styles.list, { opacity: settled ? 1 : 0 }]}
          onLoad={pinToBottomUntilStable}
          onContentSizeChange={pinToBottomUntilStable}
          onScroll={onScroll}
          scrollEventThrottle={32}
          pointerEvents={generation ? 'box-none' : 'auto'}
          contentInset={blank > 0 ? { bottom: blank } : undefined}
          contentInsetAdjustmentBehavior="never"
          ListEmptyComponent={listEmptyComponent}
          ListFooterComponent={
            renderedMessages.length > 0 ? (
              <>
                <Pressable
                  accessibilityLabel="Chat message list bottom"
                  onLayout={pinToBottomUntilStable}
                  onPress={() => setActiveActionMessageId(null)}
                  style={styles.bottomSentinel}
                  testID="chat-message-list-bottom-sentinel"
                />
              </>
            ) : null
          }
          // Stretching a short chat to the viewport would add the blank inset on top of that height
          // and push the anchor past the header, so only stretch when nothing is anchored.
          contentContainerStyle={{
            flexGrow: anchorKey ? 0 : 1,
            paddingHorizontal: 16,
            paddingTop: topInset,
          }}
          ItemSeparatorComponent={ItemSeparator}
          data={renderedMessages}
          keyExtractor={keyExtractor}
          maintainVisibleContentPosition={{
            startRenderingFromBottom: !anchorKey,
            autoscrollToBottomThreshold: anchorKey ? undefined : AUTO_SCROLL_TO_BOTTOM_THRESHOLD,
          }}
          onScrollBeginDrag={() => {
            anchorDetachedRef.current = true;
            setActiveActionMessageId(null);
          }}
          renderItem={renderItem}
          refreshControl={refreshControl}
          scrollEnabled={renderedMessages.length > 0 || refreshControl !== undefined}
          testID="chat-message-list"
        />
        <BottomFade color={background} />
        {showJump ? (
          <Pressable
            accessibilityLabel="Jump to latest message"
            accessibilityRole="button"
            onPress={jumpToLatest}
            style={styles.jumpPill}
            testID="chat-jump-to-latest"
          >
            <AppIcon name="arrow.down" size={16} tintColor={barForeground} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}
