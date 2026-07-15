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
  | 'embedding'
  | 'mcp_tool_call'
  | 'career_resume_convert'
  | 'career_resume_customize'
  | 'career_job_scrape'
  | 'career_skills_derive'
  | 'file_image_analyze'
  | 'file_document_summarize';

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
  durationMs: number | null;
  metadata: unknown;
  createdAt: string;
}

export interface CreateAIUsageEventInput {
  id?: string;
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
  durationMs?: number | null;
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
    userId: row.ownerUserid,
    provider: row.provider,
    feature: row.feature as AIUsageFeature,
    operation: row.operation as AIUsageOperation,
    model: row.model,
    requestId: row.requestId ?? null,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    cachedInputTokens: row.cachedInputTokens,
    reasoningTokens: row.reasoningTokens,
    costUsd: toNullableNumber(row.costUsd),
    durationMs: row.durationMs,
    metadata: row.metadata,
    createdAt: new Date(row.createdat).toISOString(),
  };
}

export const AIUsageEventRepository = {
  async create(handle: DbHandle, input: CreateAIUsageEventInput): Promise<AIUsageEventRecord> {
    const row = await handle
      .insertInto('app.aiUsageEvents')
      .values({
        ...(input.id ? { id: input.id } : {}),
        ownerUserid: input.userId,
        provider: input.provider,
        feature: input.feature,
        operation: input.operation,
        model: input.model,
        requestId: input.requestId ?? null,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens: input.totalTokens,
        cachedInputTokens: input.cachedInputTokens ?? null,
        reasoningTokens: input.reasoningTokens ?? null,
        costUsd: input.costUsd ?? null,
        durationMs: input.durationMs ?? null,
        metadata: input.metadata === undefined ? null : (input.metadata as never),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toAIUsageEventRecord(row as AIUsageEventRow);
  },

  async createIfAbsent(handle: DbHandle, input: CreateAIUsageEventInput): Promise<boolean> {
    const inserted = await handle
      .insertInto('app.aiUsageEvents')
      .values({
        ...(input.id ? { id: input.id } : {}),
        ownerUserid: input.userId,
        provider: input.provider,
        feature: input.feature,
        operation: input.operation,
        model: input.model,
        requestId: input.requestId ?? null,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens: input.totalTokens,
        cachedInputTokens: input.cachedInputTokens ?? null,
        reasoningTokens: input.reasoningTokens ?? null,
        costUsd: input.costUsd ?? null,
        durationMs: input.durationMs ?? null,
        metadata: input.metadata === undefined ? null : (input.metadata as never),
      })
      .onConflict((conflict) => conflict.column('id').doNothing())
      .returning('id')
      .executeTakeFirst();

    return Boolean(inserted?.id);
  },

  async getSummary(handle: DbHandle, input: AIUsageQueryRange): Promise<AIUsageSummaryRecord> {
    let query = handle.selectFrom('app.aiUsageEvents').where('ownerUserid', '=', input.userId);

    if (input.from) {
      query = query.where('createdat', '>=', new Date(input.from).toISOString());
    }

    if (input.to) {
      query = query.where('createdat', '<=', new Date(input.to).toISOString());
    }

    const row = await query
      .select([
        sql<number>`count(*)`.as('requestCount'),
        sql<number>`coalesce(sum(input_tokens), 0)`.as('promptTokens'),
        sql<number>`coalesce(sum(output_tokens), 0)`.as('completionTokens'),
        sql<number>`coalesce(sum(total_tokens), 0)`.as('totalTokens'),
        sql<Numeric>`coalesce(sum(cost_usd), 0)`.as('totalCostUsd'),
        sql<Date | string | null>`max(createdat)`.as('lastRecordedAt'),
      ])
      .executeTakeFirstOrThrow();

    return {
      requestCount: Number(row.requestCount ?? 0),
      promptTokens: Number(row.promptTokens ?? 0),
      completionTokens: Number(row.completionTokens ?? 0),
      totalTokens: Number(row.totalTokens ?? 0),
      totalCostUsd: toRequiredNumber(row.totalCostUsd),
      lastRecordedAt:
        row.lastRecordedAt == null ? null : new Date(row.lastRecordedAt).toISOString(),
    };
  },

  async getFeatureBreakdown(
    handle: DbHandle,
    input: AIUsageQueryRange,
  ): Promise<AIUsageFeatureBreakdownRecord[]> {
    let query = handle.selectFrom('app.aiUsageEvents').where('ownerUserid', '=', input.userId);

    if (input.from) {
      query = query.where('createdat', '>=', new Date(input.from).toISOString());
    }

    if (input.to) {
      query = query.where('createdat', '<=', new Date(input.to).toISOString());
    }

    const rows = await query
      .select([
        'feature',
        sql<number>`count(*)`.as('requestCount'),
        sql<number>`coalesce(sum(input_tokens), 0)`.as('promptTokens'),
        sql<number>`coalesce(sum(output_tokens), 0)`.as('completionTokens'),
        sql<number>`coalesce(sum(total_tokens), 0)`.as('totalTokens'),
        sql<Numeric>`coalesce(sum(cost_usd), 0)`.as('totalCostUsd'),
      ])
      .groupBy('feature')
      .orderBy(sql`coalesce(sum(cost_usd), 0)`, 'desc')
      .orderBy(sql`coalesce(sum(total_tokens), 0)`, 'desc')
      .execute();

    return rows.map(
      (row): AIUsageFeatureBreakdownRecord => ({
        feature: row.feature as AIUsageFeature,
        requestCount: Number(row.requestCount ?? 0),
        promptTokens: Number(row.promptTokens ?? 0),
        completionTokens: Number(row.completionTokens ?? 0),
        totalTokens: Number(row.totalTokens ?? 0),
        totalCostUsd: toRequiredNumber(row.totalCostUsd),
      }),
    );
  },

  async getModelBreakdown(
    handle: DbHandle,
    input: AIUsageQueryRange,
  ): Promise<AIUsageModelBreakdownRecord[]> {
    let query = handle.selectFrom('app.aiUsageEvents').where('ownerUserid', '=', input.userId);

    if (input.from) {
      query = query.where('createdat', '>=', new Date(input.from).toISOString());
    }

    if (input.to) {
      query = query.where('createdat', '<=', new Date(input.to).toISOString());
    }

    const rows = await query
      .select([
        'model',
        sql<number>`count(*)`.as('requestCount'),
        sql<number>`coalesce(sum(input_tokens), 0)`.as('promptTokens'),
        sql<number>`coalesce(sum(output_tokens), 0)`.as('completionTokens'),
        sql<number>`coalesce(sum(total_tokens), 0)`.as('totalTokens'),
        sql<Numeric>`coalesce(sum(cost_usd), 0)`.as('totalCostUsd'),
      ])
      .groupBy('model')
      .orderBy(sql`coalesce(sum(cost_usd), 0)`, 'desc')
      .orderBy(sql`coalesce(sum(total_tokens), 0)`, 'desc')
      .execute();

    return rows.map(
      (row): AIUsageModelBreakdownRecord => ({
        model: row.model,
        requestCount: Number(row.requestCount ?? 0),
        promptTokens: Number(row.promptTokens ?? 0),
        completionTokens: Number(row.completionTokens ?? 0),
        totalTokens: Number(row.totalTokens ?? 0),
        totalCostUsd: toRequiredNumber(row.totalCostUsd),
      }),
    );
  },
};
