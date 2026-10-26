import type { ChatMessageItem } from '@hominem/chat';
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createChatMessageStyles } from '~/components/chat/chat-message.styles';
import { lightTheme } from '~/components/theme';

vi.mock('~/components/theme', () => ({
  lightTheme: {
    colors: {
      background: 'background',
      border: 'border',
      card: 'card',
      destructive: 'destructive',
      foreground: 'foreground',
      primary: 'primary',
      primaryForeground: 'primaryForeground',
      tertiary: 'tertiary',
    },
    borderRadii: { lg: 8, xl: 16 },
    textVariants: { mono: { fontFamily: 'mono' } },
  },
}));
vi.mock('~/components/ui/icon', () => ({
  default: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));
vi.mock('~/services/motion/native-motion', () => ({
  nativeMotionAnimations: {
    fadeInQuick: {},
    fadeInDownQuick: {},
    fadeOutQuick: {},
    fadeOutUpQuick: {},
    layoutQuick: {},
  },
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
}));
vi.mock('~/components/chat/chat-message-content', () => ({
  MessageContent: ({
    content,
    enableMarkdown,
    children,
  }: {
    content: string;
    enableMarkdown: boolean;
    children: React.ReactNode;
  }) => (
    <div data-markdown={String(enableMarkdown)}>
      <span>{content}</span>
      {children}
    </div>
  ),
}));
vi.mock('expo-image', () => ({
  Image: ({ source, testID }: { source: { uri: string }; testID?: string }) => (
    <img alt="" data-testid={testID} src={source.uri} />
  ),
}));
vi.mock('~/components/chat/chat-message-debug', () => ({
  MessageDebug: ({ hasReasoning }: { hasReasoning: boolean }) => (
    <span data-testid="message-debug" data-reasoning={String(hasReasoning)} />
  ),
}));
vi.mock('~/components/chat/chat-thinking-indicator', () => ({
  ChatThinkingIndicator: () => <span data-testid="thinking-indicator" />,
}));
const streamed = vi.hoisted(() => ({ text: '' }));
vi.mock('~/services/chat/streaming-text-store', () => ({
  useStreamingMessageText: () => streamed.text,
}));

const { ChatMessageBubble } = await import('~/components/chat/chat-message-bubble');
const styles = createChatMessageStyles(lightTheme);

function message(overrides: Partial<ChatMessageItem> = {}): ChatMessageItem {
  return {
    id: 'message-1',
    renderKey: 'message-1',
    role: 'assistant',
    message: 'Hello',
    createdAt: new Date().toISOString(),
    chatId: 'chat-1',
    reasoning: null,
    toolCalls: null,
    isStreaming: false,
    ...overrides,
  };
}

describe('ChatMessageBubble', () => {
  it('shows the photos sent with a user message', () => {
    render(
      <ChatMessageBubble
        isNewlyFailed={false}
        isUser
        message={message({
          role: 'user',
          images: [{ id: 'file-1', url: 'file:///photo.jpg' }],
        })}
        reducedMotion
        showDebug={false}
        styles={styles}
      />,
    );

    expect(screen.getByTestId('chat-message-image-file-1').getAttribute('src')).toBe(
      'file:///photo.jpg',
    );
  });

  it('renders no empty text line for a photo-only user message', () => {
    render(
      <ChatMessageBubble
        isNewlyFailed={false}
        isUser
        message={message({
          role: 'user',
          message: '',
          images: [{ id: 'file-1', url: 'file:///photo.jpg' }],
        })}
        reducedMotion
        showDebug={false}
        styles={styles}
      />,
    );

    expect(screen.getByTestId('chat-message-image-file-1')).not.toBeNull();
    expect(document.querySelector('[data-markdown]')).toBeNull();
  });

  it('keeps user text verbatim and exposes retry as an accessible action', () => {
    const onRetry = vi.fn();
    render(
      <ChatMessageBubble
        isNewlyFailed
        isUser
        message={message({
          role: 'user',
          message: 'Use *literal* text',
          error: 'Send failed',
          failed: true,
        })}
        styles={styles}
        onRetry={onRetry}
        reducedMotion
        showDebug={false}
      />,
    );

    expect(
      screen.getByText('Use *literal* text').parentElement?.getAttribute('data-markdown'),
    ).toBe('false');
    fireEvent.click(screen.getByRole('button'));
    expect(onRetry).toHaveBeenCalledWith('message-1');
    expect(screen.getByText(/Send failed/)).not.toBeNull();
  });

  it('shows the thinking indicator during assistant streaming, with reasoning left to its card', () => {
    render(
      <ChatMessageBubble
        isNewlyFailed={false}
        isUser={false}
        message={message({ isStreaming: true, message: '', reasoning: 'Checking context' })}
        styles={styles}
        reducedMotion={false}
        showDebug
      />,
    );

    expect(screen.queryByText('Checking context')).toBeNull();
    expect(screen.getByTestId('thinking-indicator')).not.toBeNull();
    expect(screen.queryByTestId('message-debug')).toBeNull();
  });

  it('drops the thinking indicator once text is streaming ', () => {
    render(
      <ChatMessageBubble
        isNewlyFailed={false}
        isUser={false}
        message={message({ isStreaming: true, message: 'Hello' })}
        styles={styles}
        reducedMotion={false}
        showDebug={false}
      />,
    );

    expect(screen.queryByTestId('thinking-indicator')).toBeNull();
  });

  it('drops the thinking indicator once live text lands in the streaming store', () => {
    streamed.text = 'Hel';
    try {
      render(
        <ChatMessageBubble
          isNewlyFailed={false}
          isUser={false}
          message={message({ isStreaming: true, message: '' })}
          styles={styles}
          reducedMotion={false}
          showDebug={false}
        />,
      );

      expect(screen.queryByTestId('thinking-indicator')).toBeNull();
    } finally {
      streamed.text = '';
    }
  });

  it('shows debug details after the assistant response finishes', () => {
    render(
      <ChatMessageBubble
        isNewlyFailed={false}
        isUser={false}
        message={message({ reasoning: 'A reason' })}
        styles={styles}
        reducedMotion={false}
        showDebug
      />,
    );

    expect(screen.getByTestId('message-debug').getAttribute('data-reasoning')).toBe('true');
  });
});
