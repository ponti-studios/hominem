import type {
  ChatTransportPreference,
  ChatRealtimeClientEvent,
  ChatRealtimeSendPayload,
  ChatRealtimeServerEvent,
} from '../types/realtime.types';

export interface ChatWsFirstOptions {
  wsUrl: string;
  payload: ChatRealtimeSendPayload;
  fallback: () => Promise<{ assistantText: string }>;
  onChunk?: (chunk: string) => void;
  onStatus?: (status: 'submitted' | 'streaming' | 'done') => void;
  signal?: AbortSignal;
  webSocketFactory?: (url: string) => WebSocket;
  connectTimeoutMs?: number;
  transportPreference?: ChatTransportPreference;
}

export interface ChatWsFirstResult {
  assistantText: string;
  transport: 'ws' | 'http-fallback';
}

function createRequestId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `req_${Math.random().toString(36).slice(2)}`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return String(error);
}

function parseServerEvent(data: string): ChatRealtimeServerEvent | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return null;
    }

    return parsed as ChatRealtimeServerEvent;
  } catch {
    return null;
  }
}

export function toWebSocketUrl(baseUrl: string, path: string): string {
  const url = new URL(path, baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export async function streamChatWithWsFirst(options: ChatWsFirstOptions): Promise<ChatWsFirstResult> {
  const {
    wsUrl,
    payload,
    fallback,
    onChunk,
    onStatus,
    signal,
    connectTimeoutMs = 3500,
    webSocketFactory,
    transportPreference = 'auto',
  } = options;

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (transportPreference === 'http-stream') {
    const fallbackResult = await fallback();
    return { assistantText: fallbackResult.assistantText, transport: 'http-fallback' };
  }

  if (typeof globalThis.WebSocket !== 'function' && !webSocketFactory) {
    const fallbackResult = await fallback();
    return { assistantText: fallbackResult.assistantText, transport: 'http-fallback' };
  }

  const requestId = createRequestId();

  try {
    const wsResult = await new Promise<ChatWsFirstResult>((resolve, reject) => {
      let settled = false;
      let assistantText = '';

      const ws = webSocketFactory ? webSocketFactory(wsUrl) : new WebSocket(wsUrl);

      const closeWithError = (message: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(message));
      };

      const finish = (result: ChatWsFirstResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const onAbort = () => {
        if (settled) return;
        try {
          const cancelMessage: ChatRealtimeClientEvent = { type: 'chat.cancel', requestId };
          ws.send(JSON.stringify(cancelMessage));
        } catch {
          // Ignore close-time send errors.
        }
        ws.close();
        closeWithError('Aborted');
      };

      const timeout = setTimeout(() => {
        ws.close();
        closeWithError('WebSocket connection timed out');
      }, connectTimeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      ws.onopen = () => {
        onStatus?.('submitted');
        const event: ChatRealtimeClientEvent = {
          type: 'chat.send',
          requestId,
          payload,
        };
        ws.send(JSON.stringify(event));
      };

      ws.onmessage = (messageEvent) => {
        const parsed = parseServerEvent(String(messageEvent.data));
        if (!parsed) {
          return;
        }

        if (parsed.requestId !== requestId) {
          return;
        }

        switch (parsed.type) {
          case 'chat.status': {
            onStatus?.(parsed.status);
            return;
          }
          case 'chat.chunk': {
            assistantText += parsed.chunk;
            onChunk?.(parsed.chunk);
            onStatus?.('streaming');
            return;
          }
          case 'chat.final': {
            ws.close();
            onStatus?.('done');
            finish({ assistantText: parsed.assistantText, transport: 'ws' });
            return;
          }
          case 'chat.error': {
            ws.close();
            closeWithError(parsed.message);
            return;
          }
          case 'chat.ack': {
            return;
          }
        }
      };

      ws.onerror = () => {
        ws.close();
        closeWithError('WebSocket transport failed');
      };

      ws.onclose = () => {
        if (settled) return;
        closeWithError('WebSocket connection closed unexpectedly');
      };
    });

    return wsResult;
  } catch (wsError) {
    if (signal?.aborted) {
      throw wsError;
    }

    const fallbackResult = await fallback().catch((fallbackError) => {
      const wsMessage = toErrorMessage(wsError);
      const fallbackMessage = toErrorMessage(fallbackError);
      throw new Error(`WS and fallback failed: ${wsMessage}; fallback: ${fallbackMessage}`);
    });

    return {
      assistantText: fallbackResult.assistantText,
      transport: 'http-fallback',
    };
  }
}
