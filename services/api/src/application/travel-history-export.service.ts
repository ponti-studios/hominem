import { db, sql } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';

const HISTORY_TABLE: Record<string, string> = {
  journey: 'travel_journeys',
  segment: 'travel_journey_segments',
  transport: 'travel_transport',
  stay: 'travel_stays',
  place: 'travel_places',
  airport: 'travel_airports',
  idea: 'travel_ideas',
  residence: 'travel_residences',
};
const TABLES = [
  'travel_places',
  'travel_journeys',
  'travel_journey_segments',
  'travel_transport',
  'travel_stays',
  'travel_airports',
  'travel_ideas',
  'travel_residences',
] as const;
type Row = Record<string, unknown>;
const camel = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_all, letter: string) => letter.toUpperCase()),
      value,
    ]),
  );

export async function travelEntityHistory(
  owner: string,
  input: { entityType: string; id: string; limit: number },
) {
  const entityTable = HISTORY_TABLE[input.entityType];
  if (!entityTable) throw new ValidationError('invalid_entity_type');
  const rows = await sql<Record<string, unknown>>`
    SELECT * FROM app.travel_entity_history
    WHERE owner_userid = ${owner} AND entity_table = ${entityTable} AND entity_id = ${input.id}
    ORDER BY created_at DESC LIMIT ${input.limit}
  `.execute(db);
  return { history: rows.rows.map(camel), count: rows.rows.length };
}

export async function travelExport(owner: string, format: 'native' | 'sheet') {
  const rows = await Promise.all(
    TABLES.map(async (name) => {
      const result = await sql<
        Record<string, unknown>
      >`SELECT * FROM ${sql.raw(`app.${name}`)} WHERE owner_userid = ${owner} ORDER BY legacy_id`.execute(
        db,
      );
      return [name, result.rows.map(camel)] as const;
    }),
  );
  const native: Record<string, Row[]> = Object.fromEntries(rows);
  if (format === 'native') return { format, entities: native };
  const places = native.travel_places ?? [];
  const residences = native.travel_residences ?? [];
  const placesSheet = places.map((row) => ({
    place_id: row.legacyId,
    place: row.place,
    country: row.country,
    type: row.type,
    status: row.status,
    first_visited: row.firstVisited,
    last_visited: row.lastVisited,
    notes: row.notes,
  }));
  for (const residence of residences) {
    const place = places.find((row) => row.id === residence.placeId);
    if (!place) continue;
    placesSheet.push({
      place_id: residence.legacyId,
      place: place.place,
      country: place.country,
      type: place.type,
      status: 'Lived in',
      first_visited: residence.sourceFirstVisited,
      last_visited: residence.sourceLastVisited,
      notes: residence.notes,
    });
  }
  const journeys = native.travel_journeys ?? [];
  const segments = native.travel_journey_segments ?? [];
  const placeById = new Map(places.map((row) => [String(row.id), row]));
  const residencesSheet = residences.map((row) => {
    const place = placeById.get(String(row.placeId));
    return {
      legacyId: row.legacyId,
      placeLegacyId: place?.legacyId,
      place: place?.place,
      country: place?.country,
      periods: row.periods,
      sourceFirstVisited: row.sourceFirstVisited,
      sourceLastVisited: row.sourceLastVisited,
      notes: row.notes,
    };
  });
  return {
    format,
    note: 'Segments.destinations is omitted; journey segments are regenerated from segment rows.',
    places: placesSheet,
    residences: residencesSheet,
    journeys: journeys.map((row) => ({
      journey_id: row.legacyId,
      name: row.name,
      start_date: row.startDate,
      end_date: row.endDate,
      purpose: row.purpose,
      notes: row.notes,
      segments: segments
        .filter((segment) => segment.journeyId === row.id)
        .sort((a, b) => Number(a.seq) - Number(b.seq))
        .map((segment) => placeById.get(String(segment.placeId))?.place)
        .filter(Boolean)
        .join(', '),
    })),
    segments: segments.map((row) => ({
      segment_id: row.legacyId,
      journey_id: journeys.find((journey) => journey.id === row.journeyId)?.legacyId,
      seq: row.seq,
      place: placeById.get(String(row.placeId))?.place,
      arrival_date: row.arrivalDate,
      departure_date: row.departureDate,
      notes: row.notes,
    })),
    transport: (native.travel_transport ?? []).map((row) => ({
      transport_id: row.legacyId,
      date: row.date,
      mode: row.mode,
      origin: row.origin,
      destination: row.destination,
      carrier: row.carrier,
      number: row.number,
      booking_ref: row.bookingRef,
      dep_segment_id: segments.find((segment) => segment.id === row.depSegmentId)?.legacyId,
      arr_segment_id: segments.find((segment) => segment.id === row.arrSegmentId)?.legacyId,
      journey_id: journeys.find((journey) => journey.id === row.journeyId)?.legacyId,
      legacy_trip: row.legacyTrip,
      notes: row.notes,
    })),
    stays: (native.travel_stays ?? []).map((row) => ({
      stay_id: row.legacyId,
      segment_id: segments.find((segment) => segment.id === row.segmentId)?.legacyId,
      journey_id: journeys.find((journey) => journey.id === row.journeyId)?.legacyId,
      check_in: row.checkIn,
      check_out: row.checkOut,
      city: row.city,
      country: row.country,
      property: row.property,
      booking_ref: row.bookingRef,
      evidence: row.evidence,
      notes: row.notes,
    })),
    airports: (native.travel_airports ?? []).map((row) => ({
      airport_id: row.legacyId,
      code: row.code,
      name: row.name,
      serves_place: row.servesPlace,
      city: row.city,
      country: row.country,
      notes: row.notes,
      latitude: row.latitude,
      longitude: row.longitude,
    })),
    ideas: (native.travel_ideas ?? []).map((row) => ({
      idea_id: row.legacyId,
      idea: row.idea,
      type: row.type,
      status: row.status,
      notes: row.notes,
    })),
  };
}
