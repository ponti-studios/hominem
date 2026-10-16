import { describe, expect, it } from 'vitest';

import { haversineKm, labelHomeGap } from './travel-analytics.service';

describe('travel analytics calculations', () => {
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
});
