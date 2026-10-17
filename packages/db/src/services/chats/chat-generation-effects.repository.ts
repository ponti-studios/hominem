import type { Selectable } from 'kysely';
import { sql } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppChatGenerationEffects, Json } from '../../types/database';

type ChatGenerationEffectRow = Selectable<AppChatGenerationEffects>;

export type ChatGenerationEffectType = 'chat_embedding' | 'speech_run_persist';
export type ChatGenerationEffectStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ChatGenerationEffectRecord {
  id: string;
  generationId: string | null;
  ownerUserId: string;
  effectType: ChatGenerationEffectType;
  effectKey: string;
  payload: Json;
  status: ChatGenerationEffectStatus;
  attempts: number;
}

export interface CreateChatGenerationEffectInput {
  generationId: string;
  ownerUserId: string;
  effectType: ChatGenerationEffectType;
  effectKey: string;
  payload: Json;
}

function parseEffectType(value: string): ChatGenerationEffectType {
  if (value === 'chat_embedding' || value === 'speech_run_persist') return value;
  throw new Error('Invalid chat generation effect type');
}

function parseEffectStatus(value: string): ChatGenerationEffectStatus {
  if (
    value === 'pending' ||
    value === 'processing' ||
    value === 'completed' ||
    value === 'failed'
  ) {
    return value;
  }
  throw new Error('Invalid chat generation effect status');
}

function toRecord(row: ChatGenerationEffectRow): ChatGenerationEffectRecord {
  return {
    id: row.id,
    generationId: row.generationId,
    ownerUserId: row.ownerUserId,
    effectType: parseEffectType(row.effectType),
    effectKey: row.effectKey,
    payload: row.payload,
    status: parseEffectStatus(row.status),
    attempts: row.attempts,
  };
}

export const ChatGenerationEffectsRepository = {
  async createPending(
    handle: DbHandle,
    inputs: readonly CreateChatGenerationEffectInput[],
  ): Promise<ChatGenerationEffectRecord[]> {
    if (inputs.length === 0) return [];

    await handle
      .insertInto('app.chatGenerationEffects')
      .values(
        inputs.map((input) => ({
          generationId: input.generationId,
          ownerUserId: input.ownerUserId,
          effectType: input.effectType,
          effectKey: input.effectKey,
          payload: input.payload,
        })),
      )
      .onConflict((conflict) =>
        conflict.columns(['generationId', 'effectType', 'effectKey']).doNothing(),
      )
      .execute();

    const rows = await handle
      .selectFrom('app.chatGenerationEffects')
      .selectAll()
      .where('generationId', '=', inputs[0]!.generationId)
      .where(
        'effectKey',
        'in',
        inputs.map((input) => input.effectKey),
      )
      .where(
        'effectType',
        'in',
        inputs.map((input) => input.effectType),
      )
      .orderBy('createdAt', 'asc')
      .execute();

    return rows.map(toRecord);
  },

  async listReady(handle: DbHandle, limit = 100): Promise<string[]> {
    const rows = await handle
      .selectFrom('app.chatGenerationEffects')
      .select('id')
      .where(
        sql<boolean>`((status = 'pending' AND next_attempt_at <= now()) OR
          (status = 'processing' AND locked_at < now() - interval '5 minutes'))`,
      )
      .orderBy('nextAttemptAt', 'asc')
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .execute();
    return rows.map((row) => row.id);
  },

  async claim(handle: DbHandle, id: string): Promise<ChatGenerationEffectRecord | null> {
    const query = handle
      .updateTable('app.chatGenerationEffects')
      .set((eb) => ({
        status: 'processing',
        attempts: eb('attempts', '+', 1),
        lockedAt: sql<Date>`now()`,
      }))
      .where('id', '=', id);
    const row = await query
      .where(
        sql<boolean>`((status = 'pending' AND next_attempt_at <= now()) OR
          (status = 'processing' AND locked_at < now() - interval '5 minutes'))`,
      )
      .returningAll()
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  },

  async complete(handle: DbHandle, id: string): Promise<void> {
    await handle
      .updateTable('app.chatGenerationEffects')
      .set({ status: 'completed', lockedAt: null, lastError: null })
      .where('id', '=', id)
      .where('status', '=', 'processing')
      .execute();
  },

  async retry(handle: DbHandle, id: string, errorName: string): Promise<void> {
    await handle
      .updateTable('app.chatGenerationEffects')
      .set((eb) => ({
        status: eb.case().when('attempts', '>=', 10).then('failed').else('pending').end(),
        nextAttemptAt: sql<Date>`now() + make_interval(secs => LEAST(300, power(2, ${eb.ref('attempts')})::int * 5))`,
        lockedAt: null,
        lastError: errorName.slice(0, 80),
      }))
      .where('id', '=', id)
      .where('status', '=', 'processing')
      .execute();
  },
};
