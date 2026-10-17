import { randomUUID } from 'node:crypto';

import { authDb, db } from '@hominem/db/core';
import { afterEach, describe, expect, it } from 'vitest';

import { writeTravelEntity } from './travel-write.service';

function entityId(entity: unknown): string {
  if (!entity || typeof entity !== 'object' || !('id' in entity))
    throw new Error('missing_entity_id');
  return String(entity.id);
}

describe('travel write service', () => {
  const owners: string[] = [];
  afterEach(async () => {
    for (const owner of owners.splice(0))
      await authDb.deleteFrom('user').where('id', '=', owner).execute();
  });

  async function owner() {
    const id = randomUUID();
    owners.push(id);
    await authDb
      .insertInto('user')
      .values({ id, name: 'Travel writer', email: `${id}@test.hominem.dev`, emailVerified: true })
      .execute();
    return id;
  }

  it('projects dry runs, makes create retries idempotent, and records audit history', async () => {
    const userId = await owner();
    const preview = await writeTravelEntity(userId, 'journey', 'create', {
      name: 'ZZZ Probe journey',
      dryRun: true,
    });
    expect(preview).toMatchObject({ action: 'created', created: 1 });
    expect(
      await db
        .selectFrom('app.travelJourneys')
        .select('id')
        .where('ownerUserid', '=', userId)
        .execute(),
    ).toHaveLength(0);

    const created = await writeTravelEntity(userId, 'journey', 'create', {
      name: 'ZZZ Probe journey',
    });
    expect(created).toMatchObject({ action: 'created', created: 1 });
    const id = entityId(created.entity);
    const retry = await writeTravelEntity(userId, 'journey', 'create', {
      name: 'ZZZ Probe journey',
    });
    expect(retry).toMatchObject({ action: 'unchanged', unchanged: 1 });

    const updated = await writeTravelEntity(userId, 'journey', 'update', {
      id,
      name: 'ZZZ Probe updated journey',
    });
    expect(updated).toMatchObject({ action: 'updated', updated: 1 });
    const stale = await writeTravelEntity(userId, 'journey', 'update', {
      id,
      name: 'stale',
      ifUpdatedAt: new Date(0).toISOString(),
    });
    expect(stale).toMatchObject({ reason: 'version_conflict' });
    expect(
      await db
        .selectFrom('app.travelEntityHistory')
        .select('id')
        .where('entityId', '=', id)
        .execute(),
    ).toHaveLength(2);
  });

  it('does not expose or update another owner’s entity', async () => {
    const userId = await owner();
    const otherId = await owner();
    const created = await writeTravelEntity(userId, 'idea', 'create', {
      idea: 'ZZZ Probe idea',
      type: 'experience',
      status: 'open',
    });
    const id = entityId(created.entity);
    expect(
      await writeTravelEntity(otherId, 'idea', 'update', { id, idea: 'stolen' }),
    ).toMatchObject({ entity: null, action: 'notFound' });
    expect(
      await db.selectFrom('app.travelIdeas').select('idea').where('id', '=', id).executeTakeFirst(),
    ).toMatchObject({ idea: 'ZZZ Probe idea' });
  });
});
