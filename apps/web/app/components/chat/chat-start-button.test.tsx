// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => mockNavigate,
}));

const mockCreateChatMutate = vi.fn();
const createChatState = { isPending: false };

vi.mock('~/hooks/use-chats', () => ({
  useCreateChat: () => ({ mutate: mockCreateChatMutate, isPending: createChatState.isPending }),
}));

import { ChatStartButton } from './chat-start-button';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  createChatState.isPending = false;
});

describe('ChatStartButton', () => {
  it('starts a new chat and navigates on success', () => {
    render(<ChatStartButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Start a new chat' }));

    expect(mockCreateChatMutate).toHaveBeenCalledOnce();
    const [variables, options] = mockCreateChatMutate.mock.calls[0];
    expect(variables).toEqual({ title: 'New chat' });

    options.onSuccess({ id: 'chat-42' });
    expect(mockNavigate).toHaveBeenCalledWith('/chat/chat-42', { viewTransition: true });
  });

  it('disables the button and ignores clicks while a create is already pending', () => {
    createChatState.isPending = true;
    render(<ChatStartButton />);

    const button = screen.getByRole('button', { name: 'Start a new chat' });
    expect(button.hasAttribute('disabled')).toBe(true);

    fireEvent.click(button);
    expect(mockCreateChatMutate).not.toHaveBeenCalled();
  });

  it('respects an explicit disabled prop independent of pending state', () => {
    render(<ChatStartButton disabled />);

    expect(screen.getByRole('button', { name: 'Start a new chat' }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});
