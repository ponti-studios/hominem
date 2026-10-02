import { type AIUsageMetrics } from '@hominem/ai';
import {
  chatMessageJsonObjectSchema,
  chatMessageSnapshotSchema,
  type ChatMessageJsonObject,
  type GenerationDeltaEventPayload,
  type GenerationEffectStore,
  type GenerationHistoryEventPayload,
  type GenerationToolCall,
  type ToolResult,
} from '@hominem/chat';
import type { GenerationRunnerOptions } from '@hominem/chat/server';
import { createGenerationRunner } from '@hominem/chat/server';
import type { ChatGenerationEventRecord, ChatMessageToolCallRecord } from '@hominem/db/chats';
import { logger } from '@hominem/telemetry';
import { ZodError } from 'zod';

import { callTool, getToolDefinition } from '../mcp/tool-registry';
import { OpenRouterChatModel } from './chat-generation-provider';
import type { GenerationEngineInput, GenerationEngineResult } from './chat-generation-types';

export class ToolInputError extends Error {
  readonly category = 'tool_input';

  constructor(toolName: string) {
    super(`Tool arguments are invalid for ${toolName}`);
    this.name = 'ToolInputError';
  }
}

const generationRunner = createGenerationRunner<ChatGenerationEventRecord>();

/**
 * Boundary events that execute persists itself.
 *
 * Rule: if execute is the one true writer for a transition, the runner's persist
 * funnel must ignore the machine's duplicate copy. Otherwise the same event gets
 * written twice.
 *
 * Current execute-owned transitions:
 * - generation.started + generation.phase_changed (running): written together as a
 *   startup burst before the first provider turn opens
 * - generation.phase_changed (saving): written immediately before commitGeneration
 *   begins, not inside that transaction
 * - generation.committed: written in the same transaction as the message snapshot
 * - generation.failed: written from the catch path in its own transaction
 * - generation.cancelled: written elsewhere in chat-generation-lifecycle.ts,
 *   alongside cancel_requested
 */
export const EXECUTE_OWNED_EVENT_TYPES = [
  'generation.started',
  'generation.committed',
  'generation.cancelled',
  'generation.failed',
] as const;

/**
 * Returns true when execute is the source of truth for the event.
 *
 * The machine may emit a copy during normal lifecycle transitions, but execute is
 * responsible for persisting the canonical boundary event.
 */
export function isExecuteOwnedEvent(event: GenerationHistoryEventPayload): boolean {
  // oxlint-disable-next-line typescript/consistent-type-assertions
  const type = event.type as (typeof EXECUTE_OWNED_EVENT_TYPES)[number];

  if (EXECUTE_OWNED_EVENT_TYPES.includes(type)) return true;

  return (
    event.type === 'generation.phase_changed' &&
    (event.phase === 'running' || event.phase === 'saving')
  );
}

function parseArguments(call: GenerationToolCall): ChatMessageJsonObject {
  // If there are no arguments, return an empty object.
  if (!call.arguments) return {};

  let value: unknown;
  try {
    value = JSON.parse(call.arguments);
  } catch {
    throw new ToolInputError(call.name);
  }

  const parsed = chatMessageJsonObjectSchema.safeParse(value);
  if (!parsed.success) {
    throw new ToolInputError(call.name);
  }

  return parsed.data;
}

function toToolRecord(call: GenerationToolCall, result?: ToolResult): ChatMessageToolCallRecord {
  let args: ChatMessageJsonObject = {};
  try {
    args = parseArguments(call);
  } catch {
    // swallow it — the bad argument string is still visible in the model transcript,
    // and the tool result will carry the validation error
  }
  return {
    toolName: call.name,
    type: 'tool-call',
    toolCallId: call.id,
    args,
    confirmationStatus: result ? undefined : 'pending',
    executionStatus: result ? (result.error ? 'failed' : 'completed') : 'pending',
  };
}

function addUsage(
  totals: AIUsageMetrics | null,
  next: AIUsageMetrics | null,
): AIUsageMetrics | null {
  if (!next) return totals;
  if (!totals) return next;
  return {
    ...next,
    promptTokens: totals.promptTokens + next.promptTokens,
    outputTokens: totals.outputTokens + next.outputTokens,
    totalTokens: totals.totalTokens + next.totalTokens,
    costUsd:
      totals.costUsd !== null || next.costUsd !== null
        ? (totals.costUsd ?? 0) + (next.costUsd ?? 0)
        : null,
  };
}

export async function executeGenerationTurn(
  input: GenerationEngineInput & {
    generationId: string;
    chatId: string;
    generationKind?: 'send' | 'start' | 'regenerate';
    userMessageId?: string | null;
    targetAssistantMessageId?: string | null;
    effectStore?: GenerationEffectStore;
    eventStore?: {
      append: (input: {
        event: GenerationHistoryEventPayload;
        idempotencyKey: string;
      }) => Promise<ChatGenerationEventRecord | null>;
    };
    durableEvents?: { accept: (event: ChatGenerationEventRecord) => Promise<void> | void };
    liveEvents?: { accept: (event: GenerationDeltaEventPayload) => Promise<void> | void };
    cancellation?: { isRequested: () => boolean | Promise<boolean> };
    // Overrides the interpreter's default per-command timeouts. Production
    // callers should leave this unset; it exists so tests can make a hung
    // port fail fast instead of waiting out the real defaults.
    effectTimeoutsMs?: GenerationRunnerOptions['effectTimeoutsMs'];
  },
): Promise<GenerationEngineResult> {
  let usage: AIUsageMetrics | null = null;
  const runtime = input.toolRuntime ?? { callTool, getToolDefinition };
  const plannedSteps = input.toolPlan ?? null;
  const completedPlannedTools = new Set(
    input.initialState?.completedToolResults
      .filter((result) => !result.error)
      .map((result) => result.toolName),
  );
  const validatePlannedToolCall = (toolName: string): string | null => {
    if (!plannedSteps) return null;
    const step = plannedSteps.find((candidate) => candidate.tool === toolName);
    if (!step) return `Tool ${toolName} is outside the validated tool plan`;
    const missing = step.dependsOn.filter((dependency) => !completedPlannedTools.has(dependency));
    if (missing.length > 0) {
      return `Tool ${toolName} is waiting for prerequisite tool(s): ${missing.join(', ')}`;
    }
    const definition = runtime.getToolDefinition(toolName);
    const requiredDependencies =
      definition?.guidance?.dependencies?.map((dependency) => dependency.tool) ?? [];
    const missingRequiredDependencies = requiredDependencies.filter(
      (dependency) => !completedPlannedTools.has(dependency),
    );
    if (missingRequiredDependencies.length > 0) {
      return `Tool ${toolName} is waiting for required provenance from: ${missingRequiredDependencies.join(', ')}`;
    }
    if (definition && !definition.readOnly) {
      const hasCompletedRead = plannedSteps.some(
        (candidate) =>
          completedPlannedTools.has(candidate.tool) &&
          (runtime.getToolDefinition(candidate.tool)?.readOnly ?? false),
      );
      if (!hasCompletedRead) return `Tool ${toolName} requires a preceding read-only lookup`;
    }
    return null;
  };
  const modelOptions = {
    model: input.model,
    messages: input.messages,
    tools: input.tools,
    maxTokens: input.maxTokens,
    reasoning: input.reasoning,
    requiresToolCall: input.initialState ? false : input.requiresToolCall,
    requiresConfirmation: (name: string) =>
      runtime?.getToolDefinition(name)?.requiresConfirmation ?? false,
    onUsage: (next: AIUsageMetrics | null) => {
      usage = addUsage(usage, next);
    },
  };
  // OpenRouter is the only supported provider: the model is always built
  // here, never via a factory. Test-only scripting arrives one layer down
  // as input.openRouterClient (canned SSE chunks through the real model
  // class), so the provider closure below only ever returns this instance —
  // the runner forwards onUsage untouched and usage is accumulated exactly
  // once, here. (The runner used to wrap onUsage with its own generic usage
  // accumulator plus a completion-recording hook for the deferred Redis
  // context-window cache; both were deleted along with that cache — see
  // the context-window placeholder task.)
  const model = new OpenRouterChatModel({
    ...modelOptions,
    ...(input.openRouterClient ? { client: input.openRouterClient } : {}),
  });

  // The model is prebuilt with the engine's own onUsage accumulator above,
  // so the closure intentionally ignores the runner's model input.
  const operation: GenerationRunnerOptions<ChatGenerationEventRecord> = {
    provider: () => model,
    effectTimeoutsMs: input.effectTimeoutsMs,
    tools: {
      getDefinition: (toolName) => {
        const definition = runtime.getToolDefinition(toolName);
        return definition
          ? {
              requiresConfirmation: definition.requiresConfirmation,
              preview: async (call, context) => {
                try {
                  const value = definition.preview
                    ? await definition.preview(context.userId, parseArguments(call))
                    : null;
                  return {
                    callId: call.id,
                    toolName: call.name,
                    content: JSON.stringify(value),
                    error: false,
                  };
                } catch {
                  return {
                    callId: call.id,
                    toolName: call.name,
                    content: JSON.stringify({ error: 'Tool preview failed' }),
                    error: true,
                  };
                }
              },
            }
          : undefined;
      },
      execute: async ({ call, context: toolContext }) => {
        const planViolation = validatePlannedToolCall(call.name);
        if (planViolation) {
          return {
            callId: call.id,
            toolName: call.name,
            content: JSON.stringify({ code: 'TOOL_PLAN_VIOLATION', error: planViolation }),
            error: true,
          };
        }
        const idempotencyKey = toolContext.idempotencyKey;
        const stored = await input.effectStore?.get({
          generationId: input.generationId,
          idempotencyKey,
          toolName: call.name,
        });
        if (stored) {
          if (!stored.error) completedPlannedTools.add(call.name);
          return stored;
        }
        try {
          const value = await runtime.callTool(input.userId, call.name, parseArguments(call), {
            idempotencyKey,
          });
          // content[0] is always the JSON text block — resource_link blocks
          // (if any) are always appended after it, never first.
          const firstBlock = value.content[0];
          const result: ToolResult = {
            callId: call.id,
            toolName: call.name,
            content: firstBlock?.type === 'text' ? firstBlock.text : 'null',
            error: false,
          };
          if (!result.error) completedPlannedTools.add(call.name);
          return input.effectStore
            ? await input.effectStore.save({
                generationId: input.generationId,
                idempotencyKey,
                toolName: call.name,
                result,
              })
            : result;
        } catch (error) {
          // The model only ever sees the generic message below; keep the cause in the logs.
          logger.warn('chat_generation_tool_call_failed', {
            generationId: input.generationId,
            toolName: call.name,
            error:
              error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : 'unknown',
          });
          const result: ToolResult = {
            callId: call.id,
            toolName: call.name,
            content: JSON.stringify(
              error instanceof ZodError
                ? // The model's own bad arguments: say which ones (paths and messages only,
                  // never values) so it can correct the call instead of repeating it.
                  {
                    error: 'Invalid arguments',
                    issues: error.issues.map((issue) => ({
                      path: issue.path.join('.'),
                      message: issue.message,
                    })),
                  }
                : { error: 'Tool call failed' },
            ),
            error: true,
          };
          return input.effectStore
            ? await input.effectStore.save({
                generationId: input.generationId,
                idempotencyKey,
                toolName: call.name,
                result,
              })
            : result;
        }
      },
    },
    store: {
      appendEvent: async ({ event, idempotencyKey }) => {
        if (isExecuteOwnedEvent(event)) return null;
        const record = await input.eventStore?.append({ event, idempotencyKey });
        if (record) await input.durableEvents?.accept(record);
        return record ?? null;
      },
      getEffect: async ({ generationId, idempotencyKey, toolName }) =>
        input.effectStore?.get({ generationId, idempotencyKey, toolName }) ?? null,
      saveEffect: async ({ generationId, idempotencyKey, toolName, result }) =>
        input.effectStore
          ? input.effectStore.save({ generationId, idempotencyKey, toolName, result })
          : result,
      saveGeneration: async (state) =>
        chatMessageSnapshotSchema.parse({
          id: `${input.generationId}:assistant`,
          chatId: input.chatId,
          userId: input.userId,
          role: 'assistant',
          content: state.state.assistantText,
          files: null,
          toolCalls: null,
          reasoning: state.state.reasoningText || null,
          parentMessageId: input.targetAssistantMessageId ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      stopGeneration: async () => undefined,
    },
    emit: async (event) => {
      await input.liveEvents?.accept(event);
    },
    isCancelled: () => input.cancellation?.isRequested?.() ?? false,
  };

  const result = await generationRunner.generate(
    {
      generationId: input.generationId,
      chatId: input.chatId,
      userId: input.userId,
      model: {
        model: input.model,
        messages: input.messages,
        tools: input.tools,
        maxTokens: input.maxTokens,
        reasoning: input.reasoning,
        requiresToolCall: input.initialState ? false : input.requiresToolCall,
        requiresWebSearch: input.initialState ? false : input.requiresWebSearch,
        onUsage: (next) => modelOptions.onUsage?.(next as AIUsageMetrics | null),
      },
      startContext: {
        chatId: input.chatId,
        kind: input.generationKind ?? 'send',
        userMessageId: input.userMessageId ?? null,
        targetAssistantMessageId: input.targetAssistantMessageId ?? null,
        requestContext: {},
      },
      initialState: input.initialState,
      initialInput: input.initialInput,
      targetAssistantMessageId: input.targetAssistantMessageId,
    },
    operation,
  );
  const state = result.state;
  if (state.phase === 'failed') throw new Error(state.lastError ?? 'Generation failed');

  const pending = state.pendingConfirmation;
  return {
    assistantText: state.assistantText,
    reasoningText: state.reasoningText || null,
    toolCallRecords: state.toolCalls.map((call) =>
      toToolRecord(
        call,
        result.toolResults.get(call.id) ??
          state.completedToolResults.find((toolResult) => toolResult.callId === call.id),
      ),
    ),
    usage,
    pendingToolCall: pending
      ? {
          toolCallId: pending.id,
          toolName: pending.name,
          args: parseArguments(pending),
          preview: result.pendingPreview ? JSON.parse(result.pendingPreview.content) : null,
        }
      : null,
  };
}
