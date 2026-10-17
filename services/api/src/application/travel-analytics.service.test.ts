import { randomUUID } from 'node:crypto';

import { authDb, db } from '@hominem/db/core';
import { afterEach } from 'vitest';
import { describe, expect, it } from 'vitest';

import {
  findOutOfOrderSegmentPairs,
  haversineKm,
  labelHomeGap,
  travelDistance,
  travelInsights,
  travelSearch,
  travelStats,
  travelTimeline,
  travelUnresolved,
  travelValidate,
} from './travel-analytics.service';

describe('travel analytics calculations', () => {
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
      .values({ id, name: 'Travel analytics test', email: `${id}@example.com` })
      .execute();
    return id;
  }

  it('returns whole-kilometer haversine distances for the documented route anchors', () => {
    expect(
      haversineKm(
        { latitude: 33.9416, longitude: -118.4085 },
        { latitude: -33.9461, longitude: 151.1772 },
      ),
    ).toBeCloseTo(12061, -1);
    expect(
      haversineKm(
        { latitude: 40.6413, longitude: -73.7781 },
        { latitude: 51.47, longitude: -0.4543 },
      ),
    ).toBeCloseTo(5540, -1);
    expect(
      haversineKm(
        { latitude: 32.8998, longitude: -97.0403 },
        { latitude: 33.9416, longitude: -118.4085 },
      ),
    ).toBeCloseTo(1983, -1);
    expect(
      haversineKm({ latitude: null, longitude: null }, { latitude: 10, longitude: 20 }),
    ).toBeNull();
  });

  it('labels home gaps by residence precision without backfilling earlier gaps', () => {
    const residences: Parameters<typeof labelHomeGap>[2] = [
      {
        id: 'residence-la',
        place: 'Los Angeles',
        placeId: 'place-la',
        periods: [
          {
            startDate: '2016-01-01',
            endDate: null,
            ongoing: false,
            precision: 'day',
            note: 'until the Sep 2026 move',
          },
        ],
      },
      {
        id: 'residence-london',
        place: 'London',
        placeId: 'place-london',
        periods: [
          {
            startDate: '2017-01-01',
            endDate: null,
            ongoing: false,
            precision: 'month',
            note: 'Jan 2017',
          },
          {
            startDate: '2026-09-23',
            endDate: null,
            ongoing: true,
            precision: 'day',
            note: 'current home',
          },
        ],
      },
    ];
    expect(labelHomeGap('2014-01-01', '2014-01-10', residences)).toBeNull();
    expect(labelHomeGap('2017-01-05', '2017-01-10', residences)).toMatchObject({
      place: 'London',
      inferred: false,
      rule: 'precision_period',
    });
    expect(labelHomeGap('2024-03-01', '2024-03-10', residences)).toMatchObject({
      place: 'Los Angeles',
      inferred: true,
      rule: 'inferred_until_next_day_precision_period',
    });
    expect(labelHomeGap('2026-10-01', '2026-10-10', residences)).toMatchObject({
      place: 'London',
      inferred: false,
      rule: 'ongoing_period',
    });
  });

  it('bounds sequence-gap validation by the number of observed sequences', async () => {
    const ownerId = await owner();
    const [journey] = await db
      .insertInto('app.travelJourneys')
      .values({ ownerUserid: ownerId, name: 'Huge sequence' })
      .returning('id')
      .execute();
    const [place] = await db
      .insertInto('app.places')
      .values({
        ownerUserid: ownerId,
        name: 'Bounded',
        country: 'Testland',
        placeType: 'city',
      })
      .returning('id')
      .execute();
    await db
      .insertInto('app.travelJourneySegments')
      .values({
        ownerUserid: ownerId,
        journeyId: journey!.id,
        placeId: place!.id,
        seq: 2_147_483_647,
      })
      .execute();

    const result = await travelValidate(ownerId);
    expect(result.checks.segment_seq_gap_or_dupe).toMatchObject({
      count: 1,
      offenders: [{ detail: 'Missing sequence range 1..2147483646.' }],
    });
  });

  it('finds out-of-order segments independently of database row order', () => {
    const reversed = [
      { id: 'second', journeyId: 'journey', seq: 2, arrivalDate: '2020-01-01' },
      { id: 'first', journeyId: 'journey', seq: 1, arrivalDate: '2020-01-05' },
    ];
    expect(findOutOfOrderSegmentPairs(reversed)).toEqual([['first', 'second']]);
    expect(findOutOfOrderSegmentPairs([...reversed].reverse())).toEqual([['first', 'second']]);
  });

  it('merges overlapping journey intervals and paginates timeline events', async () => {
    const ownerId = await owner();
    const [place] = await db
      .insertInto('app.places')
      .values({
        ownerUserid: ownerId,
        name: 'Timeline City',
        country: 'Testland',
        placeType: 'city',
      })
      .returning('id')
      .execute();
    const journeys = await db
      .insertInto('app.travelJourneys')
      .values([
        {
          ownerUserid: ownerId,
          name: 'Outer journey',
          startDate: '2020-01-01',
          endDate: '2020-01-20',
        },
        {
          ownerUserid: ownerId,
          name: 'Nested journey',
          startDate: '2020-01-05',
          endDate: '2020-01-06',
        },
        {
          ownerUserid: ownerId,
          name: 'Overlapping journey',
          startDate: '2020-01-10',
          endDate: '2020-01-12',
        },
        {
          ownerUserid: ownerId,
          name: 'Next journey',
          startDate: '2020-01-25',
          endDate: '2020-01-28',
        },
      ])
      .returning('id')
      .execute();
    await db
      .insertInto('app.travelJourneySegments')
      .values(
        journeys.map((journey, index) => ({
          ownerUserid: ownerId,
          journeyId: journey.id,
          placeId: place!.id,
          seq: 1,
          arrivalDate: `2020-01-${String(index * 3 + 1).padStart(2, '0')}`,
          departureDate: `2020-01-${String(index * 3 + 2).padStart(2, '0')}`,
        })),
      )
      .execute();

    const firstPage = await travelTimeline(ownerId, {
      from: '2020-01-01',
      to: '2020-01-31',
      limit: 2,
    });
    expect(firstPage).toMatchObject({ total: 5, limit: 2, offset: 0, truncated: true });
    const full = await travelTimeline(ownerId, {
      from: '2020-01-01',
      to: '2020-01-31',
      limit: 20,
    });
    const gaps = full.events.filter((event) => event.type === 'home_gap');
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      startDate: '2020-01-20',
      endDate: '2020-01-25',
      fromJourneyId: expect.any(String),
      toJourneyId: expect.any(String),
    });
  });

  it('keeps search, stats, insights, unresolved results, and distance errors stable', async () => {
    const ownerId = await owner();
    const journey = await db
      .insertInto('app.travelJourneys')
      .values({
        ownerUserid: ownerId,
        name: 'Iceland visit',
        startDate: '2020-06-01',
        endDate: '2020-06-03',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const place = await db
      .insertInto('app.places')
      .values({ ownerUserid: ownerId, name: 'Reykjavik', country: 'Iceland', placeType: 'city' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('app.travelPlaces')
      .values({ ownerUserid: ownerId, placeId: place.id })
      .execute();
    const segment = await db
      .insertInto('app.travelJourneySegments')
      .values({
        ownerUserid: ownerId,
        journeyId: journey.id,
        placeId: place.id,
        seq: 1,
        arrivalDate: '2020-06-01',
        departureDate: '2020-06-03',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('app.travelStays')
      .values({
        ownerUserid: ownerId,
        journeyId: journey.id,
        segmentId: segment.id,
        city: 'Reykjavik',
        property: 'Harbor House',
        evidence: 'thin',
      })
      .execute();
    await db
      .insertInto('app.travelIdeas')
      .values({ ownerUserid: ownerId, idea: 'Visit the harbor', type: 'admin', status: 'open' })
      .execute();

    const search = await travelSearch(ownerId, { query: 'Reykjavik', limit: 10 });
    expect(search).toMatchObject({
      total: 2,
      places: { total: 1, items: [{ place: 'Reykjavik' }] },
      stays: { total: 1, items: [{ city: 'Reykjavik', property: 'Harbor House' }] },
    });
    const stats = await travelStats(ownerId, { year: 2020 });
    expect(stats).toMatchObject({
      journeyCount: 1,
      segmentCount: 1,
      placeCount: 1,
      countryCount: 1,
    });
    const insights = await travelInsights(ownerId, { year: 2020 });
    expect(insights).toMatchObject({
      daysPerPlace: { total: 1, items: [{ place: 'Reykjavik', days: 3, nights: 2 }] },
      daysPerCountry: { total: 1, items: [{ country: 'Iceland', days: 3, nights: 2 }] },
    });
    const unresolved = await travelUnresolved(ownerId);
    expect(unresolved).toMatchObject({
      stays: { total: 1, items: [{ property: 'Harbor House' }] },
      ideas: { total: 1, items: [{ idea: 'Visit the harbor' }] },
    });
    await expect(
      travelDistance(ownerId, { origin: 'missing-origin', destination: 'missing-destination' }),
    ).rejects.toThrow('unknown_airport');
  });
});
