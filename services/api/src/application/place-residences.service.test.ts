import { randomUUID } from 'node:crypto';

import { authDb, db } from '@hominem/db/core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createPlaceResidence,
  deletePlaceResidence,
  updatePlaceResidence,
} from './place-residences.service';

describe('travel residence writes', () => {
  const owners: string[] = [];
  afterEach(async () => {
    for (const owner of owners.splice(0))
      await authDb.deleteFrom('user').where('id', '=', owner).execute();
  });

  async function fixture() {
    const owner = randomUUID();
    owners.push(owner);
    await authDb
      .insertInto('user')
      .values({
        id: owner,
        name: 'Residence probe',
        email: `${owner}@test.hominem.dev`,
        emailVerified: true,
      })
      .execute();
    const [place] = await db
      .insertInto('app.places')
      .values({
        ownerUserid: owner,
        name: 'ZZZ Residence probe',
        country: 'ZZZ Probe',
        placeType: 'city',
      })
      .returning('id')
      .execute();
    const [otherPlace] = await db
      .insertInto('app.places')
      .values({
        ownerUserid: owner,
        name: 'ZZZ Other residence probe',
        country: 'ZZZ Probe',
        placeType: 'city',
      })
      .returning('id')
      .execute();
    return { owner, placeId: place!.id, otherPlaceId: otherPlace!.id };
  }

  const period = {
    startDate: '2020-01-01',
    endDate: null,
    ongoing: true,
    precision: 'day' as const,
  };

  it('returns timestamps, serializes current-home writes, and rejects multiple ongoing periods', async () => {
    const { owner, placeId, otherPlaceId } = await fixture();
    await expect(
      createPlaceResidence(owner, {
        placeId,
        periods: [period, { ...period, startDate: '2021-01-01' }],
        dryRun: true,
      }),
    ).rejects.toThrow('multiple_current_periods');
    const results = await Promise.allSettled([
      createPlaceResidence(owner, { placeId, periods: [period] }),
      createPlaceResidence(owner, { placeId, periods: [period] }),
      createPlaceResidence(owner, { placeId: otherPlaceId, periods: [period] }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const created = results.find(
      (result) => result.status === 'fulfilled' && result.value.created === 1,
    );
    if (!created || created.status !== 'fulfilled') throw new Error('Expected one residence');
    expect(created.value).toMatchObject({
      created: 1,
      updated: 0,
      unchanged: 0,
      residence: { createdAt: expect.anything(), updatedAt: expect.anything() },
    });
  });

  it('uses version predicates for update/delete and reports projected dry-run creates', async () => {
    const { owner, placeId } = await fixture();
    const preview = await createPlaceResidence(owner, {
      placeId,
      periods: [{ ...period, ongoing: false, endDate: '2020-02-01' }],
      dryRun: true,
    });
    expect(preview).toMatchObject({
      created: 1,
      updated: 0,
      unchanged: 0,
      residence: { createdAt: expect.any(String), updatedAt: expect.any(String) },
    });
    const residence = await createPlaceResidence(owner, {
      placeId,
      periods: [{ ...period, ongoing: false, endDate: '2020-02-01' }],
    });
    if (!residence.residence) throw new Error('Expected residence');
    const duplicate = await createPlaceResidence(owner, {
      placeId,
      periods: [{ ...period, ongoing: false, endDate: '2020-02-01' }],
    });
    expect(duplicate).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    const projectedUpdate = await updatePlaceResidence(owner, {
      id: residence.residence.id,
      notes: 'projected',
      dryRun: true,
    });
    expect(projectedUpdate).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
    const updated = await updatePlaceResidence(owner, {
      id: residence.residence.id,
      notes: 'saved',
      ifUpdatedAt: residence.residence.updatedAt,
    });
    expect(updated).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
    const unchanged = await updatePlaceResidence(owner, {
      id: residence.residence.id,
      notes: 'saved',
    });
    expect(unchanged).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    await expect(
      updatePlaceResidence(owner, {
        id: residence.residence.id,
        notes: 'stale',
        ifUpdatedAt: '2000-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('version_conflict');
    await expect(
      deletePlaceResidence(owner, {
        id: residence.residence.id,
        ifUpdatedAt: '2000-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('version_conflict');
    const stillThere = await db
      .selectFrom('app.placeResidences')
      .select('id')
      .where('id', '=', residence.residence.id)
      .executeTakeFirst();
    expect(stillThere?.id).toBe(residence.residence.id);
    await expect(
      deletePlaceResidence(owner, {
        id: residence.residence.id,
        ifUpdatedAt: updated.residence?.updatedAt,
      }),
    ).resolves.toMatchObject({ deleted: true });
  });
});
