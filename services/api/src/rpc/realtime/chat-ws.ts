import type { IncomingMessage, Server as HttpServer } from 'node:http';

import { logger } from '@hominem/telemetry';
import { WebSocketServer, type WebSocket } from 'ws';

import { betterAuthServer } from '../../auth/better-auth';

interface ChatSendPayload {
  message: string;
  fileIds?: string[];
  noteIds?: string[];
}

type ChatRealtimeClientEvent =
  | {
      type: 'chat.send';
      requestId: string;
      payload: ChatSendPayload;
    }
  | {
      type: 'chat.cancel';
      requestId: string;
    }
  | {
      type: 'chat.ping';
      requestId: string;
    };

type ChatRealtimeServerEvent =
  | {
      type: 'chat.ack';
      requestId: string;
    }
  | {
      type: 'chat.status';
      requestId: string;
      status: 'submitted' | 'streaming' | 'done';
    }
  | {
      type: 'chat.chunk';
      requestId: string;
      chunk: string;
    }
  | {
      type: 'chat.final';
      requestId: string;
      assistantText: string;
    }
  | {
      type: 'chat.error';
      requestId: string;
      message: string;
      code?: string;
    };

interface ChatSocket extends WebSocket {
  __chatMeta?: {
    chatId: string;
    request: IncomingMessage;
    currentAbortController: AbortController | null;
  };
}

const CHAT_WS_PATH = /^\/api\/chats\/([^/]+)\/ws\/?$/;

function parseClientEvent(raw: string): ChatRealtimeClientEvent | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return null;
    }
    return parsed as ChatRealtimeClientEvent;
  } catch {
    return null;
  }
}

function writeUpgradeError(socket: import('node:net').Socket, statusCode: number, message: string) {
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function getHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value.join(',') : value;
}

function toRequestHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }

    headers.set(key, value);
  }

  return headers;
}

function getRequestOrigin(req: IncomingMessage): string {
  const forwardedProto = getHeaderValue(req.headers['x-forwarded-proto']);
  const protocol = forwardedProto === 'https' ? 'https' : 'http';
  const host = getHeaderValue(req.headers.host) ?? 'localhost:4040';
  return `${protocol}://${host}`;
}

async function isAuthenticatedRequest(req: IncomingMessage): Promise<boolean> {
  const session = await betterAuthServer.api.getSession({ headers: toRequestHeaders(req) });
  return Boolean(session?.user?.id && session.session?.id);
}

function sendEvent(ws: WebSocket, event: ChatRealtimeServerEvent) {
  ws.send(JSON.stringify(event));
}

async function streamChatOverHttp(input: {
  req: IncomingMessage;
  chatId: string;
  payload: ChatSendPayload;
  requestId: string;
  onChunk: (chunk: string) => void;
  signal: AbortSignal;
}) {
  const { req, chatId, payload, requestId, onChunk, signal } = input;
  const origin = getRequestOrigin(req);
  const url = new URL(`/api/chats/${chatId}/stream`, origin).toString();

  const headers = new Headers();
  headers.set('content-type', 'application/json');

  const cookieHeader = getHeaderValue(req.headers.cookie);
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }

  const authorization = getHeaderValue(req.headers.authorization);
  if (authorization) {
    headers.set('authorization', authorization);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      errorText.length > 0
        ? errorText
        : `HTTP ${response.status} while streaming chat for request ${requestId}`,
    );
  }

  const body = response.body;
  if (!body) {
    throw new Error('No stream body received from chat stream endpoint');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    if (chunk.length > 0) {
      onChunk(chunk);
    }
  }

  const finalChunk = decoder.decode();
  if (finalChunk.length > 0) {
    onChunk(finalChunk);
  }
}

function handleSocketConnection(ws: ChatSocket) {
  ws.on('message', async (raw) => {
    const event = parseClientEvent(raw.toString());
    if (!event || !ws.__chatMeta) {
      return;
    }

    const { chatId, request } = ws.__chatMeta;

    switch (event.type) {
      case 'chat.ping': {
        sendEvent(ws, { type: 'chat.ack', requestId: event.requestId });
        return;
      }
      case 'chat.cancel': {
        ws.__chatMeta.currentAbortController?.abort();
        ws.__chatMeta.currentAbortController = null;
        sendEvent(ws, { type: 'chat.status', requestId: event.requestId, status: 'done' });
        return;
      }
      case 'chat.send': {
        ws.__chatMeta.currentAbortController?.abort();

        const abortController = new AbortController();
        ws.__chatMeta.currentAbortController = abortController;

        sendEvent(ws, { type: 'chat.ack', requestId: event.requestId });
        sendEvent(ws, { type: 'chat.status', requestId: event.requestId, status: 'submitted' });

        let assistantText = '';

        try {
          await streamChatOverHttp({
            req: request,
            chatId,
            payload: event.payload,
            requestId: event.requestId,
            signal: abortController.signal,
            onChunk: (chunk) => {
              assistantText += chunk;
              sendEvent(ws, {
                type: 'chat.status',
                requestId: event.requestId,
                status: 'streaming',
              });
              sendEvent(ws, {
                type: 'chat.chunk',
                requestId: event.requestId,
                chunk,
              });
            },
          });

          if (abortController.signal.aborted) {
            return;
          }

          sendEvent(ws, {
            type: 'chat.final',
            requestId: event.requestId,
            assistantText,
          });
          sendEvent(ws, {
            type: 'chat.status',
            requestId: event.requestId,
            status: 'done',
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendEvent(ws, {
            type: 'chat.error',
            requestId: event.requestId,
            message,
          });
        } finally {
          if (ws.__chatMeta?.currentAbortController === abortController) {
            ws.__chatMeta.currentAbortController = null;
          }
        }
        return;
      }
    }
  });

  ws.on('close', () => {
    ws.__chatMeta?.currentAbortController?.abort();
    ws.__chatMeta = undefined;
  });
}

export function attachChatRealtimeWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    handleSocketConnection(ws as ChatSocket);
  });

  const handleUpgrade = (req: IncomingMessage, socket: import('node:net').Socket, head: Buffer) => {
    const host = getHeaderValue(req.headers.host) ?? 'localhost:4040';
    const requestUrl = new URL(req.url ?? '/', `http://${host}`);
    const match = requestUrl.pathname.match(CHAT_WS_PATH);

    if (!match) {
      return;
    }

    const chatId = match[1];

    void (async () => {
      const authed = await isAuthenticatedRequest(req).catch((error) => {
        logger.error('[chat-ws] auth check failed', { error });
        return false;
      });

      if (!authed) {
        writeUpgradeError(socket, 401, 'Unauthorized');
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        const chatSocket = ws as ChatSocket;
        chatSocket.__chatMeta = {
          chatId,
          request: req,
          currentAbortController: null,
        };
        wss.emit('connection', ws, req);
      });
    })();
  };

  server.on('upgrade', handleUpgrade);

  return () => {
    server.off('upgrade', handleUpgrade);
    wss.close();
  };
}
