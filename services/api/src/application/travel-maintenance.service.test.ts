import { randomUUID } from 'node:crypto';

import { authDb, db } from '@hominem/db/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { travelSegmentMergeInputSchema } from '../schemas/travel-maintenance.schema';
import {
  mergeTravelSegments,
  reorderTravelSegments,
  saveTravelJourney,
} from './travel-maintenance.service';

describe('travel atomic maintenance', () => {
  const owners: string[] = [];
  beforeAll(async () => {
    await db
      .insertInto('app.travelAirportReference')
      .values([
        {
          sourceId: 982001,
          code: 'LHR',
          name: 'Heathrow',
          city: 'London',
          country: 'GB',
          type: 'large_airport',
          latitude: 51.47,
          longitude: -0.4543,
        },
        {
          sourceId: 982002,
          code: 'KEF',
          name: 'Keflavik',
          city: 'Reykjavik',
          country: 'IS',
          type: 'large_airport',
          latitude: 63.985,
          longitude: -22.6056,
        },
      ])
      .onConflict((conflict) => conflict.column('sourceId').doNothing())
      .execute();
  });
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
        name: 'Travel workflow',
        email: `${owner}@test.hominem.dev`,
        emailVerified: true,
      })
      .execute();
    const [place] = await db
      .insertInto('app.places')
      .values({
        ownerUserid: owner,
        name: 'ZZZ Probe City',
        country: 'ZZZ Probe Country',
        placeType: 'city',
      })
      .returning('id')
      .execute();
    return { owner, placeId: place!.id };
  }

  it('keeps a dossier dry run side-effect free and saves it atomically', async () => {
    const { owner, placeId } = await fixture();
    const payload = {
      journey: { name: 'ZZZ Probe dossier' },
      segments: [{ seq: 1, placeId }],
      transport: [],
      stays: [],
      dryRun: true,
    };
    expect(await saveTravelJourney(owner, payload)).toMatchObject({
      dryRun: true,
      counters: { journeys: { created: 1 }, segments: { created: 1 } },
    });
    expect(
      await db
        .selectFrom('app.travelJourneys')
        .select('id')
        .where('ownerUserid', '=', owner)
        .execute(),
    ).toHaveLength(0);
    const actual = await saveTravelJourney(owner, { ...payload, dryRun: false });
    expect(actual).toMatchObject({
      counters: { journeys: { created: 1 }, segments: { created: 1 } },
    });
    const replay = await saveTravelJourney(owner, { ...payload, dryRun: false });
    expect(replay).toMatchObject({
      counters: {
        journeys: { created: 0, unchanged: 1 },
        segments: { created: 0, unchanged: 1 },
      },
    });
    expect(
      await db
        .selectFrom('app.travelJourneySegments')
        .select('id')
        .where('ownerUserid', '=', owner)
        .execute(),
    ).toHaveLength(1);
  });

  it('validates airport codes and saves a journey transport leg', async () => {
    const { owner } = await fixture();
    await db
      .insertInto('app.travelAirports')
      .values([
        {
          ownerUserid: owner,
          code: 'LHR',
          name: 'Heathrow',
          servesPlace: 'London',
          city: 'London',
          country: 'UK',
        },
        {
          ownerUserid: owner,
          code: 'KEF',
          name: 'Keflavik',
          servesPlace: 'Reykjavik',
          city: 'Reykjavik',
          country: 'Iceland',
        },
      ])
      .execute();

    const result = await saveTravelJourney(owner, {
      journey: { name: 'ZZZ LHR to KEF probe' },
      segments: [],
      transport: [{ mode: 'air', origin: 'LHR', destination: 'KEF' }],
      stays: [],
      dryRun: false,
    });

    expect(result).toMatchObject({ counters: { transport: { created: 1 } } });
    await expect(
      db
        .selectFrom('app.travelTransport')
        .select(['origin', 'destination'])
        .where('ownerUserid', '=', owner)
        .execute(),
    ).resolves.toEqual([{ origin: 'LHR', destination: 'KEF' }]);
  });

  it('reorders the complete segment list without sequence conflicts', async () => {
    const { owner, placeId } = await fixture();
    const [journey] = await db
      .insertInto('app.travelJourneys')
      .values({ ownerUserid: owner, name: 'ZZZ Probe order' })
      .returning('id')
      .execute();
    const segments = await db
      .insertInto('app.travelJourneySegments')
      .values([
        { ownerUserid: owner, journeyId: journey!.id, seq: 1, placeId },
        { ownerUserid: owner, journeyId: journey!.id, seq: 2, placeId },
      ])
      .returning(['id', 'seq'])
      .execute();
    expect(
      await reorderTravelSegments(owner, {
        journeyId: journey!.id,
        order: [segments[1]!.id, segments[0]!.id],
        dryRun: false,
      }),
    ).toMatchObject({ reordered: true });
    expect(
      await db
        .selectFrom('app.travelJourneySegments')
        .select(['id', 'seq'])
        .where('journeyId', '=', journey!.id)
        .orderBy('seq')
        .execute(),
    ).toEqual([
      { id: segments[1]!.id, seq: 1 },
      { id: segments[0]!.id, seq: 2 },
    ]);
  });

  it('rejects self merges and widens merged segment dates using both rows', async () => {
    const { owner, placeId } = await fixture();
    const [journey] = await db
      .insertInto('app.travelJourneys')
      .values({ ownerUserid: owner, name: 'ZZZ Probe merge' })
      .returning('id')
      .execute();
    const segments = await db
      .insertInto('app.travelJourneySegments')
      .values([
        {
          ownerUserid: owner,
          journeyId: journey!.id,
          seq: 1,
          placeId,
          arrivalDate: '2026-05-04',
          departureDate: '2026-05-06',
        },
        {
          ownerUserid: owner,
          journeyId: journey!.id,
          seq: 2,
          placeId,
          arrivalDate: '2026-05-01',
          departureDate: '2026-05-10',
        },
      ])
      .returning(['id'])
      .execute();
    expect(
      travelSegmentMergeInputSchema.safeParse({
        fromSegmentId: segments[0]!.id,
        intoSegmentId: segments[0]!.id,
        iUnderstand: true,
      }).success,
    ).toBe(false);
    await mergeTravelSegments(owner, {
      fromSegmentId: segments[0]!.id,
      intoSegmentId: segments[1]!.id,
      dryRun: false,
    });
    await expect(
      db
        .selectFrom('app.travelJourneySegments')
        .select(['arrivalDate', 'departureDate'])
        .where('id', '=', segments[1]!.id)
        .executeTakeFirst(),
    ).resolves.toMatchObject({ arrivalDate: '2026-05-01', departureDate: '2026-05-10' });
  });

  it('rejects invalid dossier fields and duplicate sequences before saving', async () => {
    const { owner, placeId } = await fixture();
    await expect(
      saveTravelJourney(owner, {
        journey: { name: '' },
        segments: [],
        transport: [],
        stays: [],
        dryRun: false,
      }),
    ).rejects.toThrow('journey_invalid');
    await expect(
      saveTravelJourney(owner, {
        journey: { name: 'ZZZ duplicate probe' },
        segments: [
          { seq: 1, placeId },
          { seq: 1, placeId },
        ],
        transport: [],
        stays: [],
        dryRun: true,
      }),
    ).rejects.toThrow('segments_invalid');
  });
});
