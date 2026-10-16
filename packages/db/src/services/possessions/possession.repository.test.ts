import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db } from '../../db';
import { PossessionCategoryRepository } from './category.repository';
import { PossessionRepository } from './possession.repository';

// Covers decision 8 (docs/status-category-mapping.md): writes land on the Still
// lifecycle, and categories collapse onto one managed record per owner.
describe('possession canonicalisation', () => {
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
      .values({ id: userId, name: 'Possession Test User', email: `${userId}@example.com` })
      .execute();
    return userId;
  }

  it('stores the Possessions active state as Owned', async () => {
    const userId = await createUser();
    const record = await PossessionRepository.create(db, userId, {
      name: 'AirPods',
      status: 'in_use',
    });
    expect(record.status).toBe('owned');
    expect(record.isArchived).toBe(false);
  });

  it('archives an end state and keeps the reason in metadata', async () => {
    const userId = await createUser();
    const record = await PossessionRepository.create(db, userId, {
      name: 'Old camera',
      status: 'retired',
    });
    expect(record.status).toBe('owned');
    expect(record.isArchived).toBe(true);
    expect(record.metadata).toMatchObject({ archivedReason: 'retired', archivedFrom: 'retired' });
  });

  it('merges the reason on update without dropping other metadata', async () => {
    const userId = await createUser();
    const created = await PossessionRepository.create(db, userId, {
      name: 'Lamp',
      status: 'owned',
      metadata: { serial: 'X1' },
    });
    const updated = await PossessionRepository.update(db, userId, created.id, {
      status: 'disposed',
    });
    expect(updated.status).toBe('owned');
    expect(updated.isArchived).toBe(true);
    expect(updated.metadata).toMatchObject({ serial: 'X1', archivedReason: 'disposed' });
  });

  it('collapses categories that differ only by case onto one managed record', async () => {
    const userId = await createUser();
    const first = await PossessionRepository.create(db, userId, {
      name: 'Laptop',
      category: 'Technology',
    });
    const second = await PossessionRepository.create(db, userId, {
      name: 'Phone',
      category: 'technology',
    });
    expect(first.category).toBe('Technology');
    expect(second.category).toBe('Technology');

    const categories = await PossessionCategoryRepository.list(db, userId);
    expect(categories.map((category) => category.name)).toEqual(['Technology']);
  });

  it('trims a category before matching it', async () => {
    const userId = await createUser();
    await PossessionCategoryRepository.resolve(db, userId, '  Outdoors  ');
    const again = await PossessionCategoryRepository.resolve(db, userId, 'outdoors');
    expect(again.name).toBe('Outdoors');
    expect(await PossessionCategoryRepository.list(db, userId)).toHaveLength(1);
  });
});
