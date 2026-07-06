import type { AIUsageMetrics } from '@hominem/ai';
import {
  AIUsageEventRepository,
  db,
  type AIUsageFeature,
  type AIUsageOperation,
} from '@hominem/db';
import { logger } from '@hominem/telemetry';

type RecordAIUsageEventInput = {
  userId: string;
  feature: AIUsageFeature;
  operation: AIUsageOperation;
  usage?: AIUsageMetrics | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAIUsageEvent(input: RecordAIUsageEventInput) {
  if (!input.usage) {
    return;
  }

  try {
    await AIUsageEventRepository.create(db, {
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
      requestId: input.requestId ?? null,
      metadata: input.metadata,
    });
  } catch (error) {
    logger.error('[ai-usage] failed to record usage event', {
      userId: input.userId,
      feature: input.feature,
      operation: input.operation,
      model: input.usage?.model,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
