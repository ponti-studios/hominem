import type { AIUsageMetrics } from '@hominem/ai';
import {
  AIUsageEventRepository,
  db,
  type AIUsageFeature,
  type AIUsageOperation,
} from '@hominem/db';
import { logger } from '@hominem/telemetry';

type RecordAIUsageEventInput = {
  eventId: string;
  userId: string;
  feature: AIUsageFeature;
  operation: AIUsageOperation;
  usage?: AIUsageMetrics | null;
  metadata?: Record<string, unknown>;
  model?: string | null;
};

function buildMetadata(
  metadata: Record<string, unknown> | undefined,
  usage: AIUsageMetrics,
): Record<string, unknown> | undefined {
  if (usage.reportedTotalTokens === null) {
    return metadata;
  }

  return {
    ...metadata,
    reportedTotalTokens: usage.reportedTotalTokens,
  };
}

export async function recordAIUsageEvent(input: RecordAIUsageEventInput) {
  if (!input.usage) {
    logger.warn('[ai-usage] provider response missing usage', {
      eventId: input.eventId,
      userId: input.userId,
      feature: input.feature,
      operation: input.operation,
      model: input.model ?? null,
    });
    return;
  }

  try {
    await AIUsageEventRepository.createIfAbsent(db, {
      id: input.eventId,
      userId: input.userId,
      provider: input.usage.provider,
      feature: input.feature,
      operation: input.operation,
      model: input.usage.model,
      inputTokens: input.usage.promptTokens,
      outputTokens: input.usage.completionTokens,
      totalTokens: input.usage.totalTokens,
      costUsd: input.usage.costUsd,
      cachedInputTokens: input.usage.cachedPromptTokens,
      reasoningTokens: input.usage.reasoningTokens,
      metadata: buildMetadata(input.metadata, input.usage),
    });
  } catch (error) {
    logger.error('[ai-usage] failed to record usage event', {
      eventId: input.eventId,
      userId: input.userId,
      feature: input.feature,
      operation: input.operation,
      model: input.usage.model,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
