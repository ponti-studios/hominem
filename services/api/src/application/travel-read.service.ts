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
  const [stops, visits, periods, transports, places] = await Promise.all([
    db
      .selectFrom('app.travelJourneySegments as s')
      .innerJoin('app.travelJourneys as j', 'j.id', 's.journeyId')
      .innerJoin('app.places as p', 'p.id', 's.placeId')
      .select([
        'p.id as placeId',
        'p.name',
        'p.country',
        'p.countryCode',
        's.id as segmentId',
        's.arrivalDate',
        's.departureDate',
        'j.id as journeyId',
        'j.name as journeyName',
      ])
      .where('s.ownerUserid', '=', owner)
      .execute(),
    db
      .selectFrom('app.placeVisits as v')
      .innerJoin('app.places as p', 'p.id', 'v.placeId')
      .select([
        'p.id as placeId',
        'p.name',
        'p.country',
        'p.countryCode',
        'v.id as visitId',
        'v.visitedAt',
        'v.purpose',
        'v.source',
      ])
      .where('v.ownerUserid', '=', owner)
      .where('v.placeId', 'is not', null)
      .execute(),
    db
      .selectFrom('app.placeResidencePeriods as rp')
      .innerJoin('app.placeResidences as r', 'r.id', 'rp.residenceId')
      .innerJoin('app.places as p', 'p.id', 'r.placeId')
      .select([
        'p.id as placeId',
        'p.name',
        'p.country',
        'p.countryCode',
        'r.id as residenceId',
        'rp.id as periodId',
        'rp.startDate',
        'rp.endDate',
        'rp.ongoing',
        'rp.precision',
      ])
      .where('r.ownerUserid', '=', owner)
      .execute(),
    db
      .selectFrom('app.travelTransport')
      .select(['id', 'journeyId', 'date', 'origin', 'destination', 'arrSegmentId', 'depSegmentId'])
      .where('ownerUserid', '=', owner)
      .where('mode', '=', 'air')
      .execute(),
    db
      .selectFrom('app.places')
      .select(['id', 'name', 'country', 'countryCode'])
      .where('ownerUserid', '=', owner)
      .execute(),
  ]);
  const airportCodes = [
    ...new Set(transports.flatMap(({ origin, destination }) => [origin, destination])),
  ];
  const [airportReference, airportCuration] = await Promise.all([
    db
      .selectFrom('app.travelAirportReference')
      .selectAll()
      .where('code', 'in', airportCodes)
      .execute(),
    db
      .selectFrom('app.travelAirports')
      .selectAll()
      .where('ownerUserid', '=', owner)
      .where('code', 'in', airportCodes)
      .execute(),
  ]);

  type Evidence =
    | {
        type: 'stop';
        id: string;
        journeyId: string;
        journeyName: string;
        arrivalDate: string | null;
        departureDate: string | null;
      }
    | {
        type: 'visit';
        id: string;
        visitedAt: string | null;
        purpose: string | null;
        source: string | null;
      }
    | {
        type: 'residence';
        residenceId: string;
        periodId: string;
        startDate: string;
        endDate: string | null;
        ongoing: boolean;
        precision: string;
      }
    | {
        type: 'layover';
        airportCode: string;
        airportName: string | null;
        journeyId: string;
        journeyName: string;
        arrivalTransportId: string;
        departureTransportId: string;
        date: string | null;
      };
  type EvidenceType = Evidence['type'];
  type PlaceEvidence = {
    placeId: string | null;
    name: string;
    locationType: 'place' | 'airport';
    evidence: Evidence[];
  };
  type CountryEvidence = {
    country: string;
    countryCode: string | null;
    places: Map<string, PlaceEvidence>;
  };
  const countries = new Map<string, CountryEvidence>();
  const countryAliases: Record<string, string> = {
    uk: 'GB',
    'united kingdom': 'GB',
    usa: 'US',
    'united states': 'US',
    'united states of america': 'US',
  };
  const countryKey = (name: string | null, code: string | null) => {
    const normalizedCode = code?.trim().toUpperCase();
    const codeAlias = countryAliases[code?.trim().toLowerCase() ?? ''];
    const nameAlias = countryAliases[name?.trim().toLowerCase() ?? ''];
    return codeAlias || nameAlias || normalizedCode || null;
  };
  const countryNames: Record<string, string> = {
    GB: 'United Kingdom',
    US: 'United States',
  };
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const getPlaceEvidence = (
    name: string | null,
    code: string | null,
    placeId: string | null,
    placeName: string,
    locationType: PlaceEvidence['locationType'],
  ) => {
    const key = countryKey(name, code);
    if (!key) return null;
    let country = countries.get(key);
    if (!country) {
      country = {
        country: countryNames[key] ?? regionNames.of(key) ?? name ?? key,
        countryCode: key,
        places: new Map(),
      };
      countries.set(key, country);
    }
    const placeKey = placeId ?? `${locationType}:${placeName.toLocaleLowerCase()}`;
    let place = country.places.get(placeKey);
    if (!place) {
      place = { placeId, name: placeName, locationType, evidence: [] };
      country.places.set(placeKey, place);
    }
    return place;
  };

  for (const stop of stops) {
    const place = getPlaceEvidence(
      stop.country,
      stop.countryCode,
      stop.placeId,
      stop.name,
      'place',
    );
    place?.evidence.push({
      type: 'stop',
      id: stop.segmentId,
      journeyId: stop.journeyId,
      journeyName: stop.journeyName,
      arrivalDate: stop.arrivalDate,
      departureDate: stop.departureDate,
    });
  }
  for (const visit of visits) {
    const place = getPlaceEvidence(
      visit.country,
      visit.countryCode,
      visit.placeId,
      visit.name,
      'place',
    );
    place?.evidence.push({
      type: 'visit',
      id: visit.visitId,
      visitedAt: visit.visitedAt,
      purpose: visit.purpose,
      source: visit.source,
    });
  }
  for (const period of periods) {
    const place = getPlaceEvidence(
      period.country,
      period.countryCode,
      period.placeId,
      period.name,
      'place',
    );
    place?.evidence.push({
      type: 'residence',
      residenceId: period.residenceId,
      periodId: period.periodId,
      startDate: period.startDate,
      endDate: period.endDate,
      ongoing: period.ongoing,
      precision: period.precision,
    });
  }

  type AirportEvidenceLocation = {
    code: string | null;
    name: string | null;
    city: string | null;
    country: string | null;
  };
  const airportByCode = new Map<string, AirportEvidenceLocation>();
  for (const airport of airportReference)
    if (airport.code) airportByCode.set(airport.code.toUpperCase(), airport);
  for (const airport of airportCuration) airportByCode.set(airport.code.toUpperCase(), airport);
  const journeyNames = new Map(stops.map((stop) => [stop.journeyId, stop.journeyName]));
  const groupedFlights = new Map<string, typeof transports>();
  for (const flight of transports) {
    const group = groupedFlights.get(flight.journeyId) ?? [];
    group.push(flight);
    groupedFlights.set(flight.journeyId, group);
  }
  for (const [journeyId, flights] of groupedFlights) {
    const connected = new Map<
      string,
      { inbound: (typeof flights)[number]; outbound: (typeof flights)[number] }
    >();
    for (const inbound of flights) {
      for (const outbound of flights) {
        const code = inbound.destination.trim().toUpperCase();
        if (
          inbound.id !== outbound.id &&
          inbound.destination.trim().toUpperCase() === outbound.origin.trim().toUpperCase() &&
          !inbound.arrSegmentId &&
          !outbound.depSegmentId
        )
          connected.set(code, { inbound, outbound });
      }
    }
    for (const [code, pair] of connected) {
      const airport = airportByCode.get(code);
      if (!airport?.country) continue;
      const curated = airportCuration.find((row) => row.code.toUpperCase() === code);
      const airportName = curated?.name ?? airport.name;
      const locationName = curated?.servesPlace ?? airport.city ?? airportName ?? code;
      const countryCode =
        /^[A-Z]{2}$/.test(airport.country) && !countryAliases[airport.country.toLowerCase()]
          ? airport.country
          : null;
      const country = countryCode
        ? (countryNames[countryCode] ?? airport.country)
        : airport.country;
      const matchingPlaces = places.filter(
        (place) =>
          place.name.toLocaleLowerCase() === locationName.toLocaleLowerCase() &&
          countryKey(place.country, place.countryCode) === countryKey(country, countryCode),
      );
      const resolved = matchingPlaces.length === 1 ? matchingPlaces[0] : null;
      const place = getPlaceEvidence(
        resolved?.country ?? country,
        resolved?.countryCode ?? countryCode,
        resolved?.id ?? null,
        locationName,
        resolved ? 'place' : 'airport',
      );
      if (!place) continue;
      place.evidence.push({
        type: 'layover',
        airportCode: code,
        airportName,
        journeyId,
        journeyName: journeyNames.get(journeyId) ?? 'Journey',
        arrivalTransportId: pair.inbound.id,
        departureTransportId: pair.outbound.id,
        date: pair.inbound.date,
      });
    }
  }

  const evidenceOrder: EvidenceType[] = ['stop', 'layover', 'visit', 'residence'];
  const countryRows = [...countries.values()]
    .sort((a, b) => a.country.localeCompare(b.country))
    .map((country) => {
      const placeRows = [...country.places.values()]
        .map((place) => ({
          ...place,
          evidence: place.evidence.sort(
            (a, b) =>
              evidenceOrder.indexOf(a.type) - evidenceOrder.indexOf(b.type) ||
              JSON.stringify(a).localeCompare(JSON.stringify(b)),
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        country: country.country,
        countryCode: country.countryCode,
        places: placeRows,
        evidenceTypes: evidenceOrder.filter((type) =>
          placeRows.some((place) => place.evidence.some((evidence) => evidence.type === type)),
        ),
      };
    });
  return {
    countries: countryRows,
    evidenceTypes: evidenceOrder.filter((type) =>
      countryRows.some((country) => country.evidenceTypes.includes(type)),
    ),
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
