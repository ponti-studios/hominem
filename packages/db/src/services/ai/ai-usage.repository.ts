import { toNullableNumber, toRequiredNumber } from '@hominem/utils';
import { sql, type Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppAiUsageEvents, Numeric } from '../../types/database';

type AIUsageEventRow = Selectable<AppAiUsageEvents>;

export type AIUsageFeature =
  | 'chat_stream'
  | 'text_enhance'
  | 'task_extract'
  | 'voice_task_extract'
  | 'voice_cleanup'
  | 'embedding';

export type AIUsageOperation = 'chat_completion' | 'structured_output' | 'embedding';

export interface AIUsageEventRecord {
  id: string;
  userId: string;
  provider: string;
  feature: AIUsageFeature;
  operation: AIUsageOperation;
  model: string;
  requestId: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
  costUsd: number | null;
  metadata: unknown;
  createdAt: string;
}

export interface CreateAIUsageEventInput {
  userId: string;
  provider: string;
  feature: AIUsageFeature;
  operation: AIUsageOperation;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestId?: string | null;
  cachedInputTokens?: number | null;
  reasoningTokens?: number | null;
  costUsd?: number | null;
  metadata?: unknown;
}

export interface AIUsageQueryRange {
  userId: string;
  from?: string | null;
  to?: string | null;
}

export interface AIUsageSummaryRecord {
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  lastRecordedAt: string | null;
}

export interface AIUsageFeatureBreakdownRecord {
  feature: AIUsageFeature;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface AIUsageModelBreakdownRecord {
  model: string;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
}

function toAIUsageEventRecord(row: AIUsageEventRow): AIUsageEventRecord {
  return {
    id: row.id,
    userId: row.owner_userid,
    provider: row.provider,
    feature: row.feature as AIUsageFeature,
    operation: row.operation as AIUsageOperation,
    model: row.model,
    requestId: row.request_id ?? null,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    cachedInputTokens: row.cached_input_tokens,
    reasoningTokens: row.reasoning_tokens,
    costUsd: toNullableNumber(row.cost_usd),
    metadata: row.metadata,
    createdAt: row.createdat.toISOString(),
  };
}

export const AIUsageEventRepository = {
  async create(handle: DbHandle, input: CreateAIUsageEventInput): Promise<AIUsageEventRecord> {
    const row = await handle
      .insertInto('app.ai_usage_events')
      .values({
        owner_userid: input.userId,
        provider: input.provider,
        feature: input.feature,
        operation: input.operation,
        model: input.model,
        request_id: input.requestId ?? null,
        input_tokens: input.inputTokens,
        output_tokens: input.outputTokens,
        total_tokens: input.totalTokens,
        cached_input_tokens: input.cachedInputTokens ?? null,
        reasoning_tokens: input.reasoningTokens ?? null,
        cost_usd: input.costUsd ?? null,
        metadata: input.metadata === undefined ? null : (input.metadata as never),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toAIUsageEventRecord(row as AIUsageEventRow);
  },

  async getSummary(handle: DbHandle, input: AIUsageQueryRange): Promise<AIUsageSummaryRecord> {
    let query = handle.selectFrom('app.ai_usage_events').where('owner_userid', '=', input.userId);

    if (input.from) {
      query = query.where('createdat', '>=', new Date(input.from));
    }

    if (input.to) {
      query = query.where('createdat', '<=', new Date(input.to));
    }

    const row = await query
      .select([
        sql<number>`count(*)`.as('request_count'),
        sql<number>`coalesce(sum(input_tokens), 0)`.as('prompt_tokens'),
        sql<number>`coalesce(sum(output_tokens), 0)`.as('completion_tokens'),
        sql<number>`coalesce(sum(total_tokens), 0)`.as('total_tokens'),
        sql<Numeric>`coalesce(sum(cost_usd), 0)`.as('total_cost_usd'),
        sql<Date | string | null>`max(createdat)`.as('last_recorded_at'),
      ])
      .executeTakeFirstOrThrow();

    return {
      requestCount: Number(row.request_count ?? 0),
      promptTokens: Number(row.prompt_tokens ?? 0),
      completionTokens: Number(row.completion_tokens ?? 0),
      totalTokens: Number(row.total_tokens ?? 0),
      totalCostUsd: toRequiredNumber(row.total_cost_usd),
      lastRecordedAt:
        row.last_recorded_at == null
          ? null
          : new Date(row.last_recorded_at).toISOString(),
    };
  },

  async getFeatureBreakdown(
    handle: DbHandle,
    input: AIUsageQueryRange,
  ): Promise<AIUsageFeatureBreakdownRecord[]> {
    let query = handle.selectFrom('app.ai_usage_events').where('owner_userid', '=', input.userId);

    if (input.from) {
      query = query.where('createdat', '>=', new Date(input.from));
    }

    if (input.to) {
      query = query.where('createdat', '<=', new Date(input.to));
    }

    const rows = await query
      .select([
        'feature',
        sql<number>`count(*)`.as('request_count'),
        sql<number>`coalesce(sum(input_tokens), 0)`.as('prompt_tokens'),
        sql<number>`coalesce(sum(output_tokens), 0)`.as('completion_tokens'),
        sql<number>`coalesce(sum(total_tokens), 0)`.as('total_tokens'),
        sql<Numeric>`coalesce(sum(cost_usd), 0)`.as('total_cost_usd'),
      ])
      .groupBy('feature')
      .orderBy(sql`coalesce(sum(cost_usd), 0)`, 'desc')
      .orderBy(sql`coalesce(sum(total_tokens), 0)`, 'desc')
      .execute();

    return rows.map(
      (row): AIUsageFeatureBreakdownRecord => ({
        feature: row.feature as AIUsageFeature,
        requestCount: Number(row.request_count ?? 0),
        promptTokens: Number(row.prompt_tokens ?? 0),
        completionTokens: Number(row.completion_tokens ?? 0),
        totalTokens: Number(row.total_tokens ?? 0),
        totalCostUsd: toRequiredNumber(row.total_cost_usd),
      }),
    );
  },

  async getModelBreakdown(
    handle: DbHandle,
    input: AIUsageQueryRange,
  ): Promise<AIUsageModelBreakdownRecord[]> {
    let query = handle.selectFrom('app.ai_usage_events').where('owner_userid', '=', input.userId);

    if (input.from) {
      query = query.where('createdat', '>=', new Date(input.from));
    }

    if (input.to) {
      query = query.where('createdat', '<=', new Date(input.to));
    }

    const rows = await query
      .select([
        'model',
        sql<number>`count(*)`.as('request_count'),
        sql<number>`coalesce(sum(input_tokens), 0)`.as('prompt_tokens'),
        sql<number>`coalesce(sum(output_tokens), 0)`.as('completion_tokens'),
        sql<number>`coalesce(sum(total_tokens), 0)`.as('total_tokens'),
        sql<Numeric>`coalesce(sum(cost_usd), 0)`.as('total_cost_usd'),
      ])
      .groupBy('model')
      .orderBy(sql`coalesce(sum(cost_usd), 0)`, 'desc')
      .orderBy(sql`coalesce(sum(total_tokens), 0)`, 'desc')
      .execute();

    return rows.map(
      (row): AIUsageModelBreakdownRecord => ({
        model: row.model,
        requestCount: Number(row.request_count ?? 0),
        promptTokens: Number(row.prompt_tokens ?? 0),
        completionTokens: Number(row.completion_tokens ?? 0),
        totalTokens: Number(row.total_tokens ?? 0),
        totalCostUsd: toRequiredNumber(row.total_cost_usd),
      }),
    );
  },
};
