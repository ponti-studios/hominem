// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockMmkvModule } from '../mocks/mmkv';

vi.mock('~/services/storage/mmkv', () => mockMmkvModule());

const { useChatResponseLength, getChatResponseLength, setChatResponseLength } =
  await import('~/hooks/use-chat-response-length');
const { storage } = await import('~/services/storage/mmkv');

describe('useChatResponseLength', () => {
  afterEach(() => {
    setChatResponseLength('standard');
  });

  it('defaults to standard when nothing is stored', () => {
    expect(getChatResponseLength()).toBe('standard');
    const { result } = renderHook(() => useChatResponseLength());
    expect(result.current).toBe('standard');
  });

  it('reflects a stored value', () => {
    setChatResponseLength('deep');
    const { result } = renderHook(() => useChatResponseLength());
    expect(result.current).toBe('deep');
  });

  it('maps a value saved by an older build onto the current level', () => {
    storage.set('chat_response_length', 'short');
    expect(getChatResponseLength()).toBe('brief');
    storage.set('chat_response_length', 'medium');
    expect(getChatResponseLength()).toBe('standard');
    storage.set('chat_response_length', 'long');
    expect(getChatResponseLength()).toBe('deep');
  });

  it('ignores an invalid stored value and falls back to the default', () => {
    storage.set('chat_response_length', 'extra-long');
    expect(getChatResponseLength()).toBe('standard');
  });

  it('reflects an external value change once the component re-renders', () => {
    const { result, rerender } = renderHook(() => useChatResponseLength());
    expect(result.current).toBe('standard');

    act(() => {
      setChatResponseLength('brief');
    });
    rerender();

    expect(result.current).toBe('brief');
  });
});
