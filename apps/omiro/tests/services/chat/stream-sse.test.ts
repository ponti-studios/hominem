import { afterEach, describe, expect, it, vi } from 'vitest';

import { streamSSE } from '~/services/chat/stream-sse';

class FakeXMLHttpRequest {
  static current: FakeXMLHttpRequest | null = null;

  onerror: (() => void) | null = null;
  onreadystatechange: (() => void) | null = null;
  readyState = 0;
  responseText = '';
  status = 200;
  headers: Record<string, string> = {};

  constructor() {
    FakeXMLHttpRequest.current = this;
  }

  abort() {}

  open() {}

  send() {}

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  push(text: string) {
    this.responseText += text;
    this.readyState = 3;
    this.onreadystatechange?.();
  }

  finish(status = 200, text = '') {
    this.status = status;
    this.responseText += text;
    this.readyState = 4;
    this.onreadystatechange?.();
  }
}

async function startStream(onChunk = vi.fn()) {
  const promise = streamSSE({
    url: 'https://example.test/stream',
    payload: { message: 'hello' },
    getHeaders: async () => ({ authorization: 'Bearer token' }),
    onChunk,
  });
  await Promise.resolve();
  const xhr = FakeXMLHttpRequest.current;
  if (!xhr) throw new Error('Expected stream to create an XHR instance');
  return { onChunk, promise, xhr };
}

describe('streamSSE', () => {
  const originalXMLHttpRequest = globalThis.XMLHttpRequest;

  afterEach(() => {
    FakeXMLHttpRequest.current = null;
    globalThis.XMLHttpRequest = originalXMLHttpRequest;
  });

  it('parses complete SSE chunks', async () => {
    globalThis.XMLHttpRequest = FakeXMLHttpRequest as never;
    const { onChunk, promise, xhr } = await startStream();

    xhr.finish(200, 'data: {"chunk":"hello"}\n\ndata: [DONE]\n\n');
    await promise;

    expect(onChunk).toHaveBeenCalledWith('hello');
  });

  it('preserves split SSE frames until they are complete', async () => {
    globalThis.XMLHttpRequest = FakeXMLHttpRequest as never;
    const { onChunk, promise, xhr } = await startStream();

    xhr.push('data: {"chu');
    xhr.push('nk":"hel');
    xhr.push('lo"}\n\n');
    xhr.finish(200, 'data: [DONE]\n\n');
    await promise;

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith('hello');
  });

  it('rejects when the server sends an error frame', async () => {
    globalThis.XMLHttpRequest = FakeXMLHttpRequest as never;
    const { promise, xhr } = await startStream();

    xhr.finish(200, 'data: {"error":"stream failed"}\n\n');

    await expect(promise).rejects.toThrow('stream failed');
  });

  it('rejects failed HTTP responses', async () => {
    globalThis.XMLHttpRequest = FakeXMLHttpRequest as never;
    const { promise, xhr } = await startStream();

    xhr.finish(500);

    await expect(promise).rejects.toThrow('SSE stream failed: HTTP 500');
  });
});
