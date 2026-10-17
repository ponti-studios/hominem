import { db, sql } from '@hominem/db/core';

import {
  getTravelAirport as getCuratedAirport,
  listTravelAirports as listAirportWorkingSet,
} from './airport-catalogue.service';
import { listPlaceResidences } from './place-residences.service';

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
  const rows = await db
    .selectFrom('app.travelTransport')
    .selectAll()
    .where('ownerUserid', '=', owner)
    .execute();
  const selections = rows.flatMap((leg) => [
    { code: leg.origin, referenceId: leg.originReferenceId },
    { code: leg.destination, referenceId: leg.destinationReferenceId },
  ]);
  const resolved = await Promise.all(
    selections.map(({ code, referenceId }) => getCuratedAirport(owner, code, referenceId)),
  );
  const byCode = new Map(
    resolved.flatMap((airport) =>
      airport ? [[`${airport.code}:${airport.referenceId}`, airport] as const] : [],
    ),
  );
  return rows.map((leg) => {
    const origin =
      byCode.get(`${leg.origin.toUpperCase()}:${leg.originReferenceId ?? ''}`) ??
      [...byCode.values()].find((airport) => airport.code === leg.origin.toUpperCase());
    const destination =
      byCode.get(`${leg.destination.toUpperCase()}:${leg.destinationReferenceId ?? ''}`) ??
      [...byCode.values()].find((airport) => airport.code === leg.destination.toUpperCase());
    return {
      ...leg,
      originCode: leg.origin,
      originName: origin?.name ?? null,
      originPlace: origin?.servesPlace ?? null,
      originCity: origin?.city ?? null,
      originCountry: origin?.country ?? null,
      originLatitude: origin?.latitude ?? null,
      originLongitude: origin?.longitude ?? null,
      destinationCode: leg.destination,
      destinationName: destination?.name ?? null,
      destinationPlace: destination?.servesPlace ?? null,
      destinationCity: destination?.city ?? null,
      destinationCountry: destination?.country ?? null,
      destinationLatitude: destination?.latitude ?? null,
      destinationLongitude: destination?.longitude ?? null,
      distanceKm: origin && destination ? distanceKm(origin, destination) : null,
    };
  });
}

async function placeRelationships(owner: string) {
  const [segments, residences] = await Promise.all([
    sql<{
      placeId: string;
    }>`SELECT place_id FROM app.travel_journey_segments WHERE owner_userid=${owner}`.execute(db),
    sql<{
      placeId: string;
      ongoing: boolean;
    }>`SELECT r.place_id, rp.ongoing FROM app.place_residences r JOIN app.place_residence_periods rp ON rp.residence_id=r.id AND rp.owner_userid=r.owner_userid WHERE r.owner_userid=${owner}`.execute(
      db,
    ),
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
  for (const segment of segments.rows)
    counts.set(segment.placeId, (counts.get(segment.placeId) ?? 0) + 1);
  const homeCounts = new Map<string, { livedIn: boolean; currentlyHome: boolean }>();
  for (const residence of residences.rows) {
    const current = homeCounts.get(residence.placeId) ?? { livedIn: false, currentlyHome: false };
    current.livedIn = true;
    current.currentlyHome ||= residence.ongoing;
    homeCounts.set(residence.placeId, current);
  }
  return { counts, homeCounts, result };
}

async function decoratedPlaces(owner: string) {
  const placeRows = await sql<{
    id: string;
    placeId: string;
    ownerUserid: string;
    place: string;
    country: string | null;
    type: string | null;
    wantToGo: boolean;
    firstVisited: string | null;
    lastVisited: string | null;
    notes: string | null;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
  }>`SELECT p.id, t.place_id, t.owner_userid, p.name AS place,
    p.country, p.place_type AS type, t.want_to_go, p.first_visited, p.last_visited,
    p.notes, t.archived, t.created_at, t.updated_at FROM app.travel_places t
    JOIN app.places p ON p.id=t.place_id AND p.owner_userid=t.owner_userid
    WHERE t.owner_userid=${owner}`.execute(db);
  const places = placeRows.rows;
  const { counts, homeCounts } = await placeRelationships(owner);
  return places.map((place) => {
    const segmentCount = counts.get(place.id) ?? 0;
    const home = homeCounts.get(place.id);
    const status = place.wantToGo
      ? 'Want to go'
      : segmentCount > 0 || home?.livedIn
        ? 'Visited'
        : 'Saved';
    return {
      ...place,
      status,
      relationships: {
        visited: segmentCount > 0,
        segmentCount,
        livedIn: home?.livedIn ?? false,
        currentlyHome: home?.currentlyHome ?? false,
        wantToGo: place.wantToGo,
        status,
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
      .selectFrom('app.places')
      .select(['id', 'name as place', 'country'])
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
      countries: [...new Set(segmentPlaces.flatMap(({ country }) => (country ? [country] : [])))],
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
        (b.startDate ?? '').localeCompare(a.startDate ?? '') || a.name.localeCompare(b.name),
    );
  return {
    journeys: paginate(filtered, input).items,
    total: filtered.length,
    limit: input.limit,
    offset: input.offset,
    truncated: input.offset + input.limit < filtered.length,
  };
}

async function selectedJourney(owner: string, id: string) {
  return db
    .selectFrom('app.travelJourneys')
    .selectAll()
    .where('ownerUserid', '=', owner)
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function getTravelJourney(owner: string, input: { id: string }) {
  const journey = await selectedJourney(owner, input.id);
  if (!journey) return null;
  const [segments, legs, stays, places] = await Promise.all([
    db
      .selectFrom('app.travelJourneySegments as s')
      .innerJoin('app.places as p', 'p.id', 's.placeId')
      .select([
        's.id',
        's.seq',
        's.journeyId',
        's.placeId',
        's.arrivalDate',
        's.departureDate',
        's.notes',
        's.createdAt',
        's.updatedAt',
        'p.name as place',
        'p.country',
      ])
      .where('s.ownerUserid', '=', owner)
      .where('s.journeyId', '=', journey.id)
      .orderBy('s.seq')
      .execute(),
    allTransport(owner).then((rows) =>
      rows
        .filter((leg) => leg.journeyId === journey.id)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id.localeCompare(b.id)),
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
      .select(['id', 'name', 'startDate'])
      .where('ownerUserid', '=', owner)
      .execute(),
    db
      .selectFrom('app.places')
      .select(['id', 'name as place', 'country'])
      .where('ownerUserid', '=', owner)
      .execute(),
  ]);
  const journeyById = new Map(journeys.map((journey) => [journey.id, journey]));
  const placeById = new Map(places.map((place) => [place.id, place]));
  const filtered = rows
    .filter((segment) => {
      const place = placeById.get(segment.placeId);
      return (
        (!input.journeyId || segment.journeyId === input.journeyId) &&
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

export async function getTravelSegment(owner: string, input: { id: string }) {
  let query = db
    .selectFrom('app.travelJourneySegments as s')
    .innerJoin('app.places as p', 'p.id', 's.placeId')
    .innerJoin('app.travelJourneys as j', 'j.id', 's.journeyId')
    .select([
      's.id',
      's.journeyId',
      's.seq',
      's.placeId',
      's.arrivalDate',
      's.departureDate',
      's.notes',
      's.createdAt',
      's.updatedAt',
      'p.name as place',
      'p.country',
      'j.name as journeyName',
    ])
    .where('s.ownerUserid', '=', owner);
  query = query.where('s.id', '=', input.id);
  const segment = await query.executeTakeFirst();
  if (!segment) return null;
  const [legs, stays] = await Promise.all([
    allTransport(owner).then((rows) =>
      rows
        .filter((leg) => leg.depSegmentId === segment.id || leg.arrSegmentId === segment.id)
        .sort((a, b) => compareNullableDate(a.date, b.date) || a.id.localeCompare(b.id)),
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
    .sort(
      (a, b) => (a.country ?? '').localeCompare(b.country ?? '') || a.place.localeCompare(b.place),
    );
  const page = paginate(rows, input);
  return {
    places: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    truncated: page.truncated,
  };
}

export async function getTravelPlace(owner: string, input: { id: string }) {
  const place = (await decoratedPlaces(owner)).find((row) => row.id === input.id);
  if (!place) return null;
  const [segments, residences] = await Promise.all([
    db
      .selectFrom('app.travelJourneySegments as s')
      .innerJoin('app.travelJourneys as j', 'j.id', 's.journeyId')
      .select([
        's.id',
        's.arrivalDate',
        's.departureDate',
        's.seq',
        'j.id as journeyId',
        'j.name as journeyName',
      ])
      .where('s.ownerUserid', '=', owner)
      .where('s.placeId', '=', place.id)
      .orderBy('s.arrivalDate')
      .execute(),
    listPlaceResidences(owner, { limit: 200, offset: 0, placeId: place.id }).then(
      (result) => result.residences,
    ),
  ]);
  return {
    ...place,
    visitHistory: segments,
    residences,
    ...(place.status === 'Visited' && !segments.length ? { visitedWithoutSegment: true } : {}),
  };
}

export async function listTravelCountries(owner: string) {
  const segments = await db
    .selectFrom('app.travelJourneySegments as s')
    .innerJoin('app.places as p', 'p.id', 's.placeId')
    .select(['p.country', 'p.name as place'])
    .where('s.ownerUserid', '=', owner)
    .execute();
  const countryMap = new Map<string, Set<string>>();
  for (const segment of segments) {
    if (!segment.country) continue;
    const current = countryMap.get(segment.country) ?? new Set<string>();
    current.add(segment.place);
    countryMap.set(segment.country, current);
  }
  const residencePlaces = await db
    .selectFrom('app.placeResidences as r')
    .innerJoin('app.places as p', 'p.id', 'r.placeId')
    .select('p.country')
    .where('r.ownerUserid', '=', owner)
    .execute();
  const placeIdsWithVisits = await db
    .selectFrom('app.placeVisits as v')
    .innerJoin('app.places as p', 'p.id', 'v.placeId')
    .select('p.country')
    .where('v.ownerUserid', '=', owner)
    .execute();
  const placesStatus = new Set(
    placeIdsWithVisits.flatMap((place) => (place.country ? [place.country] : [])),
  );
  for (const residence of residencePlaces)
    if (residence.country) placesStatus.add(residence.country);
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
      'Countries and place names are derived from journey stops; placesStatusCountryCount counts countries with a recorded Visit or Residence.',
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
    bookingRef?: string;
    fromDate?: string;
    toDate?: string;
  },
) {
  const rows = await allTransport(owner);
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
      (!input.bookingRef || norm(leg.bookingRef) === norm(input.bookingRef)) &&
      (!input.fromDate || (leg.date ?? '') >= input.fromDate) &&
      (!input.toDate || (leg.date ?? '9999') <= input.toDate),
  );
  filtered.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id.localeCompare(b.id));
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
  input: { limit: number; offset: number; query?: string; country?: string },
) {
  return listAirportWorkingSet(owner, input);
}

export async function getTravelAirport(_owner: string, input: { code: string }) {
  return getCuratedAirport(_owner, input.code);
}

export async function listTravelStays(
  owner: string,
  input: {
    limit: number;
    offset: number;
    city?: string;
    segmentId?: string;
    journeyId?: string;
    evidence?: string;
  },
) {
  const stays = await db
    .selectFrom('app.travelStays')
    .selectAll()
    .where('ownerUserid', '=', owner)
    .execute();
  const rows = stays
    .filter(
      (stay) =>
        includes(stay.city, input.city) &&
        (!input.segmentId || stay.segmentId === input.segmentId) &&
        (!input.journeyId || stay.journeyId === input.journeyId) &&
        (!input.evidence || stay.evidence === input.evidence),
    )
    .sort((a, b) => compareNullableDate(a.checkIn, b.checkIn) || a.id.localeCompare(b.id));
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
      String(a.id).localeCompare(String(b.id)),
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
  const [placeRows, stays, ideas] = await Promise.all([
    sql<{
      id: string;
      placeId: string;
      ownerUserid: string;
      place: string;
      country: string | null;
      type: string | null;
      wantToGo: boolean;
      firstVisited: string | null;
      lastVisited: string | null;
      notes: string | null;
      archived: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>`SELECT p.id, t.place_id AS "placeId", t.owner_userid AS "ownerUserid", p.name AS place, p.country,
      p.place_type AS type, t.want_to_go AS "wantToGo", p.first_visited AS "firstVisited",
      p.last_visited AS "lastVisited", p.notes, t.archived, t.created_at AS "createdAt",
      t.updated_at AS "updatedAt" FROM app.travel_places t
      JOIN app.places p ON p.id=t.place_id AND p.owner_userid=t.owner_userid
      WHERE t.owner_userid=${owner} AND t.want_to_go ORDER BY p.country, p.name`.execute(db),
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
      .orderBy('idea')
      .execute(),
  ]);
  const places = placeRows.rows;
  const groups = [...new Set(places.map((place) => place.country ?? ''))].map((country) => ({
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
    .sort((a, b) => a.idea.localeCompare(b.idea));
  const page = paginate(filtered, input);
  return {
    ideas: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    truncated: page.truncated,
  };
}
