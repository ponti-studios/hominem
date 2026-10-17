import { db, sql } from '@hominem/db/core';

import { getTravelAirport } from './airport-catalogue.service';

export type Coordinates = { latitude: number | null; longitude: number | null };
export type Residence = {
  id: string;
  placeId: string;
  place: string;
  periods: {
    startDate: string;
    endDate: string | null;
    ongoing: boolean;
    precision: 'day' | 'month' | 'year';
    note?: string | null;
  }[];
};

export function findOutOfOrderSegmentPairs(
  segments: { id: string; journeyId: string; seq: number; arrivalDate: string | null }[],
) {
  const pairs: [string, string][] = [];
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!;
    for (const other of segments.slice(index + 1)) {
      if (segment.journeyId !== other.journeyId || segment.seq === other.seq) continue;
      const earlier = segment.seq < other.seq ? segment : other;
      const later = segment.seq < other.seq ? other : segment;
      if (
        earlier.arrivalDate !== null &&
        later.arrivalDate !== null &&
        earlier.arrivalDate > later.arrivalDate
      )
        pairs.push([earlier.id, later.id]);
    }
  }
  return pairs;
}

export function haversineKm(a: Coordinates, b: Coordinates): number | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null)
    return null;
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const arc =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc)));
}

function precisionKey(value: string, precision: 'day' | 'month' | 'year') {
  return value.slice(0, precision === 'year' ? 4 : precision === 'month' ? 7 : 10);
}

export function labelHomeGap(start: string, end: string, residences: Residence[]) {
  const periods = residences.flatMap((residence) =>
    residence.periods.map((period) => ({ residence, period })),
  );
  const label = (
    residence: Residence,
    period: Residence['periods'][number],
    inferred: boolean,
    rule: string,
  ) => ({
    place: residence.place,
    placeId: residence.placeId,
    period: { ...period },
    inferred,
    rule,
  });
  const ongoing = periods.find(({ period }) => period.ongoing && start >= period.startDate);
  if (ongoing) return label(ongoing.residence, ongoing.period, false, 'ongoing_period');
  const bounded = periods.find(
    ({ period }) => period.endDate && start >= period.startDate && end <= period.endDate,
  );
  if (bounded) return label(bounded.residence, bounded.period, false, 'bounded_period');
  const precise = periods.find(
    ({ period }) =>
      period.precision !== 'day' &&
      precisionKey(start, period.precision) === precisionKey(end, period.precision) &&
      precisionKey(start, period.precision) === precisionKey(period.startDate, period.precision),
  );
  if (precise) return label(precise.residence, precise.period, false, 'precision_period');
  const inferred = periods.find(({ period }) => {
    if (period.precision !== 'day' || period.endDate || period.ongoing || start < period.startDate)
      return false;
    const nextDayPrecision = periods
      .map(({ period: candidate }) => candidate)
      .filter(
        (candidate) => candidate.precision === 'day' && candidate.startDate > period.startDate,
      )
      .map((candidate) => candidate.startDate)
      .sort()[0];
    return !nextDayPrecision || end < nextDayPrecision;
  });
  return inferred
    ? label(inferred.residence, inferred.period, true, 'inferred_until_next_day_precision_period')
    : null;
}

export const shiftDate = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const nextPrecisionBoundary = (value: string, precision: 'month' | 'year') => {
  const date = new Date(`${value}T00:00:00Z`);
  if (precision === 'month') date.setUTCMonth(date.getUTCMonth() + 1, 1);
  else date.setUTCFullYear(date.getUTCFullYear() + 1, 0, 1);
  return date.toISOString().slice(0, 10);
};

export function residenceBoundaries(start: string, end: string, residences: Residence[]) {
  const boundaries = new Set<string>();
  for (const { periods } of residences) {
    for (const period of periods) {
      if (period.startDate > start && period.startDate < end) boundaries.add(period.startDate);
      if (period.endDate) {
        const afterEnd = shiftDate(period.endDate, 1);
        if (afterEnd > start && afterEnd < end) boundaries.add(afterEnd);
      }
      if (period.precision === 'month' || period.precision === 'year') {
        const prefix = period.startDate.slice(0, period.precision === 'month' ? 7 : 4);
        const normalizedBoundary = nextPrecisionBoundary(
          period.precision === 'month' ? `${prefix}-01` : `${prefix}-01-01`,
          period.precision,
        );
        if (normalizedBoundary > start && normalizedBoundary < end)
          boundaries.add(normalizedBoundary);
      }
    }
  }
  return [...boundaries].sort();
}

export const lower = (value: unknown) => String(value ?? '').toLocaleLowerCase();
export const contains = (value: unknown, query: string) => lower(value).includes(lower(query));
export const daysBetween = (a: string | null, b: string | null) => {
  if (!a || !b) return null;
  return Math.max(
    0,
    Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000),
  );
};
export const dayCount = (start: string | null, end: string | null) => {
  const nights = daysBetween(start, end);
  return nights === null ? null : nights + 1;
};
export const overlaps = (
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
) => Boolean(aStart && aEnd && bStart && bEnd && aStart < bEnd && bStart < aEnd);
export const compareDate = (a: string | null, b: string | null) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : a.localeCompare(b);
export const makePage = <T>(items: T[], limit: number) => ({
  items: items.slice(0, limit),
  total: items.length,
  truncated: items.length > limit,
});

export async function loadTravelData(owner: string) {
  const [
    journeys,
    segments,
    places,
    canonicalPlaces,
    transport,
    stays,
    curations,
    referenceRows,
    ideas,
    residenceRows,
  ] = await Promise.all([
    db.selectFrom('app.travelJourneys').selectAll().where('ownerUserid', '=', owner).execute(),
    db
      .selectFrom('app.travelJourneySegments')
      .selectAll()
      .where('ownerUserid', '=', owner)
      .execute(),
    sql<{
      id: string;
      place: string;
      country: string | null;
      type: string | null;
      notes: string | null;
      archived: boolean;
      want_to_go: boolean;
      created_at: string;
      updated_at: string;
    }>`SELECT p.id, p.name AS place, p.country, p.place_type AS type, p.notes,
      t.archived, t.want_to_go, t.created_at, t.updated_at FROM app.travel_places t
      JOIN app.places p ON p.id=t.place_id AND p.owner_userid=t.owner_userid
      WHERE t.owner_userid=${owner}`
      .execute(db)
      .then((result) =>
        result.rows.map((row) => ({
          id: row.id,
          place: row.place,
          country: row.country,
          type: row.type,
          notes: row.notes,
          archived: row.archived,
          wantToGo: row.want_to_go,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      ),
    db
      .selectFrom('app.places')
      .select(['id', 'name as place', 'country'])
      .where('ownerUserid', '=', owner)
      .execute(),
    db.selectFrom('app.travelTransport').selectAll().where('ownerUserid', '=', owner).execute(),
    db.selectFrom('app.travelStays').selectAll().where('ownerUserid', '=', owner).execute(),
    db.selectFrom('app.travelAirports').selectAll().where('ownerUserid', '=', owner).execute(),
    db.selectFrom('app.travelAirportReference').selectAll().where('code', 'is not', null).execute(),
    db.selectFrom('app.travelIdeas').selectAll().where('ownerUserid', '=', owner).execute(),
    sql<{
      id: string;
      place_id: string;
      place: string;
      start_date: string;
      end_date: string | null;
      ongoing: boolean;
      precision: string;
      note: string | null;
    }>`SELECT r.id, r.place_id, p.name AS place, rp.start_date, rp.end_date,
      rp.ongoing, rp.precision, rp.note FROM app.place_residences r
      JOIN app.places p ON p.id=r.place_id AND p.owner_userid=r.owner_userid
      JOIN app.place_residence_periods rp ON rp.residence_id=r.id AND rp.owner_userid=r.owner_userid
      WHERE r.owner_userid=${owner}`
      .execute(db)
      .then((result) =>
        result.rows.map((row) => ({
          id: row.id,
          placeId: row.place_id,
          place: row.place,
          startDate: row.start_date,
          endDate: row.end_date,
          ongoing: row.ongoing,
          precision: row.precision,
          note: row.note,
        })),
      ),
  ]);
  const residenceMap = new Map<string, Residence>();
  for (const row of residenceRows) {
    const residence = residenceMap.get(row.id) ?? {
      id: row.id,
      placeId: row.placeId,
      place: row.place,
      periods: [],
    };
    residence.periods.push({
      startDate: String(row.startDate).slice(0, 10),
      endDate: row.endDate ? String(row.endDate).slice(0, 10) : null,
      ongoing: row.ongoing,
      precision: row.precision === 'month' ? 'month' : row.precision === 'year' ? 'year' : 'day',
      ...(row.note ? { note: row.note } : {}),
    });
    residenceMap.set(row.id, residence);
  }
  const residences = [...residenceMap.values()];
  const airportByCode = new Map<
    string,
    Coordinates & {
      code: string;
      name: string | null;
      servesPlace: string | null;
      city: string | null;
      country: string | null;
    }
  >();
  for (const airport of referenceRows) {
    const code = airport.code!.toUpperCase();
    if (!airportByCode.has(code))
      airportByCode.set(code, {
        code,
        name: airport.name,
        servesPlace: airport.city,
        city: airport.city,
        country: airport.country,
        latitude: airport.latitude,
        longitude: airport.longitude,
      });
  }
  for (const airport of curations) {
    const code = airport.code.toUpperCase();
    const reference = airportByCode.get(code);
    airportByCode.set(code, {
      code,
      name: airport.name ?? reference?.name ?? null,
      servesPlace: airport.servesPlace ?? reference?.servesPlace ?? null,
      city: airport.city ?? reference?.city ?? null,
      country: airport.country ?? reference?.country ?? null,
      latitude: airport.latitude ?? reference?.latitude ?? null,
      longitude: airport.longitude ?? reference?.longitude ?? null,
    });
  }
  for (const leg of transport)
    for (const rawCode of [leg.origin, leg.destination]) {
      const code = rawCode.toUpperCase();
      if (!airportByCode.has(code))
        airportByCode.set(code, {
          code,
          name: null,
          servesPlace: null,
          city: null,
          country: null,
          latitude: null,
          longitude: null,
        });
    }
  const airports = [...airportByCode.values()];
  const endpointKey = (code: string, referenceId: string | null) =>
    `${code.toUpperCase()}:${referenceId ?? ''}`;
  const endpointSelections = new Map<string, { code: string; referenceId: string | null }>();
  for (const leg of transport) {
    for (const endpoint of [
      { code: leg.origin, referenceId: leg.originReferenceId },
      { code: leg.destination, referenceId: leg.destinationReferenceId },
    ]) {
      endpointSelections.set(endpointKey(endpoint.code, endpoint.referenceId), endpoint);
    }
  }
  const selectedEndpoints = new Map(
    await Promise.all(
      [...endpointSelections].map(
        async ([key, endpoint]) =>
          [key, await getTravelAirport(owner, endpoint.code, endpoint.referenceId)] as const,
      ),
    ),
  );
  const placeById = new Map(canonicalPlaces.map((place) => [place.id, place]));
  const journeyById = new Map(journeys.map((journey) => [journey.id, journey]));
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  const resolveLeg = (leg: (typeof transport)[number]) => {
    const origin =
      selectedEndpoints.get(endpointKey(leg.origin, leg.originReferenceId)) ??
      airportByCode.get(leg.origin.toUpperCase());
    const destination =
      selectedEndpoints.get(endpointKey(leg.destination, leg.destinationReferenceId)) ??
      airportByCode.get(leg.destination.toUpperCase());
    return {
      ...leg,
      originCode: leg.origin,
      originName: origin?.name ?? null,
      originPlace: origin?.servesPlace ?? null,
      destinationCode: leg.destination,
      destinationName: destination?.name ?? null,
      destinationPlace: destination?.servesPlace ?? null,
      distanceKm: origin && destination ? haversineKm(origin, destination) : null,
    };
  };
  return {
    journeys,
    segments,
    places,
    transport: transport.map(resolveLeg),
    stays,
    airports,
    ideas,
    residences,
    airportByCode,
    placeById,
    journeyById,
    segmentById,
  };
}
