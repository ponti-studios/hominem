import { describe, expect, it, vi } from 'vitest';

import {
  appendStreamingMessageText,
  clearStreamingMessageText,
  getStreamingMessageText,
  subscribeToStreamingMessageText,
} from './streaming-text-store';

describe('streaming text store', () => {
  it('accumulates text per message id', () => {
    appendStreamingMessageText('streaming-a', 'Hello');
    appendStreamingMessageText('streaming-a', ' there');
    appendStreamingMessageText('streaming-b', 'Other');

    expect(getStreamingMessageText('streaming-a')).toBe('Hello there');
    expect(getStreamingMessageText('streaming-b')).toBe('Other');

    clearStreamingMessageText('streaming-a');
    clearStreamingMessageText('streaming-b');
  });

  it('only wakes subscribers of the id that changed', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeToStreamingMessageText('streaming-a', a);
    const offB = subscribeToStreamingMessageText('streaming-b', b);

    appendStreamingMessageText('streaming-a', 'word ');

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();

    offA();
    appendStreamingMessageText('streaming-a', 'more');
    expect(a).toHaveBeenCalledTimes(1);

    offB();
    clearStreamingMessageText('streaming-a');
  });

  it('clears text and notifies, and ignores ids it never saw', () => {
    const listener = vi.fn();
    appendStreamingMessageText('streaming-c', 'bye');
    const off = subscribeToStreamingMessageText('streaming-c', listener);

    clearStreamingMessageText('streaming-c');
    expect(getStreamingMessageText('streaming-c')).toBe('');
    expect(listener).toHaveBeenCalledTimes(1);

    clearStreamingMessageText('streaming-c');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });
});
