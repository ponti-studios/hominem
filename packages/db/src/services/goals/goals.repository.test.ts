import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db } from '../../db';
import { NotFoundError } from '../../errors';
import { GoalsRepository } from './goals.repository';

describe('GoalsRepository', () => {
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
        .values({ id, name: 'Goals test', email: `${id}@example.com` })
        .execute();
    }
    return ids;
  }

  it('creates with defaults and lists owner-scoped', async () => {
    const [owner, other] = await createUsers(2);

    const goal = await GoalsRepository.create(db, { userId: owner, title: 'Build a cushion' });
    expect(goal).toMatchObject({
      ownerUserId: owner,
      title: 'Build a cushion',
      description: null,
      status: 'active',
      domains: [],
      targetAt: null,
    });

    const owned = await GoalsRepository.listByOwner(db, { userId: owner });
    expect(owned.map((row) => row.id)).toEqual([goal.id]);
    expect(await GoalsRepository.listByOwner(db, { userId: other })).toEqual([]);
  });

  it('round-trips domains, description, status and targetAt', async () => {
    const [owner] = await createUsers(1);

    const goal = await GoalsRepository.create(db, {
      userId: owner,
      title: 'Find a better role',
      description: 'Senior staff engineering roles',
      status: 'paused',
      domains: ['career'],
      targetAt: '2027-06-01T00:00:00.000Z',
    });
    expect(goal.domains).toEqual(['career']);
    expect(goal.status).toBe('paused');
    expect(goal.targetAt).toBe('2027-06-01T00:00:00.000Z');

    const fetched = await GoalsRepository.getOwned(db, { id: goal.id, userId: owner });
    expect(fetched).toEqual(goal);
  });

  it('updates only within the owner scope', async () => {
    const [owner] = await createUsers(1);
    const goal = await GoalsRepository.create(db, {
      userId: owner,
      title: 'Stay inside the monthly plan',
      domains: ['finance'],
    });

    const renamed = await GoalsRepository.update(db, {
      id: goal.id,
      userId: owner,
      title: 'Stay inside the monthly plan (November)',
      status: 'achieved',
      domains: ['finance', 'career'],
    });
    expect(renamed.title).toBe('Stay inside the monthly plan (November)');
    expect(renamed.status).toBe('achieved');
    expect(renamed.domains).toEqual(['finance', 'career']);
  });

  it('throws NotFoundError on updates of missing or unowned goals', async () => {
    const [owner, other] = await createUsers(2);
    const goal = await GoalsRepository.create(db, { userId: owner, title: 'A goal' });

    await expect(
      GoalsRepository.update(db, { id: goal.id, userId: other, title: 'nope' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      GoalsRepository.update(db, { id: randomUUID(), userId: owner, title: 'nope' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes only within the owner scope', async () => {
    const [owner, other] = await createUsers(2);
    const goal = await GoalsRepository.create(db, { userId: owner, title: 'Temporary' });

    expect(await GoalsRepository.delete(db, { id: goal.id, userId: other })).toBe(false);
    expect(await GoalsRepository.getOwned(db, { id: goal.id, userId: owner })).not.toBeNull();

    expect(await GoalsRepository.delete(db, { id: goal.id, userId: owner })).toBe(true);
    expect(await GoalsRepository.getOwned(db, { id: goal.id, userId: owner })).toBeNull();
  });

  it('rejects blank titles at the database level', async () => {
    const [owner] = await createUsers(1);
    await expect(GoalsRepository.create(db, { userId: owner, title: '   ' })).rejects.toThrow();
  });

  it('lists each owner with an active goal once', async () => {
    const [owner, other] = await createUsers(2);
    await GoalsRepository.create(db, { userId: owner, title: 'Active one' });
    await GoalsRepository.create(db, { userId: owner, title: 'Active two' });
    await GoalsRepository.create(db, { userId: other, title: 'Paused', status: 'paused' });

    const owners = await GoalsRepository.listActiveOwnerIds(db);
    expect(owners.filter((id) => id === owner)).toEqual([owner]);
    expect(owners).not.toContain(other);
  });
});
