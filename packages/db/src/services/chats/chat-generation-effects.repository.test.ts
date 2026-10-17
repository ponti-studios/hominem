import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db } from '../../db';
import { ChatGenerationEffectsRepository } from './chat-generation-effects.repository';

describe('ChatGenerationEffectsRepository', () => {
  const userIds: string[] = [];

  afterEach(async () => {
    for (const userId of userIds.splice(0)) {
      await authDb.deleteFrom('user').where('id', '=', userId).execute();
    }
  });

  it('records effects with a generation and claims each effect once', async () => {
    const userId = randomUUID();
    const chatId = randomUUID();
    const generationId = randomUUID();
    userIds.push(userId);

    await authDb
      .insertInto('user')
      .values({ id: userId, name: 'Generation Effects User', email: `${userId}@example.com` })
      .execute();
    await db
      .insertInto('app.chats')
      .values({ id: chatId, ownerUserid: userId, title: 'Effects test' })
      .execute();
    await db
      .insertInto('app.chatGenerationRuns')
      .values({ id: generationId, chatId, ownerUserId: userId, kind: 'send', status: 'saving' })
      .execute();

    const [effect] = await ChatGenerationEffectsRepository.createPending(db, [
      {
        generationId,
        ownerUserId: userId,
        effectType: 'chat_embedding',
        effectKey: '1',
        payload: { chatId },
      },
    ]);

    expect(effect).toMatchObject({
      generationId,
      ownerUserId: userId,
      effectType: 'chat_embedding',
      effectKey: '1',
      payload: { chatId },
      status: 'pending',
      attempts: 0,
    });
    expect(await ChatGenerationEffectsRepository.listReady(db)).toContain(effect?.id);
    await expect(ChatGenerationEffectsRepository.claim(db, effect!.id)).resolves.toMatchObject({
      id: effect!.id,
      status: 'processing',
      attempts: 1,
    });
    await expect(ChatGenerationEffectsRepository.claim(db, effect!.id)).resolves.toBeNull();

    await ChatGenerationEffectsRepository.complete(db, effect!.id);
    expect(await ChatGenerationEffectsRepository.listReady(db)).not.toContain(effect?.id);

    const [nextEffect] = await ChatGenerationEffectsRepository.createPending(db, [
      {
        generationId,
        ownerUserId: userId,
        effectType: 'chat_embedding',
        effectKey: '2',
        payload: { chatId },
      },
    ]);
    expect(nextEffect?.id).not.toBe(effect?.id);
    expect(nextEffect?.effectKey).toBe('2');
  });

  it('does not claim a stale effect when claiming another effect by id', async () => {
    const userId = randomUUID();
    const chatId = randomUUID();
    const generationId = randomUUID();
    userIds.push(userId);

    await authDb
      .insertInto('user')
      .values({ id: userId, name: 'Generation Effects User', email: `${userId}@example.com` })
      .execute();
    await db
      .insertInto('app.chats')
      .values({ id: chatId, ownerUserid: userId, title: 'Effects claim test' })
      .execute();
    await db
      .insertInto('app.chatGenerationRuns')
      .values({ id: generationId, chatId, ownerUserId: userId, kind: 'send', status: 'saving' })
      .execute();

    const effects = await ChatGenerationEffectsRepository.createPending(
      db,
      ['target', 'stale'].map((effectKey) => ({
        generationId,
        ownerUserId: userId,
        effectType: 'chat_embedding' as const,
        effectKey,
        payload: { chatId },
      })),
    );
    const target = effects.find((effect) => effect.effectKey === 'target')!;
    const stale = effects.find((effect) => effect.effectKey === 'stale')!;
    await db
      .updateTable('app.chatGenerationEffects')
      .set({ status: 'processing', lockedAt: new Date(Date.now() - 10 * 60_000), attempts: 4 })
      .where('id', '=', stale.id)
      .execute();

    await expect(ChatGenerationEffectsRepository.claim(db, target.id)).resolves.toMatchObject({
      id: target.id,
      attempts: 1,
    });
    const staleAfterClaim = await db
      .selectFrom('app.chatGenerationEffects')
      .select(['status', 'attempts'])
      .where('id', '=', stale.id)
      .executeTakeFirstOrThrow();
    expect(staleAfterClaim).toEqual({ status: 'processing', attempts: 4 });
  });
});
