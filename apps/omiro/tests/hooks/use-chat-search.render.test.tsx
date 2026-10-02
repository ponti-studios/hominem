// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { makeChatMessage } from '../fixtures';
import { renderHookWithQueryClient } from '../utils/render-hook';

const mockMessagesSearchGet = vi.fn();

vi.mock('@hominem/rpc/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hominem/rpc/react')>();
  return {
    ...actual,
    useApiClient: () => ({
      api: {
        chats: {
          ':id': {
            messages: {
              search: { $get: mockMessagesSearchGet },
            },
          },
        },
      },
    }),
  };
});

const { useChatSearch } = await import('~/hooks/use-chat-search');

const CHAT_ID = 'chat-1';

describe('useChatSearch', () => {
  it('shows the full message list while search is closed', () => {
    const messages = [makeChatMessage({ id: 'm1' }), makeChatMessage({ id: 'm2' })];
    const { result } = renderHookWithQueryClient(() => useChatSearch(messages, CHAT_ID));

    expect(result.current.showSearch).toBe(false);
    expect(result.current.displayMessages).toBe(messages);
    expect(mockMessagesSearchGet).not.toHaveBeenCalled();
  });

  it('does not query until a non-empty search query is set', async () => {
    const messages = [makeChatMessage({ id: 'm1' })];
    const { result } = renderHookWithQueryClient(() => useChatSearch(messages, CHAT_ID));

    act(() => {
      result.current.handleOpenSearch();
    });
    expect(result.current.showSearch).toBe(true);
    expect(mockMessagesSearchGet).not.toHaveBeenCalled();

    act(() => {
      result.current.handleSearchQueryChange('  ');
    });
    expect(mockMessagesSearchGet).not.toHaveBeenCalled();
    expect(result.current.displayMessages).toBe(messages);
  });

  it('queries and returns mapped search results once a query is set', async () => {
    mockMessagesSearchGet.mockResolvedValue({
      json: async () => [
        {
          id: 'm2',
          role: 'assistant',
          content: 'found it',
          createdAt: new Date().toISOString(),
          chatId: CHAT_ID,
        },
      ],
    });
    const messages = [makeChatMessage({ id: 'm1' })];
    const { result } = renderHookWithQueryClient(() => useChatSearch(messages, CHAT_ID));

    act(() => {
      result.current.handleOpenSearch();
      result.current.handleSearchQueryChange('found');
    });

    await waitFor(() => expect(mockMessagesSearchGet).toHaveBeenCalled());

    expect(mockMessagesSearchGet).toHaveBeenCalledWith({
      param: { id: CHAT_ID },
      query: { query: 'found' },
    });
    expect(result.current.displayMessages).toEqual([
      expect.objectContaining({ id: 'm2', message: 'found it' }),
    ]);
  });

  it('clears the query and closes search on close', () => {
    const messages = [makeChatMessage({ id: 'm1' })];
    const { result } = renderHookWithQueryClient(() => useChatSearch(messages, CHAT_ID));

    act(() => {
      result.current.handleOpenSearch();
      result.current.handleSearchQueryChange('design');
    });
    expect(result.current.searchQuery).toBe('design');

    act(() => {
      result.current.handleCloseSearch();
    });

    expect(result.current.showSearch).toBe(false);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.displayMessages).toBe(messages);
  });
});
