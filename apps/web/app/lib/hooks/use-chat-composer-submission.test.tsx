// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useChatComposerSubmission } from './use-chat-composer-submission';

function makeOptions(overrides: Record<string, unknown> = {}) {
  const display = {
    setOptimisticUserMessage: vi.fn(),
    setPendingAssistantMessage: vi.fn(),
  };
  const composer = {
    attachedFiles: [],
    clear: vi.fn(),
    draftWithSeed: '',
    selectedNotesForSend: [],
    setDraft: vi.fn(),
    restore: vi.fn(),
    uploadState: { isUploading: false },
  };
  const streamMessage = {
    isStreaming: false,
    retry: vi.fn(),
    status: 'idle',
    stream: vi.fn(),
  };
  return {
    chatId: 'chat-1',
    composer,
    display,
    isOnline: true,
    onRequestAutoSpeak: vi.fn(),
    responseLength: 'medium' as const,
    speech: { isListening: false, stop: vi.fn() },
    streamMessage,
    updateChatTitle: { mutate: vi.fn() },
    walkieTalkieMode: false,
    ...overrides,
  } as unknown as Parameters<typeof useChatComposerSubmission>[0];
}

describe('useChatComposerSubmission', () => {
  it('does not submit an empty composer', () => {
    const options = makeOptions();
    const { result } = renderHook(() => useChatComposerSubmission(options));

    void result.current.submit();

    expect(options.streamMessage.stream).not.toHaveBeenCalled();
  });

  it('exposes generation retry as a separate action', () => {
    const options = makeOptions({
      streamMessage: {
        isStreaming: false,
        retry: vi.fn(),
        status: 'failed',
        stream: vi.fn(),
      },
    });
    const { result } = renderHook(() => useChatComposerSubmission(options));

    expect(result.current.isRetryable).toBe(true);
    result.current.retryGeneration();

    expect(options.streamMessage.retry).toHaveBeenCalledWith(
      expect.objectContaining({ responseLength: 'medium' }),
    );
  });
});
