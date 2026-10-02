import {
  type AIUsageMetrics,
  type ChatFunctionTool,
  type ChatMessages,
  type ChatRequest,
  type ChatStreamChunk,
  getChatCompletionUsage,
  OpenRouterRequestError,
  streamChatCompletion,
} from '@hominem/ai';
import {
  GENERATION_TIMING,
  providerChunkSchema,
  type GenerationInput,
  type GenerationState,
  type ProviderChunk,
  type ProviderToolCallDelta,
} from '@hominem/chat';
import { reconstructProviderToolCalls } from '@hominem/chat/server';
import type { ChatModel } from '@hominem/chat/server';
import { logger } from '@hominem/telemetry';

import { chatToolName } from './chat-tool-name';

class ProviderInputError extends Error {
  constructor(
    readonly diagnostics: {
      issuePaths: readonly string[];
      shape: ProviderChunkShape;
    },
  ) {
    super('Provider returned an invalid generation chunk');
    this.name = 'ProviderInputError';
  }
}

// OpenRouter has been observed to deliver a complete response — including a
// terminal `finishReason` on every choice — and then leave the SSE
// connection open with no further bytes and no close, sometimes for minutes.
// A single request-level timeout doesn't help: it can't tell "the provider
// went fully silent" apart from "a long response is still actively
// streaming". Per-chunk idle timing can, so each `completion.next()` races
// this deadline instead. Composes with CHAT_REQUEST_TIMEOUT_MS in
// @hominem/ai's text.ts (the absolute request+stream deadline, which this
// idle timer will almost always fire well before) via the AbortController
// created below. See GENERATION_TIMING for the full timeout policy.
const CHUNK_IDLE_TIMEOUT_MS = GENERATION_TIMING.providerIdleMs;

// After a finish-reason chunk, OpenRouter often (not always) follows with one
// more chunk carrying only usage/cost data before going silent. Short grace
// window to catch it without reintroducing the original hang.
const USAGE_TRAILER_GRACE_MS = GENERATION_TIMING.usageTrailerGraceMs;

class StreamIdleTimeoutError extends Error {
  // Matches OpenRouterRequestError's convention (see normalizeOpenRouterError
  // in @hominem/ai) so the existing transient-retry classification below
  // picks this up for free.
  readonly code = 'timeout';

  constructor(idleMs: number) {
    super(`No provider chunk received for ${idleMs}ms`);
    this.name = 'StreamIdleTimeoutError';
  }
}

const IDLE = Symbol('idle-timeout');

// Races one async-iterator step against an idle deadline. Returns IDLE if
// nothing arrived in time; the timer is always cleared so it can't outlive
// the iteration.
function nextWithIdleTimeout<T>(
  iterator: AsyncIterator<T>,
  idleMs: number,
): Promise<IteratorResult<T> | typeof IDLE> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(IDLE), idleMs);
    iterator.next().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

type ProviderChunkShape = {
  choiceCount: number;
  hasDelta: boolean;
  contentType: string;
  reasoningType: string;
  toolCallsType: string;
  toolCallIndexes: readonly number[];
  toolCallFunctionKeys: readonly string[][];
};

export type OpenRouterChatModelOptions = {
  model: string;
  messages: ChatMessages[];
  tools: ChatFunctionTool[];
  maxTokens?: number;
  reasoning?: ChatRequest['reasoning'];
  requiresToolCall?: boolean;
  requiresWebSearch?: boolean;
  requiresConfirmation?: (toolName: string) => boolean;
  // Withholds a tool from a turn while this says no (checked at the start of every turn), so the
  // model cannot call a write before the lookup it depends on. Without it every tool is offered.
  isToolAvailable?: (toolName: string) => boolean;
  maxAttempts?: number;
  // Test-only scripted stream (canned chunks). Production never sets this —
  // OpenRouter is the only supported provider.
  streamChat?: typeof streamChatCompletion;
  // Usage is provider metadata and may be absent even when the response is valid.
  onUsage?: (usage: AIUsageMetrics | null) => void;
};

function toProviderChunk(chunk: ChatStreamChunk): ProviderChunk {
  const delta = chunk.choices?.[0]?.delta;
  const shape: ProviderChunkShape = {
    choiceCount: chunk.choices?.length ?? 0,
    hasDelta: Boolean(delta),
    contentType: typeof delta?.content,
    reasoningType: typeof delta?.reasoning,
    toolCallsType: Array.isArray(delta?.toolCalls) ? 'array' : typeof delta?.toolCalls,
    toolCallIndexes: (delta?.toolCalls ?? []).map((call) => call.index),
    toolCallFunctionKeys: (delta?.toolCalls ?? []).map((call) =>
      call.function ? Object.keys(call.function).sort() : [],
    ),
  };
  const result = providerChunkSchema.safeParse({
    content: delta?.content,
    reasoning: delta?.reasoning,
    toolCalls: delta?.toolCalls,
  });
  if (!result.success) {
    throw new ProviderInputError({
      issuePaths: result.error.issues.map((issue) => issue.path.join('.') || '<root>'),
      shape,
    });
  }
  return {
    content: result.data.content,
    reasoning: result.data.reasoning,
    toolCalls: result.data.toolCalls?.map(({ type: _type, ...call }) => call),
  };
}

function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = 'status' in error ? Reflect.get(error, 'status') : undefined;
  // 502 is included alongside 429/503 because OpenRouter uses it for
  // mid-stream provider disconnect/overload errors (delivered as an `error`
  // chunk inside an already-200 SSE stream), which are retryable the same as
  // a pre-stream 429/503.
  if (status === 429 || status === 502 || status === 503) return true;
  // A request that timed out or dropped its connection (see
  // CHAT_REQUEST_TIMEOUT_MS in @hominem/ai) never got a response at all, so
  // there's no HTTP status to check — retry it the same as a 429/503.
  const code = 'code' in error ? Reflect.get(error, 'code') : undefined;
  return code === 'timeout' || code === 'connection_error';
}

// A tool the model has called this many times in one generation is withdrawn for the rest of
// it, so a model that keeps tweaking a search's arguments has to answer. (The generation
// machine's own cap, MAX_TOOL_CALLS_PER_GENERATION, ends the whole generation instead.)
export const MAX_CALLS_PER_TOOL = 6;

export class OpenRouterChatModel implements ChatModel {
  private readonly messages: ChatMessages[];
  private readonly callCounts = new Map<string, number>();
  // Set once a turn comes back empty: the same request is not sent again as "required".
  private requiredToolChoiceFailed = false;
  private attempt = 0;
  private firstTurn = true;

  constructor(private readonly options: OpenRouterChatModelOptions) {
    this.messages = [...options.messages];
  }

  private async *streamTurn(state: GenerationState): AsyncIterable<GenerationInput> {
    const calls = new Map<number, ProviderToolCallDelta>();
    const generationIteration = state.iteration;
    // Backstops iterator.return() below: the SDK's EventStream.return()
    // cancels its internal reader, but that cancellation depends on the
    // runtime promptly propagating it into a stalled in-flight socket read —
    // there's no independent kill switch. Aborting our own signal drives
    // cancellation through the fetch/undici abort path instead, which is
    // the mechanism the HTTP client actually guarantees acts on.
    const controller = new AbortController();
    const tools = this.options.tools.filter((tool) => {
      const name = chatToolName(tool);
      return (
        (this.callCounts.get(name) ?? 0) < MAX_CALLS_PER_TOOL &&
        (this.options.isToolAvailable?.(name) ?? true)
      );
    });
    const forceTool =
      this.firstTurn &&
      !this.requiredToolChoiceFailed &&
      (this.options.requiresToolCall || this.options.requiresWebSearch);
    const toolChoice = tools.length === 0 ? undefined : forceTool ? 'required' : 'auto';
    // What this turn actually returned, kept so an empty one can be explained afterwards.
    let chunkCount = 0;
    let contentChars = 0;
    let reasoningChars = 0;
    let servedModel: string | undefined;
    let usageSeen: string | null = null;
    const finishReasons: string[] = [];
    try {
      const completion = (this.options.streamChat ?? streamChatCompletion)(
        {
          model: this.options.model,
          messages: this.messages,
          tools: tools.length > 0 ? tools : undefined,
          toolChoice,
          parallelToolCalls: false,
          maxTokens: this.options.maxTokens,
          ...(this.options.reasoning ? { reasoning: this.options.reasoning } : {}),
        },
        { signal: controller.signal },
      );

      const iterator = completion[Symbol.asyncIterator]();
      while (true) {
        const step = await nextWithIdleTimeout(iterator, CHUNK_IDLE_TIMEOUT_MS);
        if (step === IDLE) {
          // Don't await this: a generator suspended on a stalled fetch won't
          // settle `.return()` until that inner read itself resolves — which
          // is the exact hang we're trying to escape. Let it clean up
          // whenever the underlying connection does; we move on now.
          iterator.return?.(undefined)?.catch(() => undefined);
          controller.abort(new StreamIdleTimeoutError(CHUNK_IDLE_TIMEOUT_MS));
          throw new StreamIdleTimeoutError(CHUNK_IDLE_TIMEOUT_MS);
        }
        if (step.done) break;
        const chunk = step.value;
        if (chunk.error) {
          // A mid-stream error chunk still carries an HTTP-style status in
          // `code` (429/502/503 etc. — see OpenRouter's usage-accounting and
          // streaming docs). Preserve it as `status` so isTransient() below
          // and getAIUsageFailureDetails() (ai-usage.ts) can classify and
          // report it instead of seeing a bare, code-less Error.
          throw new OpenRouterRequestError(chunk.error.message, { status: chunk.error.code });
        }
        const chunkUsage = getChatCompletionUsage(chunk);
        this.options.onUsage?.(chunkUsage);
        if (chunkUsage)
          usageSeen = `${chunkUsage.promptTokens} in / ${chunkUsage.outputTokens} out`;
        servedModel = chunk.model ?? servedModel;
        const providerChunk = toProviderChunk(chunk);
        chunkCount += 1;
        contentChars += providerChunk.content?.length ?? 0;
        reasoningChars += providerChunk.reasoning?.length ?? 0;
        for (const choice of chunk.choices ?? []) {
          if (choice.finishReason != null) finishReasons.push(String(choice.finishReason));
        }
        for (const call of providerChunk.toolCalls ?? []) {
          const previous = calls.get(call.index);
          calls.set(call.index, {
            index: call.index,
            id: call.id ?? previous?.id,
            function: {
              name: call.function?.name ?? previous?.function?.name,
              arguments: `${previous?.function?.arguments ?? ''}${call.function?.arguments ?? ''}`,
            },
          });
        }
        yield { type: 'provider-chunk', chunk: providerChunk };
        if (chunk.choices?.some((choice) => choice.finishReason != null)) {
          // The provider just told us this choice is finished — don't wait
          // around for the connection to close on its own (observed: it can
          // sit open for minutes after delivering everything). OpenRouter
          // commonly sends a final usage-only trailer chunk right after the
          // finish-reason chunk, so give it one short grace window rather
          // than dropping usage/cost data outright; if nothing arrives in
          // time we still move on immediately rather than risk the
          // open-forever hang this whole mechanism exists to avoid.
          const trailer = await nextWithIdleTimeout(iterator, USAGE_TRAILER_GRACE_MS);
          if (trailer !== IDLE && !trailer.done) {
            this.options.onUsage?.(getChatCompletionUsage(trailer.value));
          }
          iterator.return?.(undefined)?.catch(() => undefined);
          controller.abort(new Error('provider turn finished; closing stream'));
          break;
        }
      }

      // A call without an id or name cannot run and the machine drops it, so it must not make an
      // otherwise empty turn look productive.
      const toolCalls = reconstructProviderToolCalls(calls).filter(
        (call) => call.id !== '' && call.function.name !== '',
      );
      // rawToolCallCount above the calls kept means an incomplete call was dropped.
      logger.info('provider_turn_summary', {
        iteration: generationIteration,
        toolChoice: toolChoice ?? 'none',
        offered: tools.map(chatToolName),
        called: toolCalls.map((call) => call.function.name),
        rawToolCallCount: calls.size,
        textChars: contentChars,
        finishReasons,
      });
      if (contentChars === 0 && toolCalls.length === 0) {
        // Neither text nor a usable tool call: this is the user's "No reply was generated".
        logger.warn('provider_turn_empty', {
          model: this.options.model,
          iteration: generationIteration,
          servedModel,
          toolChoice: toolChoice ?? 'none',
          // Not "maxTokens": the logger redacts any key containing "token".
          completionCap: this.options.maxTokens ?? null,
          toolCount: tools.length,
          usage: usageSeen,
          finishReasons,
          chunkCount,
          reasoningChars,
          rawToolCallCount: calls.size,
        });
        // Nothing ran, so asking again is safe. A "required" request that came back empty did
        // so on every retry, and "auto" never did, so retries let the model choose.
        this.requiredToolChoiceFailed = true;
        yield {
          type: 'provider-turn-failed',
          message: 'No reply was generated',
          transient: true,
          attempt: this.attempt,
          maxAttempts: this.options.maxAttempts ?? 2,
        };
        return;
      }
      if (toolCalls.length > 0) {
        this.messages.push({ role: 'assistant', content: null, toolCalls });
      }
      for (const {
        function: { name },
      } of toolCalls) {
        const count = (this.callCounts.get(name) ?? 0) + 1;
        this.callCounts.set(name, count);
        if (count === MAX_CALLS_PER_TOOL) {
          logger.warn('provider_tool_withdrawn', { toolName: name, calls: count });
        }
      }
      const confirmationCallIds = toolCalls.reduce<string[]>((ids, call) => {
        if (this.options.requiresConfirmation?.(call.function.name) ?? false) ids.push(call.id);
        return ids;
      }, []);
      const requiredToolCall = this.firstTurn && Boolean(this.options.requiresToolCall);
      this.firstTurn = false;
      this.attempt = 0;
      yield {
        type: 'provider-turn-completed',
        requiredToolCall,
        confirmationCallIds,
      };
    } catch (error) {
      if (error instanceof ProviderInputError) {
        logger.warn('provider_chunk_rejected', {
          model: this.options.model,
          iteration: generationIteration,
          ...error.diagnostics,
        });
      }
      yield {
        type: 'provider-turn-failed',
        message: error instanceof Error ? error.message : 'Provider request failed',
        transient: isTransient(error),
        attempt: Math.max(this.attempt, generationIteration),
        maxAttempts: this.options.maxAttempts ?? 2,
      };
    } finally {
      // Defense-in-depth for any exit path not already covered above
      // (ProviderInputError, a chunk.error throw, etc.) — aborting an
      // already-settled signal is a safe no-op.
      controller.abort();
    }
  }

  open({ state }: { turnId: string; iteration: number; state: GenerationState }) {
    return this.streamTurn(state);
  }

  appendToolResult({ call, result }: { call: { id: string }; result: { content: string } }) {
    this.messages.push({ role: 'tool', toolCallId: call.id, content: result.content });
  }

  retry({ attempt, state }: { attempt: number; state: GenerationState }) {
    this.attempt = attempt;
    return this.streamTurn(state);
  }
}
