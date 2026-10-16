import { db } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';

import { travelResidencePeriodsSchema } from '../schemas/travel-residences.schema';

type Coordinates = { latitude: number | null; longitude: number | null };
type Residence = {
  id: string;
  legacyId: string;
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
    legacyId: residence.legacyId,
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

const shiftDate = (value: string, days: number) => {
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

function residenceBoundaries(start: string, end: string, residences: Residence[]) {
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

const lower = (value: unknown) => String(value ?? '').toLocaleLowerCase();
const contains = (value: unknown, query: string) => lower(value).includes(lower(query));
const daysBetween = (a: string | null, b: string | null) => {
  if (!a || !b) return null;
  return Math.max(
    0,
    Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000),
  );
};
const dayCount = (start: string | null, end: string | null) => {
  const nights = daysBetween(start, end);
  return nights === null ? null : nights + 1;
};
const overlaps = (
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
) => Boolean(aStart && aEnd && bStart && bEnd && aStart < bEnd && bStart < aEnd);
const compareDate = (a: string | null, b: string | null) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : a.localeCompare(b);
const makePage = <T>(items: T[], limit: number) => ({
  items: items.slice(0, limit),
  total: items.length,
  truncated: items.length > limit,
});

async function loadTravelData(owner: string) {
  const [journeys, segments, places, transport, stays, airports, ideas, residenceRows] =
    await Promise.all([
      db.selectFrom('app.travelJourneys').selectAll().where('ownerUserid', '=', owner).execute(),
      db
        .selectFrom('app.travelJourneySegments')
        .selectAll()
        .where('ownerUserid', '=', owner)
        .execute(),
      db.selectFrom('app.travelPlaces').selectAll().where('ownerUserid', '=', owner).execute(),
      db.selectFrom('app.travelTransport').selectAll().where('ownerUserid', '=', owner).execute(),
      db.selectFrom('app.travelStays').selectAll().where('ownerUserid', '=', owner).execute(),
      db.selectFrom('app.travelAirports').selectAll().where('ownerUserid', '=', owner).execute(),
      db.selectFrom('app.travelIdeas').selectAll().where('ownerUserid', '=', owner).execute(),
      db
        .selectFrom('app.travelResidences as r')
        .innerJoin('app.travelPlaces as p', 'p.id', 'r.placeId')
        .select(['r.id', 'r.legacyId', 'r.placeId', 'p.place', 'r.periods'])
        .where('r.ownerUserid', '=', owner)
        .execute(),
    ]);
  const residences: Residence[] = residenceRows.map((row) => ({
    id: row.id,
    legacyId: row.legacyId,
    placeId: row.placeId,
    place: row.place,
    periods: travelResidencePeriodsSchema.parse(
      typeof row.periods === 'string' ? JSON.parse(row.periods) : row.periods,
    ),
  }));
  const airportByCode = new Map(airports.map((airport) => [airport.code.toUpperCase(), airport]));
  const placeById = new Map(places.map((place) => [place.id, place]));
  const journeyById = new Map(journeys.map((journey) => [journey.id, journey]));
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  const resolveLeg = (leg: (typeof transport)[number]) => {
    const origin = airportByCode.get(leg.origin.toUpperCase());
    const destination = airportByCode.get(leg.destination.toUpperCase());
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

export async function travelDistance(
  owner: string,
  input: { origin: string; destination: string },
) {
  const airports = await db
    .selectFrom('app.travelAirports')
    .selectAll()
    .where('ownerUserid', '=', owner)
    .execute();
  const origin = airports.find((airport) => lower(airport.code) === lower(input.origin));
  const destination = airports.find((airport) => lower(airport.code) === lower(input.destination));
  if (!origin || !destination) throw new ValidationError('unknown_airport');
  return {
    origin,
    destination,
    distanceKm: haversineKm(origin, destination),
  };
}

export async function travelValidate(owner: string) {
  const data = await loadTravelData(owner);
  type Offender = { id: string; legacyId: string; detail: string };
  const checks: Record<string, { count: number; offenders: Offender[] }> = {};
  const add = (name: string, offenders: Offender[], count = offenders.length) =>
    (checks[name] = { count, offenders });
  const ref = (row: { id: string; legacyId: string }, detail: string): Offender => ({
    id: row.id,
    legacyId: row.legacyId,
    detail,
  });
  add(
    'orphan_segment',
    data.segments
      .filter((row) => !data.journeyById.has(row.journeyId))
      .map((row) => ref(row, `Journey ${row.journeyId} is missing.`)),
  );
  add(
    'orphan_stay',
    data.stays
      .filter(
        (row) =>
          row.evidence !== 'want' &&
          ((row.segmentId !== null && !data.segmentById.has(row.segmentId)) ||
            (row.journeyId !== null && !data.journeyById.has(row.journeyId))),
      )
      .map((row) => ref(row, 'Linked segment or journey is missing.')),
  );
  add(
    'orphan_leg',
    data.transport
      .filter(
        (row) =>
          !data.journeyById.has(row.journeyId) ||
          (row.depSegmentId !== null && !data.segmentById.has(row.depSegmentId)) ||
          (row.arrSegmentId !== null && !data.segmentById.has(row.arrSegmentId)),
      )
      .map((row) => ref(row, 'Linked journey or segment is missing.')),
  );
  add(
    'unknown_airport_code',
    data.transport
      .filter(
        (row) =>
          !data.airportByCode.has(row.origin.toUpperCase()) ||
          !data.airportByCode.has(row.destination.toUpperCase()),
      )
      .map((row) => ref(row, 'Origin or destination airport code is not registered.')),
  );
  const duplicateLegacyOffenders: (Offender & { entityType: string })[] = [];
  let duplicateLegacyGroupCount = 0;
  const collectDuplicateIds = (entity: string, rows: { id: string; legacyId: string }[]) => {
    const byLegacy = new Map<string, typeof rows>();
    for (const row of rows)
      byLegacy.set(row.legacyId, [...(byLegacy.get(row.legacyId) ?? []), row]);
    const duplicates = [...byLegacy].filter(([, matches]) => matches.length > 1);
    duplicateLegacyGroupCount += duplicates.length;
    return duplicates.flatMap(([legacyId, matches]) =>
      matches.map((row) => ({
        ...ref(row, `Duplicate ${entity} legacyId ${legacyId}.`),
        entityType: entity.toLocaleLowerCase(),
      })),
    );
  };
  const duplicateEntities: [string, { id: string; legacyId: string }[]][] = [
    ['Journey', data.journeys],
    ['Segment', data.segments],
    ['Place', data.places],
    ['Transport', data.transport],
    ['Stay', data.stays],
    ['Airport', data.airports],
    ['Idea', data.ideas],
    ['Residence', data.residences],
  ];
  for (const [entity, rows] of duplicateEntities) {
    duplicateLegacyOffenders.push(...collectDuplicateIds(entity, rows));
  }
  add('duplicate_legacy_id', duplicateLegacyOffenders, duplicateLegacyGroupCount);
  const segmentCounts = new Map<string, number>();
  for (const segment of data.segments)
    segmentCounts.set(segment.placeId, (segmentCounts.get(segment.placeId) ?? 0) + 1);
  add(
    'place_visited_without_segment',
    data.places
      .filter((place) => place.status === 'Visited' && !segmentCounts.has(place.id))
      .map((place) => ref(place, 'Stored status is Visited but no journey segment references it.')),
  );
  add(
    'segment_place_missing',
    data.segments
      .filter((segment) => !data.placeById.has(segment.placeId))
      .map((segment) => ref(segment, `Place ${segment.placeId} is missing.`)),
  );
  add(
    'journey_date_inversion',
    data.journeys
      .filter(
        (journey) => journey.startDate && journey.endDate && journey.endDate < journey.startDate,
      )
      .map((journey) => ref(journey, 'Journey endDate is before startDate.')),
  );
  add(
    'segment_date_inversion',
    data.segments
      .filter(
        (segment) =>
          segment.arrivalDate &&
          segment.departureDate &&
          segment.departureDate < segment.arrivalDate,
      )
      .map((segment) => ref(segment, 'Segment departureDate is before arrivalDate.')),
  );
  add(
    'stay_date_inversion',
    data.stays
      .filter((stay) => stay.checkIn && stay.checkOut && stay.checkOut < stay.checkIn)
      .map((stay) => ref(stay, 'Stay checkOut is before checkIn.')),
  );
  const segmentsByJourney = new Map<string, typeof data.segments>();
  for (const segment of data.segments)
    segmentsByJourney.set(segment.journeyId, [
      ...(segmentsByJourney.get(segment.journeyId) ?? []),
      segment,
    ]);
  const sequenceOffenders: Offender[] = [];
  for (const rows of segmentsByJourney.values()) {
    const counts = new Map<number, number>();
    for (const row of rows) counts.set(row.seq, (counts.get(row.seq) ?? 0) + 1);
    for (const [seq, count] of counts) {
      if (count > 1) {
        for (const row of rows.filter((candidate) => candidate.seq === seq))
          sequenceOffenders.push(ref(row, `Sequence ${seq} is duplicated within its journey.`));
      }
    }
    const ordered = [...counts.keys()].filter((seq) => seq >= 1).sort((a, b) => a - b);
    if (ordered[0] !== undefined && ordered[0] > 1) {
      const first = rows.find((row) => row.seq === ordered[0])!;
      sequenceOffenders.push(ref(first, `Missing sequence range 1..${ordered[0] - 1}.`));
    }
    for (let index = 1; index < ordered.length; index++) {
      const previous = ordered[index - 1]!;
      const nextSeq = ordered[index]!;
      if (nextSeq > previous + 1) {
        const next = rows.find((row) => row.seq === nextSeq)!;
        sequenceOffenders.push(
          ref(next, `Missing sequence range ${previous + 1}..${nextSeq - 1}.`),
        );
      }
    }
    for (const row of rows.filter((candidate) => candidate.seq < 1))
      sequenceOffenders.push(ref(row, `Sequence ${row.seq} is below the valid range 1..n.`));
  }
  add('segment_seq_gap_or_dupe', sequenceOffenders);
  add(
    'stay_journey_mismatch',
    data.stays
      .filter((stay) => {
        const segment = stay.segmentId ? data.segmentById.get(stay.segmentId) : undefined;
        return Boolean(segment && stay.journeyId !== segment.journeyId);
      })
      .map((stay) => ref(stay, 'Stay journeyId differs from its segment journeyId.')),
  );
  add(
    'stay_partially_linked',
    data.stays
      .filter((stay) => (stay.segmentId === null) !== (stay.journeyId === null))
      .map((stay) => ref(stay, 'Exactly one of segmentId and journeyId is set.')),
  );
  add(
    'thin_evidence_stays',
    data.stays
      .filter((stay) => stay.evidence === 'thin')
      .map((stay) => ref(stay, 'Stay evidence is thin and needs review.')),
  );
  const journeyOverlapOffenders: Offender[] = [];
  let journeyOverlapCount = 0;
  for (let index = 0; index < data.journeys.length; index++) {
    const journey = data.journeys[index]!;
    for (const other of data.journeys.slice(index + 1)) {
      if (overlaps(journey.startDate, journey.endDate, other.startDate, other.endDate)) {
        journeyOverlapCount++;
        journeyOverlapOffenders.push(
          ref(journey, `Date range overlaps journey ${other.legacyId}.`),
          ref(other, `Date range overlaps journey ${journey.legacyId}.`),
        );
      }
    }
  }
  add('journey_overlap', journeyOverlapOffenders, journeyOverlapCount);
  const segmentOverlapOffenders: Offender[] = [];
  let segmentOverlapCount = 0;
  const outOfOrderPairs = new Set(
    findOutOfOrderSegmentPairs(data.segments).map(([earlier, later]) => `${earlier}\u001f${later}`),
  );
  for (let i = 0; i < data.segments.length; i++) {
    const segment = data.segments[i]!;
    for (const other of data.segments.slice(i + 1)) {
      const samePlace = segment.placeId === other.placeId;
      const earlier = segment.seq < other.seq ? segment : other;
      const later = segment.seq < other.seq ? other : segment;
      const sameJourneyOutOfOrder = outOfOrderPairs.has(`${earlier.id}\u001f${later.id}`);
      if (
        (samePlace &&
          overlaps(
            segment.arrivalDate,
            segment.departureDate,
            other.arrivalDate,
            other.departureDate,
          )) ||
        sameJourneyOutOfOrder
      ) {
        segmentOverlapCount++;
        segmentOverlapOffenders.push(
          ref(segment, `Overlaps or is out of date order with ${other.legacyId}.`),
        );
        segmentOverlapOffenders.push(
          ref(other, `Overlaps or is out of date order with ${segment.legacyId}.`),
        );
      }
    }
  }
  add('segment_overlap', segmentOverlapOffenders, segmentOverlapCount);
  const nearDuplicateLegOffenders: Offender[] = [];
  let nearDuplicateLegCount = 0;
  for (let index = 0; index < data.transport.length; index++) {
    const leg = data.transport[index]!;
    for (const other of data.transport.slice(index + 1)) {
      if (
        leg.date !== null &&
        leg.date === other.date &&
        leg.origin.toUpperCase() === other.origin.toUpperCase() &&
        leg.destination.toUpperCase() === other.destination.toUpperCase() &&
        (!leg.number || !other.number || lower(leg.number) === lower(other.number))
      ) {
        nearDuplicateLegCount++;
        nearDuplicateLegOffenders.push(
          ref(leg, `Matches leg ${other.legacyId} by date, route, and flight number.`),
          ref(other, `Matches leg ${leg.legacyId} by date, route, and flight number.`),
        );
      }
    }
  }
  add('near_duplicate_leg', nearDuplicateLegOffenders, nearDuplicateLegCount);
  const nearDuplicateJourneyOffenders: Offender[] = [];
  let nearDuplicateJourneyCount = 0;
  for (let index = 0; index < data.journeys.length; index++) {
    const journey = data.journeys[index]!;
    const first = [...(segmentsByJourney.get(journey.id) ?? [])].sort((a, b) => a.seq - b.seq)[0];
    if (!first) continue;
    for (const other of data.journeys.slice(index + 1)) {
      const otherFirst = [...(segmentsByJourney.get(other.id) ?? [])].sort(
        (a, b) => a.seq - b.seq,
      )[0];
      if (
        journey.startDate !== null &&
        journey.startDate === other.startDate &&
        first.placeId === otherFirst?.placeId
      ) {
        nearDuplicateJourneyCount++;
        nearDuplicateJourneyOffenders.push(
          ref(journey, `Shares start date and first place with ${other.legacyId}.`),
          ref(other, `Shares start date and first place with ${journey.legacyId}.`),
        );
      }
    }
  }
  add('near_duplicate_journey', nearDuplicateJourneyOffenders, nearDuplicateJourneyCount);
  for (const check of Object.values(checks))
    check.offenders.sort(
      (a, b) => a.legacyId.localeCompare(b.legacyId) || a.id.localeCompare(b.id),
    );
  return { checks };
}

export async function travelUnresolved(owner: string) {
  const [data, validation] = await Promise.all([loadTravelData(owner), travelValidate(owner)]);
  const stays = data.stays
    .filter((stay) => stay.evidence === 'thin')
    .sort((a, b) => a.legacyId.localeCompare(b.legacyId));
  const ideas = data.ideas
    .filter((idea) => idea.type === 'admin' && idea.status === 'open')
    .sort((a, b) => a.legacyId.localeCompare(b.legacyId));
  return {
    stays: makePage(stays, 100),
    ideas: makePage(ideas, 100),
    validation: Object.fromEntries(
      Object.entries(validation.checks).map(([name, value]) => [name, value.count]),
    ),
  };
}

export async function travelSearch(owner: string, input: { query: string; limit: number }) {
  const data = await loadTravelData(owner);
  const results = {
    journeys: data.journeys
      .filter((row) => contains(row.name, input.query) || contains(row.notes, input.query))
      .sort((a, b) => a.legacyId.localeCompare(b.legacyId) || a.id.localeCompare(b.id)),
    places: data.places
      .filter((row) => contains(row.place, input.query))
      .sort((a, b) => a.legacyId.localeCompare(b.legacyId) || a.id.localeCompare(b.id)),
    stays: data.stays
      .filter(
        (row) =>
          contains(row.property, input.query) ||
          contains(row.city, input.query) ||
          contains(row.bookingRef, input.query),
      )
      .sort((a, b) => a.legacyId.localeCompare(b.legacyId) || a.id.localeCompare(b.id)),
    transport: data.transport
      .filter((row) => contains(row.carrier, input.query) || contains(row.bookingRef, input.query))
      .sort((a, b) => a.legacyId.localeCompare(b.legacyId) || a.id.localeCompare(b.id)),
    ideas: data.ideas
      .filter((row) => contains(row.idea, input.query))
      .sort((a, b) => a.legacyId.localeCompare(b.legacyId) || a.id.localeCompare(b.id)),
  };
  const pages = {
    journeys: makePage(results.journeys, input.limit),
    places: makePage(results.places, input.limit),
    stays: makePage(results.stays, input.limit),
    transport: makePage(results.transport, input.limit),
    ideas: makePage(results.ideas, input.limit),
  };
  const total =
    results.journeys.length +
    results.places.length +
    results.stays.length +
    results.transport.length +
    results.ideas.length;
  return {
    query: input.query,
    total,
    truncated: Object.values(pages).some((page) => page.truncated),
    ...pages,
  };
}

export async function travelStats(owner: string, input: { year?: number } = {}) {
  const data = await loadTravelData(owner);
  const year = input.year === undefined ? undefined : String(input.year);
  const journeys = data.journeys.filter((journey) => !year || journey.startDate?.startsWith(year));
  const journeyIds = new Set(journeys.map((journey) => journey.id));
  const segments = data.segments.filter((segment) => journeyIds.has(segment.journeyId));
  const placesById = new Map<string, (typeof data.places)[number]>();
  for (const segment of segments) {
    const place = data.placeById.get(segment.placeId);
    if (place) placesById.set(place.id, place);
  }
  const countries = [...new Set([...placesById.values()].map((place) => place.country))].sort();
  const transport = data.transport.filter((leg) => journeyIds.has(leg.journeyId));
  const legCountByMode = Object.fromEntries(
    [...new Set(transport.map((leg) => leg.mode))]
      .sort()
      .map((mode) => [mode, transport.filter((leg) => leg.mode === mode).length]),
  );
  const totalDistanceKm = transport.reduce((sum, leg) => sum + (leg.distanceKm ?? 0), 0);
  const longestLeg =
    [...transport]
      .filter((leg) => leg.distanceKm !== null)
      .sort(
        (a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0) || a.legacyId.localeCompare(b.legacyId),
      )[0] ?? null;
  const distanceByJourney = new Map<string, number>();
  for (const leg of transport)
    if (leg.distanceKm !== null)
      distanceByJourney.set(
        leg.journeyId,
        (distanceByJourney.get(leg.journeyId) ?? 0) + leg.distanceKm,
      );
  const longestJourney =
    journeys
      .map((journey) => ({ journey, distanceKm: distanceByJourney.get(journey.id) ?? 0 }))
      .sort(
        (a, b) =>
          b.distanceKm - a.distanceKm || a.journey.legacyId.localeCompare(b.journey.legacyId),
      )[0] ?? null;
  const allTrips = [...journeys]
    .filter((journey) => journey.startDate)
    .sort((a, b) => compareDate(a.startDate, b.startDate));
  const firstTrip = allTrips[0];
  const latestTrip = allTrips.at(-1);
  const countsByYear = Object.fromEntries(
    [
      ...new Set(
        data.journeys.flatMap((journey) =>
          journey.startDate ? [journey.startDate.slice(0, 4)] : [],
        ),
      ),
    ]
      .sort()
      .map((value) => [
        value,
        data.journeys.filter((journey) => journey.startDate?.startsWith(value)).length,
      ]),
  );
  return {
    journeyCount: journeys.length,
    segmentCount: segments.length,
    placeCount: placesById.size,
    countryCount: countries.length,
    countryMethod: 'Derived from the countries of places referenced by journey segments.',
    legCountByMode,
    totalDistanceKm,
    distanceLabel:
      'Recorded transport legs only; this is a floor because many journeys have no recorded legs.',
    longestLeg: longestLeg
      ? {
          legacyId: longestLeg.legacyId,
          originCode: longestLeg.originCode,
          destinationCode: longestLeg.destinationCode,
          originPlace: longestLeg.originPlace,
          destinationPlace: longestLeg.destinationPlace,
          distanceKm: longestLeg.distanceKm,
          date: longestLeg.date,
          journeyLegacyId: data.journeyById.get(longestLeg.journeyId)?.legacyId ?? null,
        }
      : null,
    longestJourneyByDistance: longestJourney
      ? {
          legacyId: longestJourney.journey.legacyId,
          name: longestJourney.journey.name,
          distanceKm: longestJourney.distanceKm,
        }
      : null,
    countsByYear,
    firstTrip: firstTrip
      ? {
          legacyId: firstTrip.legacyId,
          startDate: firstTrip.startDate,
          endDate: firstTrip.endDate,
        }
      : null,
    latestTrip: latestTrip
      ? {
          legacyId: latestTrip.legacyId,
          startDate: latestTrip.startDate,
          endDate: latestTrip.endDate,
        }
      : null,
  };
}

export async function travelTimeline(
  owner: string,
  input: { from?: string; to?: string; limit?: number; offset?: number } = {},
) {
  const data = await loadTravelData(owner);
  const events: Record<string, unknown>[] = data.segments.map((segment) => ({
    type: 'segment',
    id: segment.id,
    legacyId: segment.legacyId,
    place: data.placeById.get(segment.placeId)?.place ?? null,
    country: data.placeById.get(segment.placeId)?.country ?? null,
    arrivalDate: segment.arrivalDate,
    departureDate: segment.departureDate,
    nights: daysBetween(segment.arrivalDate, segment.departureDate),
    journeyId: segment.journeyId,
    journeyLegacyId: data.journeyById.get(segment.journeyId)?.legacyId ?? null,
    seq: segment.seq,
  }));
  const journeys = [...data.journeys]
    .filter((journey) => journey.startDate && journey.endDate)
    .sort((a, b) => compareDate(a.startDate, b.startDate));
  let active: (typeof journeys)[number] | undefined;
  for (const next of journeys) {
    if (!active) {
      active = next;
      continue;
    }
    if (!active.endDate || !next.startDate) continue;
    if (next.startDate <= active.endDate) {
      if (next.endDate && next.endDate > active.endDate) active = next;
      continue;
    }
    const previous = active;
    const start = previous.endDate!;
    const end = next.startDate!;
    const boundaries = residenceBoundaries(start, end, data.residences);
    let cursor = start;
    for (const boundary of [...boundaries, end]) {
      if (boundary <= cursor) continue;
      const sliceEnd = boundary === end ? end : shiftDate(boundary, -1);
      events.push({
        type: 'home_gap',
        startDate: cursor,
        endDate: sliceEnd,
        days: daysBetween(cursor, boundary),
        fromJourneyLegacyId: previous.legacyId,
        toJourneyLegacyId: next.legacyId,
        home: labelHomeGap(cursor, sliceEnd, data.residences),
      });
      cursor = boundary;
    }
    active = next;
  }
  const filtered = events
    .filter((event) => {
      const start = String(
        event.type === 'segment' ? (event.arrivalDate ?? '') : (event.startDate ?? ''),
      );
      const end = String(
        event.type === 'segment' ? (event.departureDate ?? '') : (event.endDate ?? ''),
      );
      return (
        (!input.from || (end !== '' && end >= input.from)) &&
        (!input.to || (start !== '' && start <= input.to))
      );
    })
    .sort((a, b) => {
      const startA = String(a.type === 'segment' ? (a.arrivalDate ?? '') : (a.startDate ?? ''));
      const startB = String(b.type === 'segment' ? (b.arrivalDate ?? '') : (b.startDate ?? ''));
      return (
        startA.localeCompare(startB) ||
        String(a.type).localeCompare(String(b.type)) ||
        String(a.legacyId ?? a.fromJourneyLegacyId ?? '').localeCompare(
          String(b.legacyId ?? b.fromJourneyLegacyId ?? ''),
        )
      );
    });
  const limit = input.limit ?? 100;
  const offset = input.offset ?? 0;
  return {
    events: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
    truncated: offset + limit < filtered.length,
    from: input.from ?? null,
    to: input.to ?? null,
  };
}

export async function travelInsights(owner: string, input: { year?: number } = {}) {
  const data = await loadTravelData(owner);
  const year = input.year === undefined ? undefined : String(input.year);
  const segments = data.segments.filter(
    (segment) => !year || segment.arrivalDate?.startsWith(year),
  );
  const placeStats = new Map<
    string,
    { place: string; country: string; segmentCount: number; days: number; nights: number }
  >();
  const countryStats = new Map<string, { country: string; days: number; nights: number }>();
  const yearStats = new Map<string, number>();
  for (const segment of segments) {
    const place = data.placeById.get(segment.placeId);
    if (!place) continue;
    const nights = daysBetween(segment.arrivalDate, segment.departureDate) ?? 0;
    const days = dayCount(segment.arrivalDate, segment.departureDate) ?? 0;
    const placeStat = placeStats.get(place.id) ?? {
      place: place.place,
      country: place.country,
      segmentCount: 0,
      days: 0,
      nights: 0,
    };
    placeStat.segmentCount++;
    placeStat.days += days;
    placeStat.nights += nights;
    placeStats.set(place.id, placeStat);
    const countryStat = countryStats.get(place.country) ?? {
      country: place.country,
      days: 0,
      nights: 0,
    };
    countryStat.days += days;
    countryStat.nights += nights;
    countryStats.set(place.country, countryStat);
    if (segment.arrivalDate)
      yearStats.set(
        segment.arrivalDate.slice(0, 4),
        (yearStats.get(segment.arrivalDate.slice(0, 4)) ?? 0) + days,
      );
  }
  const dayRows = [...placeStats.values()].sort(
    (a, b) => b.days - a.days || a.place.localeCompare(b.place),
  );
  const nightRows = [...placeStats.values()].sort(
    (a, b) => b.nights - a.nights || a.place.localeCompare(b.place),
  );
  const transport = data.transport.filter((leg) => !year || leg.date?.startsWith(year));
  const frequentRoutesMap = new Map<
    string,
    {
      originCode: string;
      destinationCode: string;
      originPlace: string | null;
      destinationPlace: string | null;
      count: number;
    }
  >();
  for (const leg of transport) {
    const key = `${leg.origin.toUpperCase()}-${leg.destination.toUpperCase()}`;
    const row = frequentRoutesMap.get(key) ?? {
      originCode: leg.origin,
      destinationCode: leg.destination,
      originPlace: leg.originPlace,
      destinationPlace: leg.destinationPlace,
      count: 0,
    };
    row.count++;
    frequentRoutesMap.set(key, row);
  }
  const byCarrier = new Map<string, number>();
  for (const leg of transport)
    if (leg.carrier) byCarrier.set(leg.carrier, (byCarrier.get(leg.carrier) ?? 0) + 1);
  const currentHome = data.residences.find((residence) =>
    residence.periods.some((period) => period.ongoing),
  );
  const homeRows = data.residences.map((residence) => ({
    legacyId: residence.legacyId,
    placeId: residence.placeId,
    place: residence.place,
    periods: residence.periods,
    totalRecordedDays: residence.periods.every((period) => period.endDate || period.ongoing)
      ? residence.periods.reduce(
          (sum, period) =>
            sum +
            (dayCount(
              period.startDate,
              period.endDate ?? (period.ongoing ? new Date().toISOString().slice(0, 10) : null),
            ) ?? 0),
          0,
        )
      : null,
    precisionCaveat: residence.periods.some(
      (period) => period.precision !== 'day' || !period.endDate,
    )
      ? 'A period has month/year precision or an unrecorded end; totals omit its unknown duration and must not be read as exact lived days.'
      : null,
  }));
  const future = data.journeys
    .filter(
      (journey) => journey.startDate && journey.startDate >= new Date().toISOString().slice(0, 10),
    )
    .sort((a, b) => compareDate(a.startDate, b.startDate))[0];
  const timeline = await travelTimeline(owner, {});
  const homeGaps = timeline.events.filter((event) => event.type === 'home_gap');
  const longestHomeGap =
    [...homeGaps].sort(
      (a, b) =>
        Number(b.days) - Number(a.days) || String(a.startDate).localeCompare(String(b.startDate)),
    )[0] ?? null;
  const topN = 20;
  const nextTrip = future
    ? {
        legacyId: future.legacyId,
        name: future.name,
        startDate: future.startDate,
        daysUntilStart: daysBetween(new Date().toISOString().slice(0, 10), future.startDate),
      }
    : null;
  return {
    daysPerPlace: makePage(dayRows, topN),
    nightsPerPlace: makePage(nightRows, topN),
    daysPerCountry: makePage(
      [...countryStats.values()].sort(
        (a, b) => b.days - a.days || a.country.localeCompare(b.country),
      ),
      topN,
    ),
    mostVisitedPlaces: makePage(
      [...placeStats.values()].sort(
        (a, b) =>
          b.segmentCount - a.segmentCount || b.days - a.days || a.place.localeCompare(b.place),
      ),
      topN,
    ),
    frequentRoutes: makePage(
      [...frequentRoutesMap.values()].sort(
        (a, b) =>
          b.count - a.count ||
          a.originCode.localeCompare(b.originCode) ||
          a.destinationCode.localeCompare(b.destinationCode),
      ),
      topN,
    ),
    legsByCarrier: makePage(
      [...byCarrier]
        .map(([carrier, count]) => ({ carrier, count }))
        .sort((a, b) => b.count - a.count || a.carrier.localeCompare(b.carrier)),
      topN,
    ),
    travelDaysPerYear: makePage(
      [...yearStats]
        .map(([year, days]) => ({ year, days }))
        .sort((a, b) => a.year.localeCompare(b.year)),
      topN,
    ),
    longestStay:
      [...segments]
        .map((segment) => ({
          ...segment,
          place: data.placeById.get(segment.placeId)?.place ?? null,
          nights: daysBetween(segment.arrivalDate, segment.departureDate),
        }))
        .sort(
          (a, b) => (b.nights ?? -1) - (a.nights ?? -1) || a.legacyId.localeCompare(b.legacyId),
        )[0] ?? null,
    longestHomeGap,
    nextTrip,
    homes: {
      residences: homeRows,
      currentHome: currentHome
        ? {
            place: currentHome.place,
            legacyId: currentHome.legacyId,
            period: currentHome.periods.find((period) => period.ongoing),
          }
        : null,
    },
  };
}
