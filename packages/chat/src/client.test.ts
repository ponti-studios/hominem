import { describe, expect, it } from 'vitest';

import { ChatClient } from './client';
import type { ChatClientStreamRequest, ChatClientTransportRequest } from './client-transport-fetch';

function streamResponse(event: unknown): Response {
  const body = `data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`;
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

// Test transports mock `request` with a Response (including a streamed
// ReadableStream body); this adapts that into the `stream` shape ChatClient
// actually calls for generation SSE, without duplicating each mock.
function streamFromRequest(
  request: (input: ChatClientTransportRequest) => Promise<Response>,
): (input: ChatClientStreamRequest) => Promise<{ ok: boolean; status: number }> {
  return async ({ onChunk, ...input }) => {
    const response = await request(input);
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      if (text) onChunk(text);
      return { ok: response.ok, status: response.status };
    }
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
    const tail = decoder.decode();
    if (tail) onChunk(tail);
    return { ok: response.ok, status: response.status };
  };
}

describe('ChatClient', () => {
  it('start() sends the caller-supplied generationId in the request body, not a fallback id', async () => {
    const sentBodies: unknown[] = [];
    const request = async ({ init }: ChatClientTransportRequest) => {
      sentBodies.push(JSON.parse(init.body as string));
      return streamResponse({
        version: 1,
        generationId: 'caller-supplied-id',
        sequence: 1,
        type: 'generation.committed',
        payload: {
          type: 'generation.committed',
          message: {
            id: 'message-1',
            chatId: 'chat-1',
            userId: 'user-1',
            role: 'assistant',
            content: 'done',
            files: null,
            toolCalls: null,
            reasoning: null,
            parentMessageId: null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
      });
    };
    const client = new ChatClient({
      baseUrl: 'https://chat.test',
      transport: { request, stream: streamFromRequest(request) },
      // A createId that would only be used if start() failed to forward the
      // caller's generationId — asserting against it, not this value, is
      // what would catch a regression back to the fallback id.
      createId: () => 'fallback-id-should-not-be-used',
    });

    const generation = client.start({
      generationId: 'caller-supplied-id',
      title: 'New chat',
      message: 'hello',
    });
    await generation.done;

    expect(sentBodies).toEqual([expect.objectContaining({ generationId: 'caller-supplied-id' })]);
    expect(generation.state.generationId).toBe('caller-supplied-id');
  });

  it('respondToToolCall() never sends a generationId in the body — the server derives the generation from messageId/toolCallId and rejects a client-supplied one', async () => {
    const sentBodies: unknown[] = [];
    const request = async ({ init }: ChatClientTransportRequest) => {
      sentBodies.push(JSON.parse(init.body as string));
      return streamResponse({
        version: 1,
        generationId: 'server-generation-id',
        sequence: 1,
        type: 'generation.committed',
        payload: {
          type: 'generation.committed',
          message: {
            id: 'message-1',
            chatId: 'chat-1',
            userId: 'user-1',
            role: 'assistant',
            content: 'done',
            files: null,
            toolCalls: null,
            reasoning: null,
            parentMessageId: null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
      });
    };
    const client = new ChatClient({
      baseUrl: 'https://chat.test',
      transport: { request, stream: streamFromRequest(request) },
    });

    const generation = client.respondToToolCall({
      chatId: 'chat-1',
      messageId: 'message-1',
      toolCallId: 'tool-call-1',
      body: { approved: true },
    });
    await generation.done;

    expect(sentBodies).toEqual([{ approved: true }]);
  });

  it('streams events, checkpoints each state, and removes terminal checkpoints', async () => {
    const checkpoints: string[] = [];
    const request = async () =>
      streamResponse({
        version: 1,
        generationId: 'generation-1',
        sequence: 1,
        type: 'generation.committed',
        payload: {
          type: 'generation.committed',
          message: {
            id: 'message-1',
            chatId: 'chat-1',
            userId: 'user-1',
            role: 'assistant',
            content: 'done',
            files: null,
            toolCalls: null,
            reasoning: null,
            parentMessageId: null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
      });
    const client = new ChatClient({
      baseUrl: 'https://chat.test',
      transport: { request, stream: streamFromRequest(request) },
      checkpointStore: {
        get: () => null,
        set: (state) => {
          checkpoints.push(`${state.generationId}:${state.lastDurableSequence}`);
        },
        remove: (generationId) => {
          checkpoints.push(`removed:${generationId}`);
        },
      },
      createId: () => 'generation-1',
    });

    const generation = client.createGeneration();
    await generation.start({
      path: '/api/chats/chat-1/stream',
      body: { chatId: 'chat-1', message: 'hello' },
      generationId: 'generation-1',
    });

    expect(generation.state).toMatchObject({ phase: 'committed', text: 'done' });
    expect(checkpoints).toEqual(['generation-1:1', 'removed:generation-1']);
  });

  it('keeps the checkpoint for a failed generation instead of removing it — consumers read it back after a reload to offer retry', async () => {
    const checkpoints: string[] = [];
    const request = async () =>
      streamResponse({
        version: 1,
        generationId: 'generation-1',
        sequence: 1,
        type: 'generation.failed',
        payload: { type: 'generation.failed', message: 'provider failure' },
      });
    const client = new ChatClient({
      baseUrl: 'https://chat.test',
      transport: { request, stream: streamFromRequest(request) },
      checkpointStore: {
        get: () => null,
        set: (state) => {
          checkpoints.push(`${state.generationId}:${state.phase}`);
        },
        remove: (generationId) => {
          checkpoints.push(`removed:${generationId}`);
        },
      },
      createId: () => 'generation-1',
    });

    const generation = client.createGeneration();
    await generation.start({
      path: '/api/chats/chat-1/stream',
      body: { chatId: 'chat-1', message: 'hello' },
      generationId: 'generation-1',
    });

    expect(generation.state.phase).toBe('failed');
    expect(checkpoints).toEqual(['generation-1:failed']);
  });

  it('replays from the durable checkpoint after a stream disconnects', async () => {
    let requests = 0;
    const phase = {
      version: 1,
      generationId: 'generation-2',
      sequence: 1,
      type: 'generation.phase_changed',
      payload: { type: 'generation.phase_changed', phase: 'running' },
    };
    const committed = {
      version: 1,
      generationId: 'generation-2',
      sequence: 2,
      type: 'generation.committed',
      payload: {
        type: 'generation.committed',
        message: {
          id: 'message-2',
          chatId: 'chat-1',
          userId: 'user-1',
          role: 'assistant',
          content: 'replayed',
          files: null,
          toolCalls: null,
          reasoning: null,
          parentMessageId: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      },
    };
    const request = async () => {
      requests += 1;
      if (requests === 1) {
        const encoder = new TextEncoder();
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(phase)}\n\n`));
              controller.error(new Error('disconnect'));
            },
          }),
        );
      }
      return streamResponse(committed);
    };
    const client = new ChatClient({
      baseUrl: 'https://chat.test',
      transport: { request, stream: streamFromRequest(request) },
      createId: () => 'generation-2',
    });

    const generation = client.createGeneration();
    await generation.start({
      path: '/api/chats/chat-1/stream',
      body: { chatId: 'chat-1', message: 'hello' },
      generationId: 'generation-2',
      replayPath: (generationId, afterSequence) =>
        `/api/chats/chat-1/generations/${generationId}/stream?afterSequence=${afterSequence}`,
    });

    expect(requests).toBe(2);
    expect(generation.state).toMatchObject({ phase: 'committed', text: 'replayed' });
  });
});
