import type { ChatMessageItem } from '@hominem/chat';
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/components/theme', () => ({
  useAppTheme: () => ({
    colors: { eventForeground: 'fg', eventSun: 'sun', neutralTile: 'tile' },
  }),
}));
vi.mock('~/components/chat/chat-card.styles', () => ({
  useToolCardStyles: () => ({}),
}));
vi.mock('~/components/ui/icon', () => ({
  default: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));
vi.mock('~/components/chat/chat-thinking-indicator', () => ({
  ShimmerText: ({ label }: { label: string }) => <span data-testid="shimmer">{label}</span>,
}));
vi.mock('~/components/chat/chat-reasoning-sheet', () => ({
  ChatReasoningSheet: ({ reasoning, onClose }: { reasoning: string; onClose: () => void }) => (
    <div data-testid="reasoning-sheet">
      <span>{`sheet:${reasoning}`}</span>
      <button onClick={onClose} type="button">
        close
      </button>
    </div>
  ),
}));

const { MessageReasoning } = await import('~/components/chat/chat-message-reasoning');

function message(overrides: Partial<ChatMessageItem> = {}): ChatMessageItem {
  return {
    id: 'm1',
    renderKey: 'm1',
    role: 'assistant',
    message: 'Hello',
    createdAt: new Date().toISOString(),
    chatId: 'c1',
    reasoning: 'Checking context',
    toolCalls: null,
    isStreaming: false,
    ...overrides,
  };
}

describe('MessageReasoning', () => {
  it('renders nothing without reasoning or for user messages', () => {
    const { container, rerender } = render(
      <MessageReasoning message={message({ reasoning: ' ' })} />,
    );
    expect(container.innerHTML).toBe('');
    rerender(<MessageReasoning message={message({ role: 'user' })} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows a shimmering title while streaming', () => {
    render(<MessageReasoning message={message({ isStreaming: true })} />);
    expect(screen.getByTestId('shimmer')).not.toBeNull();
  });

  it('opens the full reasoning in the sheet on tap and closes it again', () => {
    render(<MessageReasoning message={message()} />);
    expect(screen.queryByTestId('reasoning-sheet')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show reasoning' }));
    expect(screen.getByText('sheet:Checking context')).not.toBeNull();

    fireEvent.click(screen.getByText('close'));
    expect(screen.queryByTestId('reasoning-sheet')).toBeNull();
  });
});
