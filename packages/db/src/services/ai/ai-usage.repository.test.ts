import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db, sql } from '../../db';
import { AIUsageEventRepository } from './ai-usage.repository';

const runIntegration = describe;

runIntegration('AIUsageEventRepository', () => {
  const userIds: string[] = [];

  afterEach(async () => {
    for (const userId of userIds.splice(0)) {
      await authDb.deleteFrom('user').where('id', '=', userId).execute();
    }
  });

  async function createUser() {
    const userId = randomUUID();
    userIds.push(userId);
    await authDb
      .insertInto('user')
      .values({
        id: userId,
        name: 'AI Usage Test User',
        email: `${userId}@example.com`,
      })
      .execute();
    return userId;
  }

  it('writes a given event id only once', async () => {
    const userId = await createUser();
    const eventId = randomUUID();

    expect(
      await AIUsageEventRepository.createIfAbsent(db, {
        id: eventId,
        userId,
        provider: 'openrouter',
        feature: 'career_resume_convert',
        operation: 'structured_output',
        model: 'model',
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        costUsd: 0.15,
      }),
    ).toBe(true);

    expect(
      await AIUsageEventRepository.createIfAbsent(db, {
        id: eventId,
        userId,
        provider: 'openrouter',
        feature: 'career_resume_convert',
        operation: 'structured_output',
        model: 'model',
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        costUsd: 0.15,
      }),
    ).toBe(false);

    const row = await db
      .selectFrom('app.aiUsageEvents')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('id', '=', eventId)
      .executeTakeFirstOrThrow();

    expect(Number(row.count)).toBe(1);
  });

  it('stores distinct provider invocations separately and supports new feature values', async () => {
    const userId = await createUser();

    await AIUsageEventRepository.createIfAbsent(db, {
      id: randomUUID(),
      userId,
      provider: 'openrouter',
      feature: 'career_job_scrape',
      operation: 'structured_output',
      model: 'model-a',
      inputTokens: 2,
      outputTokens: 1,
      totalTokens: 3,
      costUsd: 0.02,
    });
    await AIUsageEventRepository.createIfAbsent(db, {
      id: randomUUID(),
      userId,
      provider: 'openrouter',
      feature: 'mcp_tool_call',
      operation: 'chat_completion',
      model: 'model-b',
      inputTokens: 4,
      outputTokens: 2,
      totalTokens: 6,
      costUsd: 0.03,
    });

    const featureBreakdown = await AIUsageEventRepository.getFeatureBreakdown(db, { userId });
    expect(featureBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ feature: 'career_job_scrape', requestCount: 1 }),
        expect.objectContaining({ feature: 'mcp_tool_call', requestCount: 1 }),
      ]),
    );

    const mcpToday = await db
      .selectFrom('app.aiUsageEvents')
      .select(sql<number>`count(*)`.as('count'))
      .where('ownerUserid', '=', userId)
      .where('feature', '=', 'mcp_tool_call')
      .where(sql<boolean>`createdat::date = current_date`)
      .executeTakeFirstOrThrow();

    expect(Number(mcpToday.count)).toBe(1);
  });
});
