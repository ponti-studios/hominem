import { db } from '@hominem/db/core';

import { travelResidencePeriodsSchema } from '../schemas/travel-residences.schema';

type Page = { limit: number; offset: number };

function paginate<T>(items: T[], page: Page) {
  const total = items.length;
  return {
    items: items.slice(page.offset, page.offset + page.limit),
    total,
    limit: page.limit,
    offset: page.offset,
    truncated: page.offset + page.limit < total,
  };
}

const norm = (value: unknown) => String(value ?? '').toLocaleLowerCase();
const includes = (value: unknown, query?: string) => !query || norm(value).includes(norm(query));
const inRange = (start: string | null, end: string | null, from?: string, to?: string) =>
  (!from || !end || end >= from) && (!to || !start || start <= to);
const compareNullableDate = (a: string | null, b: string | null) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : a.localeCompare(b);
const daysBetween = (from: string | null, to: string | null) => {
  if (!from || !to) return null;
  return Math.max(
    0,
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000),
  );
};
const distanceKm = (
  a: { latitude: number | null; longitude: number | null },
  b: { latitude: number | null; longitude: number | null },
) => {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null)
    return null;
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};

async function allTransport(owner: string) {
  const [rows, airports] = await Promise.all([
    db.selectFrom('app.travelTransport').selectAll().where('ownerUserid', '=', owner).execute(),
    db.selectFrom('app.travelAirports').selectAll().where('ownerUserid', '=', owner).execute(),
  ]);
  const byCode = new Map(airports.map((airport) => [airport.code.toUpperCase(), airport]));
  return rows.map((leg) => {
    const origin = byCode.get(leg.origin.toUpperCase());
    const destination = byCode.get(leg.destination.toUpperCase());
    return {
      ...leg,
      originCode: leg.origin,
      originName: origin?.name ?? null,
      originPlace: origin?.servesPlace ?? null,
      originCity: origin?.city ?? null,
      destinationCode: leg.destination,
      destinationName: destination?.name ?? null,
      destinationPlace: destination?.servesPlace ?? null,
      destinationCity: destination?.city ?? null,
      distanceKm: origin && destination ? distanceKm(origin, destination) : null,
    };
  });
}

async function placeRelationships(owner: string) {
  const [segments, residences] = await Promise.all([
    db
      .selectFrom('app.travelJourneySegments')
      .select(['placeId'])
      .where('ownerUserid', '=', owner)
      .execute(),
    db
      .selectFrom('app.travelResidences')
      .select(['placeId', 'periods'])
      .where('ownerUserid', '=', owner)
      .execute(),
  ]);
  const result = new Map<
    string,
    {
      visited: boolean;
      segmentCount: number;
      livedIn: boolean;
      currentlyHome: boolean;
      wantToGo: boolean;
    }
  >();
  const counts = new Map<string, number>();
  for (const segment of segments)
    counts.set(segment.placeId, (counts.get(segment.placeId) ?? 0) + 1);
  const homeCounts = new Map<string, { livedIn: boolean; currentlyHome: boolean }>();
  for (const residence of residences) {
    const periods = travelResidencePeriodsSchema.parse(
      typeof residence.periods === 'string' ? JSON.parse(residence.periods) : residence.periods,
    );
    const current = homeCounts.get(residence.placeId) ?? { livedIn: false, currentlyHome: false };
    current.livedIn = true;
    current.currentlyHome ||= periods.some((period) => period.ongoing === true);
    homeCounts.set(residence.placeId, current);
  }
  return { counts, homeCounts, result };
}

async function decoratedPlaces(owner: string) {
  const places = await db
    .selectFrom('app.travelPlaces')
    .selectAll()
    .where('ownerUserid', '=', owner)
    .execute();
  const { counts, homeCounts } = await placeRelationships(owner);
  return places.map((place) => {
    const segmentCount = counts.get(place.id) ?? 0;
    const home = homeCounts.get(place.id);
    return {
      ...place,
      relationships: {
        visited: segmentCount > 0,
        segmentCount,
        livedIn: home?.livedIn ?? false,
        currentlyHome: home?.currentlyHome ?? false,
        wantToGo: place.status === 'Want to go',
      },
    };
  });
}

async function journeySummaries(owner: string) {
  const [journeys, segments, places] = await Promise.all([
    db.selectFrom('app.travelJourneys').selectAll().where('ownerUserid', '=', owner).execute(),
    db
      .selectFrom('app.travelJourneySegments')
      .selectAll()
      .where('ownerUserid', '=', owner)
      .orderBy('seq')
      .execute(),
    db
      .selectFrom('app.travelPlaces')
      .select(['id', 'place', 'country'])
      .where('ownerUserid', '=', owner)
      .execute(),
  ]);
  const placeById = new Map(places.map((place) => [place.id, place]));
  return journeys.map((journey) => {
    const tripSegments = segments.filter((segment) => segment.journeyId === journey.id);
    const segmentPlaces = tripSegments
      .map((segment) => placeById.get(segment.placeId))
      .filter((place) => place !== undefined);
    return {
      ...journey,
      segmentCount: tripSegments.length,
      places: segmentPlaces.map(({ place }) => place),
      countries: [...new Set(segmentPlaces.map(({ country }) => country))],
    };
  });
}

export async function listTravelJourneys(
  owner: string,
  input: {
    limit: number;
    offset: number;
    archived: boolean;
    year?: number;
    purpose?: string;
    from?: string;
    to?: string;
    upcoming?: boolean;
    query?: string;
  },
) {
  const today = new Date().toISOString().slice(0, 10);
  const filtered = (await journeySummaries(owner))
    .filter(
      (journey) =>
        (input.archived || !journey.archived) &&
        (input.year === undefined || journey.startDate?.slice(0, 4) === String(input.year)) &&
        (!input.purpose || journey.purpose === input.purpose) &&
        inRange(journey.startDate, journey.endDate, input.from, input.to) &&
        (input.upcoming === undefined ||
          (journey.startDate !== null && journey.startDate >= today === input.upcoming)) &&
        (!input.query ||
          includes(journey.name, input.query) ||
          includes(journey.notes, input.query)),
    )
    .sort(
      (a, b) =>
        (b.startDate ?? '').localeCompare(a.startDate ?? '') ||
        a.legacyId.localeCompare(b.legacyId),
    );
  return {
    journeys: paginate(filtered, input).items,
    total: filtered.length,
    limit: input.limit,
    offset: input.offset,
    truncated: input.offset + input.limit < filtered.length,
  };
}

async function selectedJourney(owner: string, input: { id?: string; legacyId?: string }) {
  let query = db.selectFrom('app.travelJourneys').selectAll().where('ownerUserid', '=', owner);
  query = input.id
    ? query.where('id', '=', input.id)
    : query.where('legacyId', '=', input.legacyId!);
  return query.executeTakeFirst();
}

export async function getTravelJourney(owner: string, input: { id?: string; legacyId?: string }) {
  const journey = await selectedJourney(owner, input);
  if (!journey) return null;
  const [segments, legs, stays, places] = await Promise.all([
    db
      .selectFrom('app.travelJourneySegments as s')
      .innerJoin('app.travelPlaces as p', 'p.id', 's.placeId')
      .select([
        's.id',
        's.legacyId',
        's.seq',
        's.journeyId',
        's.placeId',
        's.arrivalDate',
        's.departureDate',
        's.notes',
        's.createdAt',
        's.updatedAt',
        'p.place',
        'p.country',
      ])
      .where('s.ownerUserid', '=', owner)
      .where('s.journeyId', '=', journey.id)
      .orderBy('s.seq')
      .execute(),
    allTransport(owner).then((rows) =>
      rows
        .filter((leg) => leg.journeyId === journey.id)
        .sort(
          (a, b) =>
            (a.date ?? '').localeCompare(b.date ?? '') || a.legacyId.localeCompare(b.legacyId),
        ),
    ),
    db
      .selectFrom('app.travelStays')
      .selectAll()
      .where('ownerUserid', '=', owner)
      .where('journeyId', '=', journey.id)
      .orderBy('checkIn')
      .execute(),
    journeySummaries(owner).then((rows) => rows.find((row) => row.id === journey.id)),
  ]);
  return {
    ...places,
    segments: segments.map((segment) => ({
      ...segment,
      nights: daysBetween(segment.arrivalDate, segment.departureDate),
    })),
    legs,
    stays,
  };
}

export async function listTravelSegments(
  owner: string,
  input: {
    limit: number;
    offset: number;
    journeyId?: string;
    journeyLegacyId?: string;
    place?: string;
    from?: string;
    to?: string;
  },
) {
  const [rows, journeys, places] = await Promise.all([
    db
      .selectFrom('app.travelJourneySegments')
      .selectAll()
      .where('ownerUserid', '=', owner)
      .execute(),
    db
      .selectFrom('app.travelJourneys')
      .select(['id', 'legacyId', 'name', 'startDate'])
      .where('ownerUserid', '=', owner)
      .execute(),
    db
      .selectFrom('app.travelPlaces')
      .select(['id', 'place', 'country'])
      .where('ownerUserid', '=', owner)
      .execute(),
  ]);
  const journeyById = new Map(journeys.map((journey) => [journey.id, journey]));
  const placeById = new Map(places.map((place) => [place.id, place]));
  const filtered = rows
    .filter((segment) => {
      const journey = journeyById.get(segment.journeyId);
      const place = placeById.get(segment.placeId);
      return (
        (!input.journeyId || segment.journeyId === input.journeyId) &&
        (!input.journeyLegacyId || journey?.legacyId === input.journeyLegacyId) &&
        (!input.place || norm(place?.place) === norm(input.place)) &&
        inRange(segment.arrivalDate, segment.departureDate, input.from, input.to)
      );
    })
    .sort(
      (a, b) =>
        (journeyById.get(a.journeyId)?.startDate ?? '').localeCompare(
          journeyById.get(b.journeyId)?.startDate ?? '',
        ) || a.seq - b.seq,
    );
  const mapped = filtered.map((segment) => ({
    ...segment,
    place: placeById.get(segment.placeId)?.place ?? null,
    country: placeById.get(segment.placeId)?.country ?? null,
    journeyLegacyId: journeyById.get(segment.journeyId)?.legacyId ?? null,
    journeyName: journeyById.get(segment.journeyId)?.name ?? null,
    nights: daysBetween(segment.arrivalDate, segment.departureDate),
  }));
  const page = paginate(mapped, input);
  return {
    segments: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    truncated: page.truncated,
  };
}

export async function getTravelSegment(owner: string, input: { id?: string; legacyId?: string }) {
  let query = db
    .selectFrom('app.travelJourneySegments as s')
    .innerJoin('app.travelPlaces as p', 'p.id', 's.placeId')
    .innerJoin('app.travelJourneys as j', 'j.id', 's.journeyId')
    .select([
      's.id',
      's.legacyId',
      's.journeyId',
      's.seq',
      's.placeId',
      's.arrivalDate',
      's.departureDate',
      's.notes',
      's.createdAt',
      's.updatedAt',
      'p.place',
      'p.country',
      'j.legacyId as journeyLegacyId',
      'j.name as journeyName',
    ])
    .where('s.ownerUserid', '=', owner);
  query = input.id
    ? query.where('s.id', '=', input.id)
    : query.where('s.legacyId', '=', input.legacyId!);
  const segment = await query.executeTakeFirst();
  if (!segment) return null;
  const [legs, stays] = await Promise.all([
    allTransport(owner).then((rows) =>
      rows
        .filter((leg) => leg.depSegmentId === segment.id || leg.arrSegmentId === segment.id)
        .sort(
          (a, b) => compareNullableDate(a.date, b.date) || a.legacyId.localeCompare(b.legacyId),
        ),
    ),
    db
      .selectFrom('app.travelStays')
      .selectAll()
      .where('ownerUserid', '=', owner)
      .where('segmentId', '=', segment.id)
      .orderBy('checkIn')
      .execute(),
  ]);
  return {
    ...segment,
    nights: daysBetween(segment.arrivalDate, segment.departureDate),
    departingLegs: legs.filter((leg) => leg.depSegmentId === segment.id),
    arrivingLegs: legs.filter((leg) => leg.arrSegmentId === segment.id),
    stays,
  };
}

export async function listTravelPlaces(
  owner: string,
  input: {
    limit: number;
    offset: number;
    archived: boolean;
    status?: string;
    country?: string;
    type?: string;
    query?: string;
    hasResidence?: boolean;
    currentlyHome?: boolean;
  },
) {
  const rows = (await decoratedPlaces(owner))
    .filter(
      (place) =>
        (input.archived || !place.archived) &&
        (!input.status || place.status === input.status) &&
        (!input.country || norm(place.country) === norm(input.country)) &&
        (!input.type || place.type === input.type) &&
        (!input.query ||
          includes(place.place, input.query) ||
          includes(place.notes, input.query)) &&
        (input.hasResidence === undefined || place.relationships.livedIn === input.hasResidence) &&
        (input.currentlyHome === undefined ||
          place.relationships.currentlyHome === input.currentlyHome),
    )
    .sort((a, b) => a.country.localeCompare(b.country) || a.place.localeCompare(b.place));
  const page = paginate(rows, input);
  return {
    places: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    truncated: page.truncated,
  };
}

export async function getTravelPlace(owner: string, input: { id?: string; legacyId?: string }) {
  const place = (await decoratedPlaces(owner)).find((row) =>
    input.id ? row.id === input.id : row.legacyId === input.legacyId,
  );
  if (!place) return null;
  const [segments, residences] = await Promise.all([
    db
      .selectFrom('app.travelJourneySegments as s')
      .innerJoin('app.travelJourneys as j', 'j.id', 's.journeyId')
      .select([
        's.id',
        's.legacyId',
        's.arrivalDate',
        's.departureDate',
        's.seq',
        'j.id as journeyId',
        'j.legacyId as journeyLegacyId',
        'j.name as journeyName',
      ])
      .where('s.ownerUserid', '=', owner)
      .where('s.placeId', '=', place.id)
      .orderBy('s.arrivalDate')
      .execute(),
    db
      .selectFrom('app.travelResidences')
      .selectAll()
      .where('ownerUserid', '=', owner)
      .where('placeId', '=', place.id)
      .orderBy('sourceFirstVisited')
      .execute(),
  ]);
  return {
    ...place,
    visitHistory: segments,
    residences,
    ...(place.status === 'Visited' && !segments.length ? { visitedWithoutSegment: true } : {}),
  };
}

export async function listTravelCountries(owner: string) {
  const [segments, places] = await Promise.all([
    db
      .selectFrom('app.travelJourneySegments as s')
      .innerJoin('app.travelPlaces as p', 'p.id', 's.placeId')
      .select(['p.country', 'p.place'])
      .where('s.ownerUserid', '=', owner)
      .execute(),
    db
      .selectFrom('app.travelPlaces')
      .select(['country', 'status', 'id'])
      .where('ownerUserid', '=', owner)
      .execute(),
  ]);
  const countryMap = new Map<string, Set<string>>();
  for (const segment of segments) {
    const current = countryMap.get(segment.country) ?? new Set<string>();
    current.add(segment.place);
    countryMap.set(segment.country, current);
  }
  const residencePlaces = await db
    .selectFrom('app.travelResidences')
    .select('placeId')
    .where('ownerUserid', '=', owner)
    .execute();
  const placeById = new Map(places.map((place) => [place.id, place]));
  const placesStatus = new Set(
    places
      .filter((place) => ['Visited', 'Lived in'].includes(place.status))
      .map((place) => place.country),
  );
  for (const residence of residencePlaces) {
    const place = placeById.get(residence.placeId);
    if (place) placesStatus.add(place.country);
  }
  const countries = [...countryMap]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([country, names]) => ({ country, places: [...names].sort() }));
  const segmentCountries = new Set(countryMap.keys());
  const excludedByMethod = [...placesStatus]
    .filter((country) => !segmentCountries.has(country))
    .sort();
  return {
    countries,
    countryCount: countries.length,
    placesStatusCountryCount: placesStatus.size,
    excludedByMethod,
    method:
      'Countries and place names are derived from travel segments; placesStatusCountryCount is the separate count of countries with a canonical Place marked Visited or Lived in, or with a Residence record.',
  };
}

export async function listTravelTransport(
  owner: string,
  input: {
    limit: number;
    offset: number;
    mode?: string;
    carrier?: string;
    from?: string;
    to?: string;
    journeyId?: string;
    journeyLegacyId?: string;
    bookingRef?: string;
    fromDate?: string;
    toDate?: string;
  },
) {
  const [rows, journeys] = await Promise.all([
    allTransport(owner),
    db
      .selectFrom('app.travelJourneys')
      .select(['id', 'legacyId'])
      .where('ownerUserid', '=', owner)
      .execute(),
  ]);
  const journeyById = new Map(journeys.map((journey) => [journey.id, journey]));
  const airportMatch = (
    leg: (typeof rows)[number],
    endpoint: 'origin' | 'destination',
    query?: string,
  ) =>
    !query ||
    [leg[endpoint], leg[`${endpoint}Name`], leg[`${endpoint}Place`], leg[`${endpoint}City`]].some(
      (value) => includes(value, query),
    );
  const filtered = rows.filter(
    (leg) =>
      (!input.mode || leg.mode === input.mode) &&
      includes(leg.carrier, input.carrier) &&
      airportMatch(leg, 'origin', input.from) &&
      airportMatch(leg, 'destination', input.to) &&
      (!input.journeyId || leg.journeyId === input.journeyId) &&
      (!input.journeyLegacyId ||
        journeyById.get(leg.journeyId)?.legacyId === input.journeyLegacyId) &&
      (!input.bookingRef || norm(leg.bookingRef) === norm(input.bookingRef)) &&
      (!input.fromDate || (leg.date ?? '') >= input.fromDate) &&
      (!input.toDate || (leg.date ?? '9999') <= input.toDate),
  );
  filtered.sort(
    (a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.legacyId.localeCompare(b.legacyId),
  );
  const page = paginate(filtered, input);
  return {
    transport: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    truncated: page.truncated,
  };
}

export async function listTravelAirports(
  owner: string,
  input: { limit: number; offset: number; place?: string; country?: string },
) {
  const [airports, legs] = await Promise.all([
    db.selectFrom('app.travelAirports').selectAll().where('ownerUserid', '=', owner).execute(),
    db
      .selectFrom('app.travelTransport')
      .select(['origin', 'destination'])
      .where('ownerUserid', '=', owner)
      .execute(),
  ]);
  const rows = airports
    .filter(
      (airport) =>
        (!input.place ||
          includes(airport.servesPlace, input.place) ||
          includes(airport.city, input.place)) &&
        (!input.country || norm(airport.country) === norm(input.country)),
    )
    .map((airport) => ({
      ...airport,
      legCount: legs.filter(
        (leg) =>
          leg.origin.toUpperCase() === airport.code.toUpperCase() ||
          leg.destination.toUpperCase() === airport.code.toUpperCase(),
      ).length,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const page = paginate(rows, input);
  return {
    airports: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    truncated: page.truncated,
  };
}

export async function getTravelAirport(owner: string, input: { id?: string; code?: string }) {
  let query = db.selectFrom('app.travelAirports').selectAll().where('ownerUserid', '=', owner);
  query = input.id
    ? query.where('id', '=', input.id)
    : query.where('code', '=', input.code!.toUpperCase());
  const airport = await query.executeTakeFirst();
  if (!airport) return null;

  const legs = await db
    .selectFrom('app.travelTransport')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('ownerUserid', '=', owner)
    .where((eb) => eb.or([eb('origin', '=', airport.code), eb('destination', '=', airport.code)]))
    .executeTakeFirstOrThrow();

  return { ...airport, legCount: Number(legs.count) };
}

export async function listTravelStays(
  owner: string,
  input: {
    limit: number;
    offset: number;
    city?: string;
    segmentId?: string;
    segmentLegacyId?: string;
    journeyId?: string;
    journeyLegacyId?: string;
    evidence?: string;
  },
) {
  const [stays, segments, journeys] = await Promise.all([
    db.selectFrom('app.travelStays').selectAll().where('ownerUserid', '=', owner).execute(),
    db
      .selectFrom('app.travelJourneySegments')
      .select(['id', 'legacyId', 'journeyId'])
      .where('ownerUserid', '=', owner)
      .execute(),
    db
      .selectFrom('app.travelJourneys')
      .select(['id', 'legacyId'])
      .where('ownerUserid', '=', owner)
      .execute(),
  ]);
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  const journeyById = new Map(journeys.map((journey) => [journey.id, journey]));
  const rows = stays
    .filter(
      (stay) =>
        includes(stay.city, input.city) &&
        (!input.segmentId || stay.segmentId === input.segmentId) &&
        (!input.segmentLegacyId ||
          segmentById.get(stay.segmentId ?? '')?.legacyId === input.segmentLegacyId) &&
        (!input.journeyId || stay.journeyId === input.journeyId) &&
        (!input.journeyLegacyId ||
          journeyById.get(stay.journeyId ?? '')?.legacyId === input.journeyLegacyId) &&
        (!input.evidence || stay.evidence === input.evidence),
    )
    .sort(
      (a, b) => compareNullableDate(a.checkIn, b.checkIn) || a.legacyId.localeCompare(b.legacyId),
    );
  const page = paginate(rows, input);
  return {
    stays: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    truncated: page.truncated,
  };
}

export async function lookupTravelBooking(
  owner: string,
  input: { bookingRef: string; partial: boolean; limit: number; offset: number },
) {
  const [transport, stays] = await Promise.all([
    allTransport(owner),
    db.selectFrom('app.travelStays').selectAll().where('ownerUserid', '=', owner).execute(),
  ]);
  const match = (value: string | null) =>
    value !== null &&
    (input.partial ? includes(value, input.bookingRef) : norm(value) === norm(input.bookingRef));
  const combined = [
    ...transport
      .filter((row) => match(row.bookingRef))
      .map((row) => ({ ...row, entityType: 'transport' })),
    ...stays.filter((row) => match(row.bookingRef)).map((row) => ({ ...row, entityType: 'stay' })),
  ].sort(
    (a, b) =>
      String(a.bookingRef).localeCompare(String(b.bookingRef)) ||
      String(a.legacyId).localeCompare(String(b.legacyId)),
  );
  const page = paginate(combined, input);
  const items = page.items;
  return {
    transport: items.filter((row) => row.entityType === 'transport'),
    stays: items.filter((row) => row.entityType === 'stay'),
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    truncated: page.truncated,
  };
}

export async function getTravelWishlist(owner: string, input: Page) {
  const [places, stays, ideas] = await Promise.all([
    db
      .selectFrom('app.travelPlaces')
      .selectAll()
      .where('ownerUserid', '=', owner)
      .where('status', '=', 'Want to go')
      .orderBy('country')
      .orderBy('place')
      .execute(),
    db
      .selectFrom('app.travelStays')
      .selectAll()
      .where('ownerUserid', '=', owner)
      .where('evidence', '=', 'want')
      .orderBy('checkIn')
      .execute(),
    db
      .selectFrom('app.travelIdeas')
      .selectAll()
      .where('ownerUserid', '=', owner)
      .where('type', '=', 'experience')
      .where('status', '=', 'open')
      .orderBy('legacyId')
      .execute(),
  ]);
  const groups = [...new Set(places.map((place) => place.country))].map((country) => ({
    country,
    count: places.filter((place) => place.country === country).length,
    places: places.filter((place) => place.country === country),
  }));
  const placePage = paginate(groups, input);
  const stayPage = paginate(stays, input);
  const ideaPage = paginate(ideas, input);
  return {
    places: {
      groups: placePage.items,
      total: placePage.total,
      limit: input.limit,
      offset: input.offset,
      truncated: placePage.truncated,
    },
    stays: {
      items: stayPage.items,
      total: stayPage.total,
      limit: input.limit,
      offset: input.offset,
      truncated: stayPage.truncated,
    },
    ideas: {
      items: ideaPage.items,
      total: ideaPage.total,
      limit: input.limit,
      offset: input.offset,
      truncated: ideaPage.truncated,
    },
  };
}

export async function listTravelIdeas(
  owner: string,
  input: { limit: number; offset: number; status?: string; type?: string },
) {
  const rows = await db
    .selectFrom('app.travelIdeas')
    .selectAll()
    .where('ownerUserid', '=', owner)
    .execute();
  const filtered = rows
    .filter(
      (idea) =>
        (!input.status || idea.status === input.status) &&
        (!input.type || idea.type === input.type),
    )
    .sort((a, b) => a.legacyId.localeCompare(b.legacyId));
  const page = paginate(filtered, input);
  return {
    ideas: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    truncated: page.truncated,
  };
}
