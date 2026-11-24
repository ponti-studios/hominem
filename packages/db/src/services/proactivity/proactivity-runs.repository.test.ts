import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db } from '../../db';
import { ProactivityRunsRepository } from './proactivity-runs.repository';

function runDocument(ownerId: string, triggerId: string, processedAt: string) {
  return {
    ownerId,
    triggerId,
    processedAt,
    evaluations: [
      {
        ownerId,
        triggerId,
        goalId: '11111111-1111-4111-8111-111111111111',
        evaluatedAt: processedAt,
        decision: { kind: 'quiet', reason: 'Nothing material changed.', evidenceIds: [] },
      },
    ],
    deliveryIntents: [],
  };
}

describe('ProactivityRunsRepository', () => {
  const users: string[] = [];

  afterEach(async () => {
    for (const id of users.splice(0))
      await authDb.deleteFrom('user').where('id', '=', id).execute();
  });

  async function createUsers(count: number): Promise<string[]> {
    const ids = Array.from({ length: count }, () => randomUUID());
    users.push(...ids);
    for (const id of ids) {
      await authDb
        .insertInto('user')
        .values({ id, name: 'Proactivity runs test', email: `${id}@example.com` })
        .execute();
    }
    return ids;
  }

  it('stores a run and reads it back by trigger and as the latest', async () => {
    const [owner] = await createUsers(1);
    const processedAt = '2026-11-24T09:00:00.000Z';
    const document = runDocument(owner, 'scheduled-2026-11-24', processedAt);

    const stored = await ProactivityRunsRepository.commit(db, {
      ownerId: owner,
      triggerId: 'scheduled-2026-11-24',
      processedAt,
      run: document,
    });
    expect(stored).toMatchObject({
      ownerUserId: owner,
      triggerId: 'scheduled-2026-11-24',
      processedAt,
      run: document,
    });

    const found = await ProactivityRunsRepository.findByTrigger(db, {
      userId: owner,
      triggerId: 'scheduled-2026-11-24',
    });
    expect(found?.run).toEqual(document);

    const latest = await ProactivityRunsRepository.latestForOwner(db, { userId: owner });
    expect(latest?.id).toBe(stored.id);
  });

  it('is idempotent per owner and trigger, returning the first stored run', async () => {
    const [owner] = await createUsers(1);
    const first = runDocument(owner, 'manual-1', '2026-11-24T09:00:00.000Z');
    const replay = runDocument(owner, 'manual-1', '2026-11-25T09:00:00.000Z');

    const created = await ProactivityRunsRepository.commit(db, {
      ownerId: owner,
      triggerId: 'manual-1',
      processedAt: '2026-11-24T09:00:00.000Z',
      run: first,
    });
    const replayed = await ProactivityRunsRepository.commit(db, {
      ownerId: owner,
      triggerId: 'manual-1',
      processedAt: '2026-11-25T09:00:00.000Z',
      run: replay,
    });

    expect(replayed.id).toBe(created.id);
    expect(replayed.processedAt).toBe('2026-11-24T09:00:00.000Z');
    expect(replayed.run).toEqual(first);
  });

  it('keeps owners apart and reports the newest run for each', async () => {
    const [owner, other] = await createUsers(2);
    await ProactivityRunsRepository.commit(db, {
      ownerId: owner,
      triggerId: 'scheduled-2026-11-24',
      processedAt: '2026-11-24T09:00:00.000Z',
      run: runDocument(owner, 'scheduled-2026-11-24', '2026-11-24T09:00:00.000Z'),
    });
    await ProactivityRunsRepository.commit(db, {
      ownerId: owner,
      triggerId: 'scheduled-2026-11-25',
      processedAt: '2026-11-25T09:00:00.000Z',
      run: runDocument(owner, 'scheduled-2026-11-25', '2026-11-25T09:00:00.000Z'),
    });
    await ProactivityRunsRepository.commit(db, {
      ownerId: other,
      triggerId: 'scheduled-2026-11-24',
      processedAt: '2026-11-24T10:00:00.000Z',
      run: runDocument(other, 'scheduled-2026-11-24', '2026-11-24T10:00:00.000Z'),
    });

    const latest = await ProactivityRunsRepository.latestForOwner(db, { userId: owner });
    expect(latest?.triggerId).toBe('scheduled-2026-11-25');
    expect(
      await ProactivityRunsRepository.findByTrigger(db, {
        userId: other,
        triggerId: 'scheduled-2026-11-25',
      }),
    ).toBeNull();
  });
});
