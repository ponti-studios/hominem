import { randomUUID } from 'node:crypto';

import { authDb, db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import './travel';
import './travel-analytics';
import { travelImportOutputSchema } from '../../schemas/travel-import.schema';
import {
  travelAirportListOutputSchema,
  travelBookingLookupOutputSchema,
  travelJourneyListOutputSchema,
  travelPlaceListOutputSchema,
  travelWishlistOutputSchema,
} from '../../schemas/travel-read.schema';
import { tripHistoryOutputSchema } from '../../schemas/travel.schema';
import { toolOutput } from '../../testkit/tool-result';
import { callTool, getToolDefinition } from '../tool-registry';

const ownerId = 'e1000000-0000-4000-8000-000000000001';
const otherUserId = 'e1000000-0000-4000-8000-000000000002';
const tripId = 'e1000010-0000-4000-8000-000000000001';
const ownerPersonId = 'e1000001-0000-4000-8000-000000000001';
const otherPersonId = 'e1000001-0000-4000-8000-000000000002';
const readJourneyId = 'e1000020-0000-4000-8000-000000000001';
const readPlaceId = 'e1000030-0000-4000-8000-000000000001';
const readResidenceId = 'e1000031-0000-4000-8000-000000000001';
const readSegmentId = 'e1000032-0000-4000-8000-000000000001';
const readAirportId = 'e1000033-0000-4000-8000-000000000001';
const readAirport2Id = 'e1000033-0000-4000-8000-000000000002';
const readTransportId = 'e1000034-0000-4000-8000-000000000001';
const readStayId = 'e1000035-0000-4000-8000-000000000001';
const wishlistStayId = 'e1000035-0000-4000-8000-000000000002';
const readIdeaId = 'e1000036-0000-4000-8000-000000000001';
const wishlistPlaceId = 'e1000037-0000-4000-8000-000000000001';

beforeAll(async () => {
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [ownerId]);
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [otherUserId]);
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      ownerId,
      'Travel Owner',
      `${ownerId}@test.hominem.dev`,
      true,
      otherUserId,
      'Other User',
      `${otherUserId}@test.hominem.dev`,
      true,
    ],
  );
  await db
    .insertInto('app.travelAirports')
    .values([
      {
        id: readAirportId,
        ownerUserid: ownerId,
        legacyId: 'ARP-READ-1',
        code: 'LHR',
        name: 'Heathrow',
        servesPlace: 'London',
        city: 'London',
        country: 'UK',
        latitude: 51.47,
        longitude: -0.4543,
      },
      {
        id: readAirport2Id,
        ownerUserid: ownerId,
        legacyId: 'ARP-READ-2',
        code: 'STN',
        name: 'Stansted',
        servesPlace: 'London',
        city: 'London',
        country: 'UK',
        latitude: 51.885,
        longitude: 0.235,
      },
    ])
    .execute();
  await db
    .insertInto('app.people')
    .values([
      { id: ownerPersonId, ownerUserid: ownerId, displayName: 'Visible Guest' },
      { id: otherPersonId, ownerUserid: otherUserId, displayName: 'Hidden Guest' },
    ])
    .execute();
  await db
    .insertInto('app.travelJourneys')
    .values({
      id: readJourneyId,
      ownerUserid: ownerId,
      legacyId: 'JRN-READ',
      name: 'Read fixture',
      purpose: 'leisure',
      startDate: '2026-01-01',
      endDate: '2026-01-03',
    })
    .execute();
  await db
    .insertInto('app.travelPlaces')
    .values({
      id: readPlaceId,
      ownerUserid: ownerId,
      legacyId: 'PLC-READ',
      place: 'London',
      country: 'UK',
      type: 'city',
      status: 'Visited',
    })
    .execute();
  await db
    .insertInto('app.travelJourneySegments')
    .values({
      id: readSegmentId,
      ownerUserid: ownerId,
      legacyId: 'SEG-READ',
      journeyId: readJourneyId,
      seq: 1,
      placeId: readPlaceId,
      arrivalDate: '2026-01-01',
      departureDate: '2026-01-03',
    })
    .execute();
  await pool.query(
    'INSERT INTO app.travel_residences (id, owner_userid, legacy_id, place_id, periods) VALUES ($1, $2, $3, $4, $5::jsonb)',
    [
      readResidenceId,
      ownerId,
      'PLC-READ-RES',
      readPlaceId,
      JSON.stringify([{ startDate: '2026-01-01', endDate: null, ongoing: true, precision: 'day' }]),
    ],
  );
  await db
    .insertInto('app.travelTransport')
    .values({
      id: readTransportId,
      ownerUserid: ownerId,
      legacyId: 'T-READ',
      date: '2026-01-01',
      mode: 'air',
      origin: 'LHR',
      destination: 'STN',
      journeyId: readJourneyId,
      arrSegmentId: readSegmentId,
      bookingRef: 'BOOK-READ',
      carrier: 'Test Air',
    })
    .execute();
  await db
    .insertInto('app.travelStays')
    .values({
      id: readStayId,
      ownerUserid: ownerId,
      legacyId: 'STY-READ',
      journeyId: readJourneyId,
      segmentId: readSegmentId,
      city: 'London',
      country: 'UK',
      property: 'Read Hotel',
      bookingRef: 'BOOK-READ',
      evidence: 'email',
      checkIn: '2026-01-01',
    })
    .execute();
  await db
    .insertInto('app.travelIdeas')
    .values({
      id: readIdeaId,
      ownerUserid: ownerId,
      legacyId: 'IDA-READ',
      idea: 'Visit London',
      type: 'experience',
      status: 'open',
    })
    .execute();
  await db
    .insertInto('app.travelPlaces')
    .values({
      id: wishlistPlaceId,
      ownerUserid: ownerId,
      legacyId: 'PLC-WISHLIST',
      place: 'Paris',
      country: 'France',
      type: 'city',
      status: 'Want to go',
    })
    .execute();
  await db
    .insertInto('app.travelStays')
    .values({
      id: wishlistStayId,
      ownerUserid: ownerId,
      legacyId: 'STY-WISHLIST',
      city: 'Paris',
      country: 'France',
      evidence: 'want',
    })
    .execute();
  await db
    .insertInto('app.travelTrips')
    .values({
      id: tripId,
      ownerUserid: ownerId,
      name: 'Research trip',
      city: 'Boston',
      country: 'USA',
      startDate: '2026-10-10',
      endDate: '2026-10-12',
    })
    .execute();
  await db
    .insertInto('app.travelTripAttendees')
    .values([
      {
        id: 'e1000011-0000-4000-8000-000000000001',
        tripId,
        personId: ownerPersonId,
        role: 'attendee',
      },
      {
        id: 'e1000011-0000-4000-8000-000000000002',
        tripId,
        personId: otherPersonId,
        role: 'attendee',
      },
    ])
    .execute();
});

describe('trip_history', () => {
  it('returns owner trips, date filters, limits, and owner-scoped attendee names', async () => {
    const result = await callTool(ownerId, 'trip_history', {
      from: '2026-10-01',
      limit: 1,
      to: '2026-10-31',
    });
    expect(toolOutput(result, tripHistoryOutputSchema)).toEqual({
      count: 1,
      trips: [
        {
          attendeeNames: ['Visible Guest'],
          city: 'Boston',
          country: 'USA',
          endDate: '2026-10-12',
          id: tripId,
          startDate: '2026-10-10',
          state: null,
        },
      ],
    });
  });

  it('rejects impossible ISO dates before reaching the database', async () => {
    await expect(
      callTool(ownerId, 'trip_history', { from: '2026-02-31', limit: 20 }),
    ).rejects.toThrow('Expected a valid calendar date.');
  });
});

describe('travel_import', () => {
  it('requires travel:write and validates sheet-shaped rows in dry-run mode', async () => {
    const definition = getToolDefinition('travel_import');
    expect(definition).toMatchObject({
      readOnly: false,
      scopes: ['travel:write'],
      requiresConfirmation: true,
      standaloneWrite: true,
    });

    const result = await callTool(ownerId, 'travel_import', {
      rows: {
        ideas: [{ idea_id: 'IDA-TEST', idea: 'See Boston', type: 'experience', status: 'open' }],
      },
      dryRun: true,
    });

    expect(toolOutput(result, travelImportOutputSchema).entities.ideas).toEqual({
      created: 1,
      updated: 0,
      unchanged: 0,
      rejected: [],
    });
    await expect(
      db
        .selectFrom('app.travelIdeas')
        .select('id')
        .where('ownerUserid', '=', ownerId)
        .where('legacyId', '=', 'IDA-TEST')
        .execute(),
    ).resolves.toEqual([]);
  });

  it('confirms replace mode only for a real write and previews the affected row count', async () => {
    const preview = getToolDefinition('travel_import')?.preview;
    expect(preview).toBeTypeOf('function');
    if (!preview) throw new Error('travel_import preview missing');

    const input = {
      rows: {
        ideas: [{ idea_id: 'IDA-TEST', idea: 'See Boston', type: 'experience', status: 'open' }],
      },
      mode: 'replace',
    };
    await expect(preview(ownerId, input)).resolves.toEqual({ mode: 'replace', count: 1 });
    await expect(preview(ownerId, { ...input, dryRun: true })).resolves.toBeNull();
    await expect(preview(ownerId, { ...input, iUnderstand: true })).resolves.toBeNull();
  });
});

describe('travel residence tools', () => {
  it('exposes residence reads while the Tier 2 write gate is blocked', () => {
    for (const name of ['travel_residence_list', 'travel_residence_get']) {
      expect(getToolDefinition(name)).toMatchObject({ readOnly: true, scopes: ['travel:read'] });
    }
    for (const name of [
      'travel_residence_create',
      'travel_residence_update',
      'travel_residence_delete',
    ]) {
      expect(getToolDefinition(name)).toBeUndefined();
    }
  });

  it('returns an object from residence list, including when no residences exist', async () => {
    const listed = await callTool(ownerId, 'travel_residence_list', {});
    expect(listed.isError).not.toBe(true);
    expect(listed.structuredContent).toMatchObject({
      residences: [{ id: readResidenceId, place: 'London', country: 'UK' }],
    });

    const empty = await callTool(otherUserId, 'travel_residence_list', {});
    expect(empty.isError).not.toBe(true);
    expect(empty.structuredContent).toEqual({ residences: [] });
  });
});

describe('travel Tier 1 reads', () => {
  it('keeps the read tools read-scoped and mirrors structured results in the text body', async () => {
    const readTools = [
      'travel_journey_list',
      'travel_journey_get',
      'travel_segment_list',
      'travel_segment_get',
      'travel_place_list',
      'travel_place_get',
      'travel_countries',
      'travel_transport_list',
      'travel_airport_list',
      'travel_airport_get',
      'travel_stay_list',
      'travel_booking_lookup',
      'travel_wishlist',
      'travel_idea_list',
    ] as const;
    for (const name of readTools) {
      expect(getToolDefinition(name)).toMatchObject({ readOnly: true, scopes: ['travel:read'] });
    }
    const result = await callTool(ownerId, 'travel_journey_list', { limit: 1 });
    const textBody = result.content.find((block) => block.type === 'text');
    expect(textBody?.type).toBe('text');
    if (!textBody || textBody.type !== 'text') throw new Error('Expected a text response body.');
    expect(JSON.parse(textBody.text)).toEqual(result.structuredContent);
  });

  it('rejects invalid calendar dates and reversed ranges', async () => {
    await expect(callTool(ownerId, 'travel_journey_list', { from: '2026-02-31' })).rejects.toThrow(
      'Expected a valid calendar date.',
    );
    await expect(
      callTool(ownerId, 'travel_segment_list', { from: '2026-02-10', to: '2026-02-01' }),
    ).rejects.toThrow('from must be on or before to.');
  });

  it('registers analytics tools as read-only and scopes their results to the owner', async () => {
    for (const name of [
      'travel_unresolved',
      'travel_stats',
      'travel_search',
      'travel_validate',
      'travel_timeline',
      'travel_insights',
      'travel_distance',
    ]) {
      expect(getToolDefinition(name)).toMatchObject({ readOnly: true, scopes: ['travel:read'] });
    }
    const foreign = await callTool(otherUserId, 'travel_search', { query: 'London' });
    expect(foreign.structuredContent).toMatchObject({ total: 0 });
  });

  it('returns scoped search, integrity, stats, timeline, insights, and distance results', async () => {
    const search = await callTool(ownerId, 'travel_search', { query: 'read' });
    expect(search.structuredContent).toMatchObject({
      total: 3,
      journeys: { items: [{ legacyId: 'JRN-READ' }], total: 1 },
      stays: { items: [{ legacyId: 'STY-READ' }], total: 1 },
    });
    const bookingSearch = await callTool(ownerId, 'travel_search', { query: 'BOOK-READ' });
    expect(bookingSearch.structuredContent).toMatchObject({
      stays: { items: [{ legacyId: 'STY-READ' }], total: 1 },
    });
    const validation = await callTool(ownerId, 'travel_validate', {});
    expect(validation.structuredContent).toMatchObject({
      checks: {
        orphan_segment: { count: 0 },
        orphan_stay: { count: 0 },
        orphan_leg: { count: 0 },
        unknown_airport_code: { count: 0 },
        duplicate_legacy_id: { count: 0 },
        place_visited_without_segment: { count: 0 },
        stay_partially_linked: { count: 0 },
        thin_evidence_stays: { count: 0 },
      },
    });
    const stats = await callTool(ownerId, 'travel_stats', {});
    expect(stats.structuredContent).toMatchObject({
      journeyCount: 1,
      segmentCount: 1,
      placeCount: 1,
      countryCount: 1,
      legCountByMode: { air: 1 },
    });
    const timeline = await callTool(ownerId, 'travel_timeline', {});
    expect(timeline.structuredContent).toMatchObject({
      total: 1,
      events: [{ type: 'segment', legacyId: 'SEG-READ', place: 'London', nights: 2 }],
    });
    const insights = await callTool(ownerId, 'travel_insights', {});
    expect(insights.structuredContent).toMatchObject({
      daysPerCountry: { items: [{ country: 'UK' }] },
      homes: { currentHome: { place: 'London', legacyId: 'PLC-READ-RES' } },
      nextTrip: null,
    });
    const distance = await callTool(ownerId, 'travel_distance', {
      origin: 'lhr',
      destination: 'STN',
    });
    expect(distance.structuredContent).toMatchObject({
      origin: { code: 'LHR' },
      destination: { code: 'STN' },
      distanceKm: expect.any(Number),
    });
    const unresolved = await callTool(ownerId, 'travel_unresolved', {});
    expect(unresolved.structuredContent).toMatchObject({
      stays: { items: [], total: 0, truncated: false },
      ideas: { items: [], total: 0, truncated: false },
    });
  });

  it('returns a place with segment and Residence relationships and visit history', async () => {
    const result = await callTool(ownerId, 'travel_place_get', { legacyId: 'PLC-READ' });
    expect(result.structuredContent).toMatchObject({
      id: readPlaceId,
      legacyId: 'PLC-READ',
      relationships: {
        visited: true,
        segmentCount: 1,
        livedIn: true,
        currentlyHome: true,
        wantToGo: false,
      },
      visitHistory: [{ journeyLegacyId: 'JRN-READ', arrivalDate: '2026-01-01' }],
      residences: [{ id: readResidenceId }],
    });
    const homeFilter = await callTool(ownerId, 'travel_place_list', {
      hasResidence: true,
      currentlyHome: true,
      country: 'uk',
      status: 'Visited',
    });
    expect(homeFilter.structuredContent).toMatchObject({ places: [{ id: readPlaceId }], total: 1 });
  });

  it('returns stable pagination metadata for the place list', async () => {
    const result = await callTool(ownerId, 'travel_place_list', { limit: 1, offset: 0 });
    expect(result.structuredContent).toMatchObject({
      total: 2,
      limit: 1,
      offset: 0,
      truncated: true,
    });
    expect(travelPlaceListOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  it('returns journey summaries and complete dossiers with resolved leg endpoints', async () => {
    const list = await callTool(ownerId, 'travel_journey_list', { limit: 1 });
    expect(travelJourneyListOutputSchema.parse(list.structuredContent)).toMatchObject({
      total: 1,
      journeys: [
        {
          id: readJourneyId,
          legacyId: 'JRN-READ',
          segmentCount: 1,
          places: ['London'],
          countries: ['UK'],
        },
      ],
    });
    const dossier = await callTool(ownerId, 'travel_journey_get', { legacyId: 'JRN-READ' });
    expect(dossier.structuredContent).toMatchObject({
      id: readJourneyId,
      legacyId: 'JRN-READ',
      name: 'Read fixture',
      startDate: '2026-01-01',
      segments: [{ legacyId: 'SEG-READ', nights: 2 }],
      legs: [
        {
          legacyId: 'T-READ',
          originName: 'Heathrow',
          originPlace: 'London',
          destinationName: 'Stansted',
          distanceKm: expect.any(Number),
        },
      ],
      stays: [{ legacyId: 'STY-READ' }],
    });
    const filtered = await callTool(ownerId, 'travel_journey_list', {
      year: 2026,
      purpose: 'leisure',
      from: '2026-01-02',
      to: '2026-01-02',
      query: 'read',
      upcoming: false,
    });
    expect(filtered.structuredContent).toMatchObject({ total: 1 });
    const future = await callTool(ownerId, 'travel_journey_list', { upcoming: true });
    expect(future.structuredContent).toMatchObject({ journeys: [], total: 0 });
  });

  it('resolves segment links, airport routes, stays, and cross-entity bookings', async () => {
    const exactPlace = await callTool(ownerId, 'travel_segment_list', { place: 'lOnDoN' });
    expect(exactPlace.structuredContent).toMatchObject({
      segments: [{ id: readSegmentId }],
      total: 1,
    });
    const partialPlace = await callTool(ownerId, 'travel_segment_list', { place: 'ondo' });
    expect(partialPlace.structuredContent).toMatchObject({ segments: [], total: 0 });
    const segment = await callTool(ownerId, 'travel_segment_get', { legacyId: 'SEG-READ' });
    expect(segment.structuredContent).toMatchObject({
      arrivingLegs: [{ legacyId: 'T-READ' }],
      stays: [{ id: readStayId }],
    });
    const route = await callTool(ownerId, 'travel_transport_list', { from: 'London', to: 'STN' });
    expect(route.structuredContent).toMatchObject({
      transport: [{ id: readTransportId, originPlace: 'London', destinationCode: 'STN' }],
      total: 1,
    });
    const filteredRoute = await callTool(ownerId, 'travel_transport_list', {
      mode: 'air',
      carrier: 'test',
      from: 'LHR',
      to: 'london',
      fromDate: '2026-01-01',
      toDate: '2026-01-01',
      journeyLegacyId: 'JRN-READ',
    });
    expect(filteredRoute.structuredContent).toMatchObject({ transport: [{ id: readTransportId }] });
    const lookup = await callTool(ownerId, 'travel_booking_lookup', { bookingRef: 'book-read' });
    expect(travelBookingLookupOutputSchema.parse(lookup.structuredContent)).toMatchObject({
      transport: [{ id: readTransportId }],
      stays: [{ id: readStayId }],
      total: 2,
    });
    const partialLookup = await callTool(ownerId, 'travel_booking_lookup', {
      bookingRef: 'ook-re',
      partial: true,
    });
    expect(partialLookup.structuredContent).toMatchObject({ total: 2 });
    const stays = await callTool(ownerId, 'travel_stay_list', {
      city: 'london',
      journeyLegacyId: 'JRN-READ',
      evidence: 'email',
    });
    expect(stays.structuredContent).toMatchObject({ stays: [{ id: readStayId }], total: 1 });
  });

  it('lists airports and ideas, reports segment-derived countries, and keeps wishlist sections separate', async () => {
    const airports = await callTool(ownerId, 'travel_airport_list', { place: 'London', limit: 1 });
    expect(travelAirportListOutputSchema.parse(airports.structuredContent)).toMatchObject({
      total: 2,
      airports: [{ legCount: 1 }],
      truncated: true,
    });
    const airport = await callTool(ownerId, 'travel_airport_get', { code: 'lhr' });
    expect(airport.structuredContent).toMatchObject({
      id: readAirportId,
      code: 'LHR',
      legCount: 1,
    });
    const ideas = await callTool(ownerId, 'travel_idea_list', { type: 'experience' });
    expect(ideas.structuredContent).toMatchObject({ ideas: [{ id: readIdeaId }], total: 1 });
    const openIdeas = await callTool(ownerId, 'travel_idea_list', {
      type: 'experience',
      status: 'open',
    });
    expect(openIdeas.structuredContent).toMatchObject({ total: 1 });
    const countries = await callTool(ownerId, 'travel_countries', {});
    expect(countries.structuredContent).toMatchObject({
      countryCount: 1,
      countries: [{ country: 'UK', places: ['London'] }],
    });
    const wishlist = await callTool(ownerId, 'travel_wishlist', {});
    expect(travelWishlistOutputSchema.parse(wishlist.structuredContent)).toMatchObject({
      places: { total: 1, groups: [{ country: 'France', count: 1 }] },
      stays: { total: 1, items: [{ id: wishlistStayId }] },
      ideas: { total: 1, items: [{ id: readIdeaId }] },
    });
  });

  it('finds an owned airport outside the first airport-list page', async () => {
    const airportOwner = randomUUID();
    await authDb
      .insertInto('user')
      .values({
        id: airportOwner,
        name: 'Airport pagination test',
        email: `${airportOwner}@example.com`,
      })
      .execute();

    try {
      await db
        .insertInto('app.travelAirports')
        .values(
          Array.from({ length: 201 }, (_, index) => {
            const suffix = String(index).padStart(3, '0');
            return {
              ownerUserid: airportOwner,
              legacyId: `ARP-PAGE-${suffix}`,
              code: `A${suffix}`,
              name: `Airport ${suffix}`,
              servesPlace: 'Test City',
              city: 'Test City',
              country: 'Testland',
            };
          }),
        )
        .execute();

      const result = await callTool(airportOwner, 'travel_airport_get', { code: 'A200' });
      expect(result.structuredContent).toMatchObject({ code: 'A200', name: 'Airport 200' });
    } finally {
      await authDb.deleteFrom('user').where('id', '=', airportOwner).execute();
    }
  });

  it('matches transport by airport city and pages timeline events within the result cap', async () => {
    const userId = randomUUID();
    await authDb
      .insertInto('user')
      .values({ id: userId, name: 'Travel endpoint test', email: `${userId}@example.com` })
      .execute();
    try {
      const journey = await db
        .insertInto('app.travelJourneys')
        .values({ ownerUserid: userId, legacyId: 'JRN-ENDPOINT', name: 'Endpoint journey' })
        .returning('id')
        .executeTakeFirstOrThrow();
      const place = await db
        .insertInto('app.travelPlaces')
        .values({
          ownerUserid: userId,
          legacyId: 'PLC-ENDPOINT',
          place: 'Byron Bay',
          country: 'Australia',
          type: 'city',
          status: 'Visited',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await db
        .insertInto('app.travelAirports')
        .values([
          {
            ownerUserid: userId,
            legacyId: 'ARP-ENDPOINT-1',
            code: 'BNK',
            name: 'Ballina Byron Gateway Airport',
            servesPlace: 'Byron Bay',
            city: 'Ballina',
            country: 'Australia',
          },
          {
            ownerUserid: userId,
            legacyId: 'ARP-ENDPOINT-2',
            code: 'SYD',
            name: 'Sydney Airport',
            servesPlace: 'Sydney',
            city: 'Sydney',
            country: 'Australia',
          },
        ])
        .execute();
      await db
        .insertInto('app.travelTransport')
        .values({
          ownerUserid: userId,
          legacyId: 'T-ENDPOINT',
          mode: 'air',
          origin: 'BNK',
          destination: 'SYD',
          journeyId: journey.id,
        })
        .execute();
      await db
        .insertInto('app.travelJourneySegments')
        .values([
          {
            ownerUserid: userId,
            legacyId: 'SEG-ENDPOINT-1',
            journeyId: journey.id,
            placeId: place.id,
            seq: 1,
          },
          {
            ownerUserid: userId,
            legacyId: 'SEG-ENDPOINT-2',
            journeyId: journey.id,
            placeId: place.id,
            seq: 2,
          },
        ])
        .execute();

      const byCity = await callTool(userId, 'travel_transport_list', { from: 'Ballina' });
      expect(byCity.structuredContent).toMatchObject({
        transport: [{ legacyId: 'T-ENDPOINT', origin: 'BNK' }],
        total: 1,
      });
      const first = await callTool(userId, 'travel_timeline', { limit: 1 });
      expect(first.structuredContent).toMatchObject({
        total: 2,
        limit: 1,
        offset: 0,
        truncated: true,
      });
      const second = await callTool(userId, 'travel_timeline', { limit: 1, offset: 1 });
      expect(second.structuredContent).toMatchObject({
        total: 2,
        limit: 1,
        offset: 1,
        truncated: false,
      });
    } finally {
      await authDb.deleteFrom('user').where('id', '=', userId).execute();
    }
  });
});
