import type { ChatClientTransport } from './client-transport-fetch';
import type { GenerationClientInputEvent, GenerationClientState } from './generation-client';
import { createGenerationClientState, reduceGenerationClientEvent } from './generation-client';
import type { GenerationEvent } from './generation-machine';
import { createGenerationEventDeduplicator } from './generation-schemas';
import { GENERATION_TIMING } from './generation-timing';
import { createSseDecoder, finishSse, pushSseChunk } from './sse';

export {
  createGenerationClientState,
  parseGenerationClientCheckpoint,
  reduceGenerationClientEvent,
  toGenerationClientCheckpoint,
} from './generation-client';
export type {
  GenerationClientErrorEvent,
  GenerationClientInputEvent,
  GenerationClientState,
  GenerationClientToolStep,
} from './generation-client';

export type ChatCheckpointStore = {
  get: (
    generationId: string,
  ) => Promise<GenerationClientState | null> | GenerationClientState | null;
  set: (state: GenerationClientState) => Promise<void> | void;
  remove?: (generationId: string) => Promise<void> | void;
};

export type ChatClientOptions = {
  baseUrl: string;
  transport: ChatClientTransport;
  headers?: () => RequestInit['headers'] | Promise<RequestInit['headers']>;
  checkpointStore?: ChatCheckpointStore;
  createId?: () => string;
};

export type ChatGenerationController = {
  readonly state: GenerationClientState;
  readonly signal: AbortSignal;
  readonly done: Promise<GenerationClientState>;
  subscribe: (
    listener: (state: GenerationClientState, event: GenerationClientInputEvent) => void,
  ) => () => void;
  start: (input: {
    path: string;
    body: unknown;
    generationId?: string;
    replayPath?: (generationId: string, afterSequence: number) => string;
  }) => Promise<GenerationClientState>;
  resume: (input: { path: string; generationId: string }) => Promise<GenerationClientState>;
  cancel: () => void;
};

export type ChatMessageInput = {
  chatId: string;
  generationId?: string;
  message: string;
  fileIds?: readonly string[];
  responseLength?: 'short' | 'medium' | 'long';
  responseModality?: 'text' | 'audio';
};

export class SseIdleTimeoutError extends Error {
  constructor(readonly idleMs: number) {
    super(`No SSE data received for ${idleMs}ms`);
    this.name = 'SseIdleTimeoutError';
  }
}

type ChatHttpError = Error & { status: number };

function isChatHttpError(error: unknown): error is ChatHttpError {
  return error instanceof Error && 'status' in error && typeof error.status === 'number';
}

function isAbortError(error: unknown): boolean {
  return isObject(error) && 'name' in error && error.name === 'AbortError';
}

function chatRequestError(status: number): ChatHttpError {
  return Object.assign(new Error(`Chat request failed: HTTP ${status}`), { status });
}

function combineSignals(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

function defaultId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export class ChatClient {
  constructor(private readonly options: ChatClientOptions) {}

  send(input: ChatMessageInput): ChatGenerationController {
    return this.createGenerationWith({
      generationId: input.generationId,
      path: `/api/chats/${input.chatId}/stream`,
      body: input,
      replayPath: (generationId, afterSequence) =>
        `/api/chats/${input.chatId}/generations/${generationId}/stream?afterSequence=${afterSequence}`,
    });
  }

  start(input: {
    generationId?: string;
    title: string;
    message: string;
    fileIds?: readonly string[];
    responseLength?: 'short' | 'medium' | 'long';
  }): ChatGenerationController {
    return this.createGenerationWith({
      generationId: input.generationId,
      path: '/api/chats/start-stream',
      body: input,
    });
  }

  // Redoes the most recent attempt at a turn — whether it produced a reply
  // worth replacing (target.messageId) or failed before producing one
  // (target.generationId). Both are the same operation server-side.
  regenerate(input: {
    chatId: string;
    target: { messageId: string } | { generationId: string };
    body: Record<string, unknown>;
  }): ChatGenerationController {
    const path =
      'messageId' in input.target
        ? `/api/chats/${input.chatId}/messages/${input.target.messageId}/regenerate`
        : `/api/chats/${input.chatId}/generations/${input.target.generationId}/regenerate`;
    return this.createGenerationWith({
      generationId:
        typeof input.body.generationId === 'string' ? input.body.generationId : undefined,
      path,
      body: input.body,
      replayPath: (generationId, afterSequence) =>
        `/api/chats/${input.chatId}/generations/${generationId}/stream?afterSequence=${afterSequence}`,
    });
  }

  respondToToolCall(input: {
    chatId: string;
    messageId: string;
    toolCallId: string;
    body: Record<string, unknown>;
  }): ChatGenerationController {
    return this.createGenerationWith({
      generationId:
        typeof input.body.generationId === 'string' ? input.body.generationId : undefined,
      path: `/api/chats/${input.chatId}/messages/${input.messageId}/tool-calls/${input.toolCallId}/respond`,
      body: input.body,
      replayPath: (generationId, afterSequence) =>
        `/api/chats/${input.chatId}/generations/${generationId}/stream?afterSequence=${afterSequence}`,
    });
  }

  resumeGeneration(input: { chatId: string; generationId: string }): ChatGenerationController {
    const generation = this.createGeneration(input.generationId);
    void generation
      .resume({
        path: `/api/chats/${input.chatId}/generations/${input.generationId}/stream`,
        generationId: input.generationId,
      })
      .catch(() => undefined);
    return generation;
  }

  async cancel(input: { chatId: string; generationId: string }): Promise<Response> {
    const headers = new Headers(await this.options.headers?.());
    return this.options.transport.request({
      url: `${this.options.baseUrl}/api/chats/${input.chatId}/generations/${input.generationId}/cancel`,
      init: { method: 'POST', headers },
    });
  }

  async getGeneration(input: { chatId: string; generationId: string }): Promise<unknown> {
    const headers = new Headers(await this.options.headers?.());
    const response = await this.options.transport.request({
      url: `${this.options.baseUrl}/api/chats/${input.chatId}/generations/${input.generationId}`,
      init: { method: 'GET', headers },
    });
    if (!response.ok) throw chatRequestError(response.status);
    return response.json();
  }

  private createGenerationWith(input: {
    generationId?: string;
    path: string;
    body: unknown;
    replayPath?: (generationId: string, afterSequence: number) => string;
  }): ChatGenerationController {
    const generation = this.createGeneration(input.generationId);
    queueMicrotask(() => {
      void generation.start(input).catch(() => undefined);
    });
    return generation;
  }

  createGeneration(generationId?: string): ChatGenerationController {
    let current = createGenerationClientState(
      generationId ?? this.options.createId?.() ?? defaultId(),
    );
    const controller = new AbortController();
    const listeners = new Set<
      (state: GenerationClientState, event: GenerationClientInputEvent) => void
    >();

    const consume = async (
      path: string,
      body?: unknown,
      replayPath?: (generationId: string, afterSequence: number) => string,
      reconnect = true,
    ): Promise<GenerationClientState> => {
      const idleMs = GENERATION_TIMING.clientIdleMs;
      const idleController = new AbortController();
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const armIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => idleController.abort(), idleMs);
      };
      try {
        const headers = new Headers(await this.options.headers?.());
        headers.set('Accept', 'text/event-stream');
        if (body !== undefined) headers.set('Content-Type', 'application/json');

        const deduplicate = createGenerationEventDeduplicator();
        let checkpointWrite = Promise.resolve();
        let sseState = createSseDecoder();
        const process = (outputs: ReturnType<typeof pushSseChunk<GenerationEvent>>['outputs']) => {
          for (const output of outputs) {
            if (output.kind !== 'event') continue;
            const event = deduplicate(output.event);
            if (!event) continue;
            current = reduceGenerationClientEvent(current, event);
            for (const listener of listeners) listener(current, event);
            const snapshot = current;
            checkpointWrite = checkpointWrite.then(() =>
              this.options.checkpointStore?.set(snapshot),
            );
          }
        };

        armIdleTimer();
        const idleTimeout = new Promise<never>((_, reject) => {
          idleController.signal.addEventListener(
            'abort',
            () => reject(new SseIdleTimeoutError(idleMs)),
            { once: true },
          );
        });
        const streaming = this.options.transport
          .stream({
            url: `${this.options.baseUrl}${path}`,
            init: {
              method: body === undefined ? 'GET' : 'POST',
              headers,
              body: body === undefined ? undefined : JSON.stringify(body),
            },
            signal: combineSignals([controller.signal, idleController.signal]),
            onChunk: (chunk) => {
              armIdleTimer();
              const result = pushSseChunk<GenerationEvent>(sseState, chunk, (data) =>
                JSON.parse(data),
              );
              sseState = result.state;
              process(result.outputs);
            },
          })
          .catch((error: unknown) => {
            // The idle timer's own abort races ahead of whatever rejection
            // the transport produces from being cancelled — that rejection
            // is expected and not the real failure, so swallow it here.
            if (idleController.signal.aborted) return undefined;
            throw error;
          });

        const result = await Promise.race([streaming, idleTimeout]);
        clearTimeout(idleTimer);
        if (result && !result.ok) throw chatRequestError(result.status);

        process(finishSse<GenerationEvent>(sseState, (data) => JSON.parse(data)).outputs);

        await checkpointWrite;
        if (
          current.phase === 'committed' ||
          current.phase === 'cancelled' ||
          current.phase === 'failed'
        ) {
          await this.options.checkpointStore?.remove?.(current.generationId);
        }
        return current;
      } catch (error) {
        clearTimeout(idleTimer);
        if (
          reconnect &&
          replayPath &&
          !controller.signal.aborted &&
          !isAbortError(error) &&
          !isChatHttpError(error)
        ) {
          return consume(
            replayPath(current.generationId, current.lastDurableSequence),
            undefined,
            undefined,
            false,
          );
        }
        if (!isAbortError(error)) {
          const event: GenerationClientInputEvent = {
            version: 1,
            generationId: current.generationId,
            event: {
              type: 'error',
              message: error instanceof Error ? error.message : String(error),
            },
          };
          current = reduceGenerationClientEvent(current, event);
          for (const listener of listeners) listener(current, event);
          await this.options.checkpointStore?.set(current);
        }
        throw error;
      }
    };

    let resolveDone!: (state: GenerationClientState) => void;
    let rejectDone!: (error: unknown) => void;
    const done = new Promise<GenerationClientState>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    void done.catch(() => undefined);

    const start = ({
      path,
      body,
      generationId,
      replayPath,
    }: {
      path: string;
      body: unknown;
      generationId?: string;
      replayPath?: (generationId: string, afterSequence: number) => string;
    }) => {
      const result = (async () => {
        const id = generationId ?? current.generationId;
        current = createGenerationClientState(id);
        return consume(path, { ...(body as object), generationId: id }, replayPath);
      })();
      result.then(resolveDone, rejectDone);
      return result;
    };

    const resume = ({ path, generationId }: { path: string; generationId: string }) => {
      const result = (async () => {
        const checkpoint = await this.options.checkpointStore?.get(generationId);
        if (checkpoint) {
          current = { ...createGenerationClientState(generationId), ...checkpoint };
        }
        return consume(`${path}?afterSequence=${current.lastDurableSequence}`, undefined);
      })();
      result.then(resolveDone, rejectDone);
      return result;
    };

    return {
      get state() {
        return current;
      },
      signal: controller.signal,
      done,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      start,
      resume,
      cancel: () => controller.abort(),
    };
  }
}
import { isObject } from '@hominem/utils';
