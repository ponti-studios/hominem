import type { AIUsageMetrics } from '@hominem/ai';
import {
  AIUsageEventRepository,
  db,
  type AIUsageFeature,
  type AIUsageEventStatus,
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
  durationMs: number;
  status?: AIUsageEventStatus;
  error?: unknown;
  errorCode?: string | null;
  errorStatus?: number | null;
};

export type AIUsageFailureDetails = {
  errorCode: string | null;
  errorStatus: number | null;
};

export function startAIUsageTimer() {
  const startedAt = performance.now();
  return () => Math.max(0, Math.round(performance.now() - startedAt));
}

function sanitizeErrorCode(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const sanitized = value.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 64);
  return sanitized || null;
}

export function getAIUsageFailureDetails(error: unknown): AIUsageFailureDetails {
  if (!error || typeof error !== 'object') {
    return { errorCode: null, errorStatus: null };
  }

  const candidate = error as { code?: unknown; status?: unknown; statusCode?: unknown };
  const status =
    typeof candidate.status === 'number'
      ? candidate.status
      : typeof candidate.statusCode === 'number'
        ? candidate.statusCode
        : null;

  return {
    errorCode: sanitizeErrorCode(candidate.code),
    errorStatus:
      status !== null && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
  };
}

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
  const usage = input.usage ?? null;
  const failure = input.error ? getAIUsageFailureDetails(input.error) : null;

  if (!usage) {
    logger.warn('[ai-usage] provider response missing usage', {
      eventId: input.eventId,
      userId: input.userId,
      feature: input.feature,
      operation: input.operation,
      model: input.model ?? null,
      status: input.status ?? 'succeeded',
    });
  }

  try {
    await AIUsageEventRepository.createIfAbsent(db, {
      id: input.eventId,
      userId: input.userId,
      provider: usage?.provider ?? 'openrouter',
      feature: input.feature,
      operation: input.operation,
      model: usage?.model ?? input.model ?? null,
      inputTokens: usage?.promptTokens ?? 0,
      outputTokens: usage?.completionTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
      costUsd: usage?.costUsd ?? null,
      cachedInputTokens: usage?.cachedPromptTokens ?? null,
      reasoningTokens: usage?.reasoningTokens ?? null,
      durationMs: input.durationMs,
      status: input.status ?? 'succeeded',
      usageAvailable: usage !== null,
      errorCode: input.errorCode ?? failure?.errorCode ?? null,
      errorStatus: input.errorStatus ?? failure?.errorStatus ?? null,
      metadata: usage ? buildMetadata(input.metadata, usage) : input.metadata,
    });
  } catch (error) {
    logger.error('[ai-usage] failed to record usage event', {
      eventId: input.eventId,
      userId: input.userId,
      feature: input.feature,
      operation: input.operation,
      model: usage?.model ?? input.model ?? null,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
