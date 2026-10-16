import { randomUUID } from 'node:crypto';

import { authDb, db } from '@hominem/db/core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createTravelResidence,
  deleteTravelResidence,
  getTravelResidence,
  updateTravelResidence,
} from './travel-residences.service';

describe('travel residences', () => {
  const owners: string[] = [];
  afterEach(async () => {
    for (const owner of owners.splice(0))
      await authDb.deleteFrom('user').where('id', '=', owner).execute();
  });

  it('creates, updates, and deletes an owned residence with audit snapshots', async () => {
    const owner = randomUUID();
    owners.push(owner);
    await authDb
      .insertInto('user')
      .values({ id: owner, name: 'Residence test', email: `${owner}@example.com` })
      .execute();
    const [place] = await db
      .insertInto('app.travelPlaces')
      .values({
        ownerUserid: owner,
        legacyId: 'PLC-HOME',
        place: 'London',
        country: 'UK',
        type: 'city',
        status: 'Visited',
      })
      .returning('id')
      .execute();
    const periods = [
      { startDate: '2026-09-23', endDate: null, ongoing: true, precision: 'day' as const },
    ];

    const created = await createTravelResidence(owner, {
      placeId: place!.id,
      legacyId: 'PLC-HOME-RES',
      periods,
    });
    expect(created?.periods).toEqual(periods);
    await updateTravelResidence(owner, {
      id: created!.id,
      periods: [
        ...periods,
        { startDate: '2017-01-01', endDate: null, ongoing: false, precision: 'month' },
      ],
    });
    expect((await getTravelResidence(owner, { id: created!.id }))?.periods).toHaveLength(2);
    await deleteTravelResidence(owner, created!.id);
    expect(await getTravelResidence(owner, { id: created!.id })).toBeNull();
    await expect(
      db
        .selectFrom('app.travelEntityHistory')
        .select('operation')
        .where('entityId', '=', created!.id)
        .orderBy('createdAt')
        .execute(),
    ).resolves.toEqual([{ operation: 'create' }, { operation: 'update' }, { operation: 'delete' }]);
  });

  it('refuses a second ongoing home without inserting it', async () => {
    const owner = randomUUID();
    owners.push(owner);
    await authDb
      .insertInto('user')
      .values({ id: owner, name: 'Current home test', email: `${owner}@example.com` })
      .execute();
    const places = await db
      .insertInto('app.travelPlaces')
      .values([
        {
          ownerUserid: owner,
          legacyId: 'PLC-CURRENT-1',
          place: 'London',
          country: 'UK',
          type: 'city',
          status: 'Visited',
        },
        {
          ownerUserid: owner,
          legacyId: 'PLC-CURRENT-2',
          place: 'Los Angeles',
          country: 'USA',
          type: 'city',
          status: 'Visited',
        },
      ])
      .returning('id')
      .execute();
    const periods = [
      { startDate: '2026-09-23', endDate: null, ongoing: true, precision: 'day' as const },
    ];
    await createTravelResidence(owner, { placeId: places[0]!.id, periods });

    await expect(
      createTravelResidence(owner, { placeId: places[1]!.id, periods }),
    ).rejects.toMatchObject({
      message: 'multiple_current_homes',
    });
    const count = await db
      .selectFrom('app.travelResidences')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('ownerUserid', '=', owner)
      .executeTakeFirstOrThrow();
    expect(Number(count.count)).toBe(1);
  });
});
