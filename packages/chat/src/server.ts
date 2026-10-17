import { isObject } from '@hominem/utils';

import type { GenerationStartContext } from './generation-events';
import type { GenerationAdapters } from './generation-interpreter';
import { generate as runGeneration } from './generation-interpreter';
import type {
  GenerationCommand,
  GenerationDeltaEventPayload,
  GenerationEvent,
  GenerationHistoryEventPayload,
  GenerationInput,
  GenerationState,
  GenerationToolCall,
  ToolResult,
} from './generation-machine';
import type { ChatMessageSnapshot } from './generation-schemas';
import { GENERATION_TIMING } from './generation-timing';

// Recovery helpers remain server-private to consumers; applications should
// not construct or reduce generation state directly.
export {
  createGenerationState,
  MAX_TOOL_CALLS_PER_GENERATION,
  restoreGenerationState,
  TOOL_CALL_LIMIT_REACHED_MESSAGE,
} from './generation-machine';
export { reconstructProviderToolCalls } from './generation-machine/provider';
export type ChatModel = GenerationAdapters['provider'];

export type ChatServerModelInput = {
  model: string;
  messages: readonly unknown[];
  tools: readonly unknown[];
  maxTokens?: number;
  reasoning?: unknown;
  requiresToolCall?: boolean;
  requiresWebSearch?: boolean;
  requiresConfirmation?: (toolName: string) => boolean;
  onUsage?: (usage: unknown) => void;
};

export class ChatHttpClientError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly clientMessage: string;

  constructor(input: { code: string; message: string; statusCode?: number }) {
    super(input.message);
    this.name = 'ChatHttpClientError';
    this.code = input.code;
    this.clientMessage = input.message;
    this.statusCode = input.statusCode ?? 400;
  }
}

export type ChatServerToolContext = {
  userId: string;
  generationId: string;
  chatId: string;
  idempotencyKey: string;
};

export type ChatServerToolRegistry = {
  getDefinition: (toolName: string) =>
    | {
        requiresConfirmation?: boolean;
        preview?: (call: GenerationToolCall, context: ChatServerToolContext) => Promise<ToolResult>;
      }
    | undefined;
  execute: (input: {
    call: GenerationToolCall;
    arguments: Record<string, unknown>;
    context: ChatServerToolContext;
  }) => Promise<ToolResult>;
};

export type ChatServerPersistedEvent = {
  generationId: string;
  sequence: number;
  type: string;
  payload: unknown;
  idempotencyKey: string | null;
};

export type ChatServerStore<TEvent extends ChatServerPersistedEvent = ChatServerPersistedEvent> = {
  getEffect?: (input: {
    generationId: string;
    idempotencyKey: string;
    toolName: string;
  }) => Promise<ToolResult | null>;
  saveEffect?: (input: {
    generationId: string;
    idempotencyKey: string;
    toolName: string;
    result: ToolResult;
  }) => Promise<ToolResult>;
  appendEvent: (input: {
    event: GenerationHistoryEventPayload;
    idempotencyKey: string;
  }) => Promise<TEvent | null>;
  saveGeneration: (input: {
    state: GenerationState;
    generationId: string;
    chatId: string;
    userId: string;
    targetAssistantMessageId?: string | null;
  }) => Promise<ChatMessageSnapshot>;
  stopGeneration: (state: GenerationState) => Promise<void>;
};

export type GenerationRunnerOptions<
  TEvent extends ChatServerPersistedEvent = ChatServerPersistedEvent,
> = {
  provider?: (input: ChatServerModelInput) => ChatModel;
  tools?: ChatServerToolRegistry;
  store?: ChatServerStore<TEvent>;
  publisher?: { accept: (event: TEvent) => Promise<void> | void };
  emit?: (event: GenerationDeltaEventPayload) => Promise<void> | void;
  isCancelled?: (input: {
    generationId: string;
    chatId: string;
    userId: string;
  }) => boolean | Promise<boolean>;
  effectTimeoutsMs?: Partial<Record<GenerationCommand['type'], number>>;
};

export type ChatServerGenerationInput = {
  generationId: string;
  chatId: string;
  userId: string;
  model: ChatServerModelInput;
  startContext: GenerationStartContext;
  initialInput?: GenerationInput;
  initialState?: GenerationState;
  targetAssistantMessageId?: string | null;
};

export type ChatServerGenerationResult = {
  state: GenerationState;
  toolResults: Map<string, ToolResult>;
  pendingPreview: ToolResult | null;
};

function parseArguments(call: GenerationToolCall): Record<string, unknown> {
  if (!call.arguments) return {};
  try {
    const value: unknown = JSON.parse(call.arguments);
    if (!isObject(value)) return {};
    return Object.fromEntries(Object.entries(value));
  } catch {
    return {};
  }
}

// Runs ONE generation turn end to end (start -> stream -> commit/fail),
// wiring the pure state machine to real provider/tools/persistence via
// generation-interpreter.ts's adapters. Framework- and transport-agnostic: it
// knows nothing about HTTP, routes, or auth. Concrete instances (real
// OpenRouter provider, real DB store) are assembled in services/api, not here.
export type GenerationRunner<TEvent extends ChatServerPersistedEvent = ChatServerPersistedEvent> = {
  generate: (
    input: ChatServerGenerationInput,
    operation?: GenerationRunnerOptions<TEvent>,
  ) => Promise<ChatServerGenerationResult>;
};

export function createGenerationRunner<
  TEvent extends ChatServerPersistedEvent = ChatServerPersistedEvent,
>(defaults: GenerationRunnerOptions<TEvent> = {}): GenerationRunner<TEvent> {
  return {
    async generate(input, operation = {}) {
      const options = { ...defaults, ...operation };
      if (!options.provider || !options.tools || !options.store) {
        throw new Error('Generation runner requires provider, tools, and store adapters');
      }
      const provider = options.provider;
      const tools = options.tools;
      const store = options.store;
      const toolResults = new Map<string, ToolResult>();
      let pendingPreview: ToolResult | null = null;
      const context = {
        userId: input.userId,
        generationId: input.generationId,
        chatId: input.chatId,
      };

      // Usage accumulation lives with the caller (see executeGenerationTurn's
      // typed addUsage): the provider's onUsage is forwarded untouched so there
      // is exactly one accumulator per generation.
      const model = provider({
        ...input.model,
        requiresConfirmation: (toolName) =>
          tools.getDefinition(toolName)?.requiresConfirmation ?? false,
      });

      const state = await runGeneration({
        generationId: input.generationId,
        startContext: input.startContext,
        initialInput: input.initialInput,
        initialState: input.initialState,
        effectTimeoutsMs: options.effectTimeoutsMs,
        adapters: {
          provider: model,
          tools: {
            execute: async ({ call, idempotencyKey }) => {
              const stored = await store.getEffect?.({
                generationId: input.generationId,
                idempotencyKey,
                toolName: call.name,
              });
              if (stored) {
                toolResults.set(call.id, stored);
                return stored;
              }
              const result = await tools.execute({
                call,
                arguments: parseArguments(call),
                context: { ...context, idempotencyKey },
              });
              toolResults.set(call.id, result);
              return store.saveEffect
                ? store.saveEffect({
                    generationId: input.generationId,
                    idempotencyKey,
                    toolName: call.name,
                    result,
                  })
                : result;
            },
            preview: async ({ call, idempotencyKey }) => {
              const definition = tools.getDefinition(call.name);
              const preview = definition?.preview
                ? await definition.preview(call, { ...context, idempotencyKey })
                : null;
              pendingPreview = preview?.error ? null : preview;
              return (
                preview ?? {
                  callId: call.id,
                  toolName: call.name,
                  content: 'null',
                  error: false,
                }
              );
            },
          },
          events: {
            persist: async (command) => {
              const record = await store.appendEvent({
                event: command.event,
                idempotencyKey: command.idempotencyKey,
              });
              if (record) await options.publisher?.accept(record);
            },
            emit: async (event) => options.emit?.(event),
          },
          generation: {
            save: async (stateToSave) =>
              store.saveGeneration({
                state: stateToSave,
                generationId: input.generationId,
                chatId: input.chatId,
                userId: input.userId,
                targetAssistantMessageId: input.targetAssistantMessageId,
              }),
            stop: (stateToStop) => store.stopGeneration(stateToStop),
          },
          control: {
            isCancelled: () => options.isCancelled?.(context) ?? false,
          },
        },
      });

      return { state, toolResults, pendingPreview };
    },
  };
}

export function createGenerationSseResponse(
  events: AsyncIterable<GenerationEvent>,
  options: { heartbeatMs?: number } = {},
): Response {
  const encoder = new TextEncoder();
  const heartbeatMs = options.heartbeatMs ?? GENERATION_TIMING.heartbeatMs;
  const iterator = events[Symbol.asyncIterator]();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let pending = iterator.next();
      try {
        while (true) {
          let timer: ReturnType<typeof setTimeout>;
          const heartbeat = new Promise<'heartbeat'>((resolve) => {
            timer = setTimeout(() => resolve('heartbeat'), heartbeatMs);
          });
          const next = await Promise.race([pending, heartbeat]);
          clearTimeout(timer!);
          if (next === 'heartbeat') {
            controller.enqueue(encoder.encode(':heartbeat\n\n'));
            continue;
          }
          if (next.done) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }
          const id = next.value.sequence === null ? '' : `id: ${next.value.sequence}\n`;
          controller.enqueue(encoder.encode(`${id}data: ${JSON.stringify(next.value)}\n\n`));
          pending = iterator.next();
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
    },
  });
}
