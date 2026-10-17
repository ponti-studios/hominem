import type { ChatMessageItem } from '@hominem/chat';
import type { FlashListRef } from '@shopify/flash-list';
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { announceForAccessibility } = vi.hoisted(() => ({
  announceForAccessibility: vi.fn(),
}));
vi.mock('react-native', () => ({
  AccessibilityInfo: { announceForAccessibility },
}));

const { useChatMessageListLifecycle } =
  await import('~/components/chat/use-chat-message-list-lifecycle');

function message(id: string, role: ChatMessageItem['role']): ChatMessageItem {
  return {
    id,
    renderKey: id,
    role,
    message: id,
    createdAt: new Date().toISOString(),
    chatId: 'chat-1',
    reasoning: null,
    toolCalls: null,
    isStreaming: false,
  };
}

describe('useChatMessageListLifecycle', () => {
  beforeEach(() => {
    announceForAccessibility.mockClear();
  });

  it('announces only new messages and scrolls to a newly sent message', () => {
    const frames: FrameRequestCallback[] = [];
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const scrollToEnd = vi.fn();
    const listRef: {
      current: Pick<FlashListRef<ChatMessageItem>, 'scrollToEnd'> | null;
    } = { current: { scrollToEnd } };
    const existingMessage = message('assistant-1', 'assistant');
    const { rerender } = renderHook(
      ({
        displayMessages,
        isMessagesLoading,
      }: {
        displayMessages: ChatMessageItem[];
        isMessagesLoading: boolean;
      }) =>
        useChatMessageListLifecycle({
          displayMessages,
          renderedMessages: displayMessages,
          isMessagesLoading,
          showSearch: false,
          hasSearchQuery: false,
          listRef,
        }),
      { initialProps: { displayMessages: [existingMessage], isMessagesLoading: false } },
    );

    expect(announceForAccessibility).not.toHaveBeenCalled();
    expect(requestFrame).not.toHaveBeenCalled();

    rerender({
      displayMessages: [existingMessage, message('user-1', 'user')],
      isMessagesLoading: false,
    });

    expect(announceForAccessibility).toHaveBeenCalledWith('Message sent.');
    expect(requestFrame).toHaveBeenCalledTimes(1);
    act(() => frames.at(-1)?.(0));
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });
  });

  it('does not announce search results and bounds the announcement history to rendered messages', () => {
    const listRef: {
      current: Pick<FlashListRef<ChatMessageItem>, 'scrollToEnd'> | null;
    } = { current: { scrollToEnd: vi.fn() } };
    const currentMessage = message('current-1', 'assistant');
    const historicalSearchResult = message('search-result-1', 'assistant');
    const { result, rerender } = renderHook(
      ({
        displayMessages,
        hasSearchQuery,
        showSearch,
      }: {
        displayMessages: ChatMessageItem[];
        hasSearchQuery: boolean;
        showSearch: boolean;
      }) =>
        useChatMessageListLifecycle({
          displayMessages,
          renderedMessages: displayMessages,
          isMessagesLoading: false,
          showSearch,
          hasSearchQuery,
          listRef,
        }),
      {
        initialProps: {
          displayMessages: [currentMessage],
          hasSearchQuery: false,
          showSearch: false,
        },
      },
    );

    rerender({ displayMessages: [historicalSearchResult], hasSearchQuery: true, showSearch: true });
    expect(announceForAccessibility).not.toHaveBeenCalled();
    expect(result.current.announcedMessagesRef.current.has('search-result-1')).toBe(false);

    rerender({ displayMessages: [currentMessage], hasSearchQuery: false, showSearch: false });
    expect(announceForAccessibility).not.toHaveBeenCalled();
    expect([...result.current.announcedMessagesRef.current.keys()]).toEqual(['current-1']);

    rerender({
      displayMessages: [currentMessage, message('live-while-search-open', 'assistant')],
      hasSearchQuery: false,
      showSearch: true,
    });
    expect(announceForAccessibility).toHaveBeenCalledWith('New assistant message.');
  });
});
