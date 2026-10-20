import { getTelemetryTracer, logger } from '@hominem/telemetry';
import { SpanStatusCode, type Span } from '@opentelemetry/api';
import { z } from 'zod';

const TerminalOutcomeSchema = z.enum(['committed', 'cancelled', 'failed']);

export type GenerationEventDelivery = 'live' | 'replayed';

export type ChatGenerationMetrics = {
  firstToken: () => void;
  firstToolCall: () => void;
  toolCount: (value: number) => void;
  outcome: (value: 'committed' | 'cancelled' | 'failed') => void;
  usage: (value: { promptTokens: number; outputTokens: number; totalTokens: number }) => void;
};

const generationTracer = getTelemetryTracer('hominem.chat');

const generationFailureTypes = {
  provider: 'chat.generation.provider_failed',
  tool: 'chat.generation.tool_failed',
  transport: 'chat.generation.transport_failed',
  persistence: 'chat.generation.persistence_failed',
  unknown: 'chat.generation.unknown_failed',
} as const;

export function withChatGenerationSpan<T>(
  kind: 'send' | 'start',
  run: (metrics: ChatGenerationMetrics) => Promise<T>,
): Promise<T> {
  return generationTracer.startActiveSpan(
    'chat.generation',
    { attributes: { 'chat.generation.kind': kind } },
    async (span: Span) => {
      const startedAt = performance.now();
      let firstTokenRecorded = false;
      let firstToolCallRecorded = false;
      const metrics: ChatGenerationMetrics = {
        firstToken: () => {
          if (firstTokenRecorded) return;
          firstTokenRecorded = true;
          span.setAttribute('chat.generation.time_to_first_token_ms', elapsedMs(startedAt));
        },
        firstToolCall: () => {
          if (firstToolCallRecorded) return;
          firstToolCallRecorded = true;
          span.setAttribute('chat.generation.time_to_first_tool_call_ms', elapsedMs(startedAt));
        },
        toolCount: (value) => span.setAttribute('chat.generation.tool_count', value),
        outcome: (value) => {
          span.setAttribute('chat.generation.outcome', value);
          if (value === 'failed') span.setStatus({ code: SpanStatusCode.ERROR });
        },
        usage: ({ promptTokens, outputTokens, totalTokens }) => {
          span.setAttributes({
            'chat.generation.prompt_tokens': promptTokens,
            'chat.generation.output_tokens': outputTokens,
            'chat.generation.total_tokens': totalTokens,
          });
        },
      };

      try {
        return await run(metrics);
      } catch (error) {
        metrics.outcome('failed');
        span.setAttribute('failureType', 'chat.generation.failed');
        throw error;
      } finally {
        span.setAttribute('chat.generation.duration_ms', elapsedMs(startedAt));
        span.end();
      }
    },
  );
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

export type GenerationDiagnosticRecord = {
  generationId: string;
  attempt?: number;
  turnId?: string;
  durableSequence?: number;
  replayCursor?: number;
  deliveryMode?: GenerationEventDelivery;
  terminalOutcome?: z.infer<typeof TerminalOutcomeSchema>;
  errorCategory?: 'provider' | 'tool' | 'transport' | 'persistence' | 'unknown';
  effectOutcome?: 'reused' | 'executed' | 'failed';
};

export function recordGenerationDiagnostic(input: GenerationDiagnosticRecord): void {
  const failureType = input.errorCategory ? generationFailureTypes[input.errorCategory] : undefined;
  logger.info('chat_generation_diagnostic', {
    operation: 'chat.generation',
    generationId: input.generationId,
    ...(input.attempt === undefined ? {} : { attempt: input.attempt }),
    ...(input.turnId === undefined ? {} : { turnId: input.turnId }),
    ...(input.durableSequence === undefined ? {} : { durableSequence: input.durableSequence }),
    ...(input.replayCursor === undefined ? {} : { replayCursor: input.replayCursor }),
    ...(input.deliveryMode === undefined ? {} : { deliveryMode: input.deliveryMode }),
    ...(input.terminalOutcome === undefined ? {} : { terminalOutcome: input.terminalOutcome }),
    ...(input.errorCategory === undefined ? {} : { errorCategory: input.errorCategory }),
    ...(failureType === undefined ? {} : { failureType }),
    ...(input.effectOutcome === undefined ? {} : { effectOutcome: input.effectOutcome }),
  });
}

export function recordGenerationEventDelivery(input: {
  generationId: string;
  sequence: number;
  delivery: GenerationEventDelivery;
}): void {
  recordGenerationDiagnostic({
    generationId: input.generationId,
    durableSequence: input.sequence,
    replayCursor: input.sequence,
    deliveryMode: input.delivery,
  });
  logger.info('chat_generation_event_delivered', input);
}

export function recordGenerationEventDeduplicated(input: {
  generationId: string;
  sequence: number;
}): void {
  recordGenerationDiagnostic({
    generationId: input.generationId,
    durableSequence: input.sequence,
    replayCursor: input.sequence,
    deliveryMode: 'replayed',
  });
  logger.info('chat_generation_event_deduplicated', input);
}

export function recordGenerationToolEffect(input: {
  generationId: string;
  toolName: string;
  outcome: 'reused' | 'executed' | 'failed';
}): void {
  recordGenerationDiagnostic({
    generationId: input.generationId,
    effectOutcome: input.outcome,
    errorCategory: input.outcome === 'failed' ? 'tool' : undefined,
  });
  logger.info('chat_generation_tool_effect', input);
}
