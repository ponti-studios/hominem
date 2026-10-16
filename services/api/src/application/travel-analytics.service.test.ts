import { randomUUID } from 'node:crypto';

import { authDb, db } from '@hominem/db/core';
import { afterEach } from 'vitest';
import { describe, expect, it } from 'vitest';

import {
  findOutOfOrderSegmentPairs,
  haversineKm,
  labelHomeGap,
  travelTimeline,
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
        legacyId: 'PLC-047',
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
        legacyId: 'PLC-048',
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
      legacyId: 'PLC-048',
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
      .values({ ownerUserid: ownerId, legacyId: 'JRN-HUGE-SEQ', name: 'Huge sequence' })
      .returning('id')
      .execute();
    const [place] = await db
      .insertInto('app.travelPlaces')
      .values({
        ownerUserid: ownerId,
        legacyId: 'PLC-HUGE-SEQ',
        place: 'Bounded',
        country: 'Testland',
        type: 'city',
        status: 'Want to go',
      })
      .returning('id')
      .execute();
    await db
      .insertInto('app.travelJourneySegments')
      .values({
        ownerUserid: ownerId,
        legacyId: 'SEG-HUGE-SEQ',
        journeyId: journey!.id,
        placeId: place!.id,
        seq: 2_147_483_647,
      })
      .execute();

    const result = await travelValidate(ownerId);
    expect(result.checks.segment_seq_gap_or_dupe).toMatchObject({
      count: 1,
      offenders: [{ legacyId: 'SEG-HUGE-SEQ', detail: 'Missing sequence range 1..2147483646.' }],
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
      .insertInto('app.travelPlaces')
      .values({
        ownerUserid: ownerId,
        legacyId: 'PLC-TIMELINE',
        place: 'Timeline City',
        country: 'Testland',
        type: 'city',
        status: 'Visited',
      })
      .returning('id')
      .execute();
    const journeys = await db
      .insertInto('app.travelJourneys')
      .values([
        {
          ownerUserid: ownerId,
          legacyId: 'JRN-TIMELINE-1',
          name: 'Outer journey',
          startDate: '2020-01-01',
          endDate: '2020-01-20',
        },
        {
          ownerUserid: ownerId,
          legacyId: 'JRN-TIMELINE-2',
          name: 'Nested journey',
          startDate: '2020-01-05',
          endDate: '2020-01-06',
        },
        {
          ownerUserid: ownerId,
          legacyId: 'JRN-TIMELINE-3',
          name: 'Overlapping journey',
          startDate: '2020-01-10',
          endDate: '2020-01-12',
        },
        {
          ownerUserid: ownerId,
          legacyId: 'JRN-TIMELINE-4',
          name: 'Next journey',
          startDate: '2020-01-25',
          endDate: '2020-01-28',
        },
      ])
      .returning(['id', 'legacyId'])
      .execute();
    await db
      .insertInto('app.travelJourneySegments')
      .values(
        journeys.map((journey, index) => ({
          ownerUserid: ownerId,
          legacyId: `SEG-TIMELINE-${index + 1}`,
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
      fromJourneyLegacyId: 'JRN-TIMELINE-1',
      toJourneyLegacyId: 'JRN-TIMELINE-4',
    });
  });
});
