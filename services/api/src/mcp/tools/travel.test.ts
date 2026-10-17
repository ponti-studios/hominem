import { randomUUID } from 'node:crypto';

import { authDb, db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import './travel';
import './travel-analytics';
import './places';
import { placeResidenceCreateInputSchema } from '../../schemas/place-residences.schema';
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
const readPinnedReferenceId = 'e1000033-0000-4000-8000-000000000003';
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
  await db.deleteFrom('app.travelAirportReference').where('sourceId', '=', '989003').execute();
  await db
    .insertInto('app.travelAirportReference')
    .values([
      {
        sourceId: 983001,
        code: 'LHR',
        name: 'Heathrow',
        city: 'London Probe City',
        country: 'GB',
        type: 'large_airport',
        latitude: 51.47,
        longitude: -0.4543,
        scheduledService: true,
      },
      {
        sourceId: 983002,
        code: 'STN',
        name: 'Stansted',
        city: 'London Probe City',
        country: 'GB',
        type: 'large_airport',
        latitude: 51.885,
        longitude: 0.235,
        scheduledService: true,
      },
      {
        id: readPinnedReferenceId,
        sourceId: 989003,
        code: 'LHR',
        name: 'Duplicate code probe airport',
        city: 'Pinned Probe City',
        country: 'GB',
        type: 'large_airport',
        latitude: 40,
        longitude: -70,
        scheduledService: true,
      },
    ])
    .onConflict((conflict) => conflict.column('sourceId').doNothing())
    .execute();
  await db
    .insertInto('app.travelAirports')
    .values([
      {
        id: readAirportId,
        ownerUserid: ownerId,
        code: 'LHR',
        name: 'Heathrow',
        servesPlace: 'London',
        city: 'London',
        country: 'UK',
      },
      {
        id: readAirport2Id,
        ownerUserid: ownerId,
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
      name: 'Read fixture',
      purpose: 'leisure',
      startDate: '2026-01-01',
      endDate: '2026-01-03',
    })
    .execute();
  await db
    .insertInto('app.places')
    .values({
      id: readPlaceId,
      ownerUserid: ownerId,
      name: 'London',
      country: 'UK',
      placeType: 'city',
    })
    .execute();
  await db
    .insertInto('app.travelPlaces')
    .values({ placeId: readPlaceId, ownerUserid: ownerId })
    .execute();
  await db
    .insertInto('app.travelJourneySegments')
    .values({
      id: readSegmentId,
      ownerUserid: ownerId,
      journeyId: readJourneyId,
      seq: 1,
      placeId: readPlaceId,
      arrivalDate: '2026-01-01',
      departureDate: '2026-01-03',
    })
    .execute();
  await pool.query(
    'INSERT INTO app.place_residences (id, owner_userid, place_id) VALUES ($1, $2, $3)',
    [readResidenceId, ownerId, readPlaceId],
  );
  await pool.query(
    "INSERT INTO app.place_residence_periods (owner_userid, residence_id, start_date, ongoing, precision) VALUES ($1, $2, '2026-01-01', true, 'day')",
    [ownerId, readResidenceId],
  );
  await db
    .insertInto('app.travelTransport')
    .values({
      id: readTransportId,
      ownerUserid: ownerId,
      date: '2026-01-01',
      mode: 'air',
      origin: 'LHR',
      originReferenceId: readPinnedReferenceId,
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
      idea: 'Visit London',
      type: 'experience',
      status: 'open',
    })
    .execute();
  await db
    .insertInto('app.places')
    .values({
      id: wishlistPlaceId,
      ownerUserid: ownerId,
      name: 'Paris',
      country: 'France',
      placeType: 'city',
    })
    .execute();
  await db
    .insertInto('app.travelPlaces')
    .values({ placeId: wishlistPlaceId, ownerUserid: ownerId, wantToGo: true })
    .execute();
  await db
    .insertInto('app.travelStays')
    .values({
      id: wishlistStayId,
      ownerUserid: ownerId,
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
        .where('idea', '=', 'See Boston')
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
  it('validates residence dates and defaults omitted precision to day', () => {
    const parsed = placeResidenceCreateInputSchema.safeParse({
      placeId: 'e1000000-0000-4000-8000-000000000001',
      periods: [{ startDate: '2017-01-01', endDate: null, ongoing: false }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.periods[0]?.precision).toBe('day');
    expect(
      placeResidenceCreateInputSchema.safeParse({
        placeId: 'e1000000-0000-4000-8000-000000000001',
        periods: [{ startDate: '2026-99-99', endDate: null, ongoing: false }],
      }).success,
    ).toBe(false);
  });

  it('registers residence reads and writes with their required scopes', () => {
    for (const name of ['place_residence_list', 'place_residence_get']) {
      expect(getToolDefinition(name)).toMatchObject({ readOnly: true, scopes: ['places:read'] });
    }
    for (const name of [
      'place_residence_create',
      'place_residence_update',
      'place_residence_delete',
    ]) {
      expect(getToolDefinition(name)).toMatchObject({ readOnly: false, scopes: ['places:write'] });
    }
    expect(getToolDefinition('place_residence_delete')).toMatchObject({
      destructive: true,
      requiresConfirmation: true,
    });
  });

  it('returns an object from residence list, including when no residences exist', async () => {
    const listed = await callTool(ownerId, 'place_residence_list', {});
    expect(listed.isError).not.toBe(true);
    expect(listed.structuredContent).toMatchObject({
      residences: [{ id: readResidenceId, place: 'London', country: 'UK' }],
    });

    const empty = await callTool(otherUserId, 'place_residence_list', {});
    expect(empty.isError).not.toBe(true);
    expect(empty.structuredContent).toMatchObject({
      residences: [],
      total: 0,
      limit: 100,
      offset: 0,
    });
  });

  it('previews an owned residence deletion and skips confirmation for missing records', async () => {
    const preview = getToolDefinition('place_residence_delete')?.preview;
    expect(preview).toBeTypeOf('function');
    await expect(
      preview?.(ownerId, { id: readResidenceId, iUnderstand: true, dryRun: false }),
    ).resolves.toMatchObject({ residenceId: readResidenceId, place: 'London', periodCount: 1 });
    await expect(
      preview?.(otherUserId, { id: readResidenceId, iUnderstand: true, dryRun: false }),
    ).resolves.toBeNull();
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
      journeys: { items: [{}], total: 1 },
      stays: { items: [{}], total: 1 },
    });
    const bookingSearch = await callTool(ownerId, 'travel_search', { query: 'BOOK-READ' });
    expect(bookingSearch.structuredContent).toMatchObject({
      stays: { items: [{}], total: 1 },
    });
    const validation = await callTool(ownerId, 'travel_validate', {});
    expect(validation.structuredContent).toMatchObject({
      checks: {
        orphan_segment: { count: 0 },
        orphan_stay: { count: 0 },
        orphan_leg: { count: 0 },
        unknown_airport_code: { count: 0 },
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
      totalDistanceKm: expect.any(Number),
    });
    const totalDistanceKm = stats.structuredContent?.totalDistanceKm;
    expect(typeof totalDistanceKm).toBe('number');
    if (typeof totalDistanceKm === 'number') expect(totalDistanceKm).toBeGreaterThan(1000);
    const timeline = await callTool(ownerId, 'travel_timeline', {});
    expect(timeline.structuredContent).toMatchObject({
      total: 1,
      events: [{ type: 'segment', place: 'London', nights: 2 }],
    });
    const insights = await callTool(ownerId, 'travel_insights', {});
    expect(insights.structuredContent).toMatchObject({
      daysPerCountry: { items: [{ country: 'UK' }] },
      homes: { currentHome: { place: 'London' } },
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
    const result = await callTool(ownerId, 'travel_place_get', { id: readPlaceId });
    expect(result.structuredContent).toMatchObject({
      id: readPlaceId,
      relationships: {
        visited: true,
        segmentCount: 1,
        livedIn: true,
        currentlyHome: true,
        wantToGo: false,
      },
      visitHistory: [{ journeyId: readJourneyId, arrivalDate: '2026-01-01' }],
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
          segmentCount: 1,
          places: ['London'],
          countries: ['UK'],
        },
      ],
    });
    const dossier = await callTool(ownerId, 'travel_journey_get', { id: readJourneyId });
    expect(dossier.structuredContent).toMatchObject({
      id: readJourneyId,
      name: 'Read fixture',
      startDate: '2026-01-01',
      segments: [{ nights: 2 }],
      legs: [
        {
          originName: 'Duplicate code probe airport',
          originPlace: 'London',
          destinationName: 'Stansted',
          distanceKm: expect.any(Number),
        },
      ],
      stays: [{}],
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
    const segment = await callTool(ownerId, 'travel_segment_get', { id: readSegmentId });
    expect(segment.structuredContent).toMatchObject({
      arrivingLegs: [{}],
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
      journeyId: readJourneyId,
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
      journeyId: readJourneyId,
      evidence: 'email',
    });
    expect(stays.structuredContent).toMatchObject({ stays: [{ id: readStayId }], total: 1 });
  });

  it('lists airports and ideas, reports segment-derived countries, and keeps wishlist sections separate', async () => {
    const airports = await callTool(ownerId, 'travel_airport_list', {
      query: 'London Probe',
      limit: 1,
    });
    expect(travelAirportListOutputSchema.parse(airports.structuredContent)).toMatchObject({
      total: 2,
      airports: [{ code: 'LHR' }],
      truncated: true,
    });
    const airport = await callTool(ownerId, 'travel_airport_get', { code: 'lhr' });
    expect(airport.structuredContent).toMatchObject({
      code: 'LHR',
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

  it('finds a shared catalogue airport by code independently of owner airport rows', async () => {
    const airportOwner = randomUUID();
    const sourceId = 1_700_000_000 + Math.floor(Math.random() * 100_000_000);
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
        .insertInto('app.travelAirportReference')
        .values({
          sourceId,
          code: 'A200',
          name: 'Airport 200',
          city: 'Test City',
          country: 'ZZ',
          type: 'small_airport',
        })
        .execute();

      const result = await callTool(airportOwner, 'travel_airport_get', { code: 'A200' });
      expect(result.structuredContent).toMatchObject({ code: 'A200', name: 'Airport 200' });
    } finally {
      await db
        .updateTable('app.travelAirportReference')
        .set({ missingFromSource: true, active: false })
        .where('sourceId', '=', String(sourceId))
        .execute();
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
        .values({ ownerUserid: userId, name: 'Endpoint journey' })
        .returning('id')
        .executeTakeFirstOrThrow();
      const place = await db
        .insertInto('app.places')
        .values({
          ownerUserid: userId,
          name: 'Byron Bay',
          country: 'Australia',
          placeType: 'city',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await db
        .insertInto('app.travelAirports')
        .values([
          {
            ownerUserid: userId,
            code: 'BNK',
            name: 'Ballina Byron Gateway Airport',
            servesPlace: 'Byron Bay',
            city: 'Ballina',
            country: 'Australia',
          },
          {
            ownerUserid: userId,
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
            journeyId: journey.id,
            placeId: place.id,
            seq: 1,
          },
          {
            ownerUserid: userId,
            journeyId: journey.id,
            placeId: place.id,
            seq: 2,
          },
        ])
        .execute();

      const byCity = await callTool(userId, 'travel_transport_list', { from: 'Ballina' });
      expect(byCity.structuredContent).toMatchObject({
        transport: [{ origin: 'BNK' }],
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
