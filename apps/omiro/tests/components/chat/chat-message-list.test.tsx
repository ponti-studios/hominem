// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    ListFooterComponent,
    ListHeaderComponent,
  }: {
    ListFooterComponent?: React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
  }) => (
    <div data-testid="flash-list">
      <div data-testid="list-header">{ListHeaderComponent}</div>
      <div data-testid="list-footer">{ListFooterComponent}</div>
    </div>
  ),
}));
vi.mock('react-native', () => ({
  AccessibilityInfo: { announceForAccessibility: vi.fn() },
  Pressable: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('~/components/ui/icon', () => ({ default: () => <span /> }));
vi.mock('~/components/theme', () => ({
  fontFamilies: { mono: 'Geist Mono' },
  useAppTheme: () => ({ colors: { barForeground: '' } }),
  useStyles: (factory: (theme: { colors: Record<string, string> }) => unknown) =>
    factory({
      colors: {
        foreground: '',
        mutedForeground: '',
        muted: '',
        primary: '',
        tertiary: '',
      },
    }),
}));
vi.mock('~/components/chat/chat-message', () => ({ ChatMessage: () => <div /> }));
vi.mock('~/components/chat/chat-message-edit-modal', () => ({
  MessageEditModal: () => <div />,
}));
vi.mock('~/components/chat/chat-shimmer-message', () => ({
  ChatShimmerMessage: ({ variant }: { variant?: string }) => (
    <div data-testid={`chat-shimmer-${variant ?? 'assistant'}`} />
  ),
}));

const { ChatMessageList } = await import('~/components/chat/chat-message-list');
type ChatMessageListProps = ComponentProps<typeof ChatMessageList>;

function renderChatMessageList(overrides: Partial<ChatMessageListProps> = {}) {
  return render(
    <ChatMessageList
      displayMessages={[]}
      formatTimestamp={() => ''}
      isMessagesLoading={false}
      search={{ isOpen: false, query: '', isLoading: false }}
      showDebug={false}
      {...overrides}
    />,
  );
}

describe('ChatMessageList', () => {
  it('shows the loading placeholders before an empty message list', () => {
    const { getAllByTestId, getByTestId, queryByTestId } = renderChatMessageList({
      isMessagesLoading: true,
    });

    expect(getAllByTestId('chat-shimmer-assistant')).toHaveLength(2);
    expect(getByTestId('chat-shimmer-user')).toBeTruthy();
    expect(queryByTestId('chat-message-list')).toBeNull();
  });

  it('shows the empty state after message loading finishes', () => {
    const { getByTestId, queryByTestId } = renderChatMessageList({
      emptyState: <div data-testid="chat-empty-state" />,
    });

    expect(getByTestId('chat-empty-state')).toBeTruthy();
    expect(queryByTestId('chat-shimmer-assistant')).toBeNull();
    expect(queryByTestId('chat-message-list')).toBeNull();
  });

  it('does not own the generation activity card', () => {
    const { getByTestId, queryByTestId } = renderChatMessageList({
      displayMessages: [
        {
          id: 'user-1',
          renderKey: 'user-1',
          role: 'user',
          message: 'Trigger failure',
          createdAt: new Date().toISOString(),
          chatId: 'chat-1',
          reasoning: null,
          toolCalls: null,
          isStreaming: false,
        },
      ],
      generation: {
        id: 'generation-1',
        chatId: 'chat-1',
        stage: 'failed',
        lastDurableSequence: 3,
      },
    });

    expect(getByTestId('list-footer').querySelector('[data-testid="chat-activity"]')).toBeNull();
    expect(getByTestId('list-header').querySelector('[data-testid="chat-activity"]')).toBeNull();
    expect(queryByTestId('chat-activity')).toBeNull();
  });
});
