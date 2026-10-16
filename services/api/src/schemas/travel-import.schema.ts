import { z } from 'zod';

const sheetRows = z.array(z.record(z.string(), z.unknown())).max(1000);

export function nativeTravelRows(entities: Record<string, Record<string, unknown>[]>) {
  const list = (name: string) => entities[name] ?? [];
  const places = list('travel_places');
  const journeys = list('travel_journeys');
  const segments = list('travel_journey_segments');
  const byId = (rows: Record<string, unknown>[]) =>
    new Map(rows.map((row) => [String(row.id), row]));
  const placeById = byId(places);
  const journeyById = byId(journeys);
  const segmentById = byId(segments);
  return {
    places: places.map((row) => ({
      ...row,
      place_id: row.legacyId,
      first_visited: row.firstVisited,
      last_visited: row.lastVisited,
    })),
    residences: list('travel_residences').map((row) => ({
      ...row,
      placeLegacyId: placeById.get(String(row.placeId))?.legacyId,
    })),
    journeys: journeys.map((row) => ({
      ...row,
      journey_id: row.legacyId,
      start_date: row.startDate,
      end_date: row.endDate,
    })),
    segments: segments.map((row) => ({
      ...row,
      segment_id: row.legacyId,
      journey_id: journeyById.get(String(row.journeyId))?.legacyId,
      place: placeById.get(String(row.placeId))?.place,
      place_legacy_id: placeById.get(String(row.placeId))?.legacyId,
      arrival_date: row.arrivalDate,
      departure_date: row.departureDate,
    })),
    transport: list('travel_transport').map((row) => ({
      ...row,
      transport_id: row.legacyId,
      booking_ref: row.bookingRef,
      dep_segment: segmentById.get(String(row.depSegmentId))?.legacyId,
      arr_segment: segmentById.get(String(row.arrSegmentId))?.legacyId,
      journey_id: journeyById.get(String(row.journeyId))?.legacyId,
      legacy_trip: row.legacyTrip,
    })),
    stays: list('travel_stays').map((row) => ({
      ...row,
      stay_id: row.legacyId,
      segment_id: segmentById.get(String(row.segmentId))?.legacyId,
      journey_id: journeyById.get(String(row.journeyId))?.legacyId,
      check_in: row.checkIn,
      check_out: row.checkOut,
      booking_ref: row.bookingRef,
    })),
    airports: list('travel_airports').map((row) => ({
      ...row,
      airport_id: row.legacyId,
      serves_place: row.servesPlace,
    })),
    ideas: list('travel_ideas').map((row) => ({ ...row, idea_id: row.legacyId })),
  };
}

export const travelImportInputSchema = z.object({
  format: z.literal('native').optional(),
  entities: z.record(z.string(), z.array(z.record(z.string(), z.unknown())).max(1000)).optional(),
  rows: z
    .object({
      places: sheetRows.default([]),
      residences: sheetRows.default([]),
      journeys: sheetRows.default([]),
      segments: sheetRows.default([]),
      transport: sheetRows.default([]),
      stays: sheetRows.default([]),
      airports: sheetRows.default([]),
      ideas: sheetRows.default([]),
    })
    .default({
      places: [],
      residences: [],
      journeys: [],
      segments: [],
      transport: [],
      stays: [],
      airports: [],
      ideas: [],
    }),
  mode: z.enum(['append', 'replace']).default('append'),
  dryRun: z.boolean().default(false),
  iUnderstand: z.boolean().optional(),
});

const entityResult = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  rejected: z.array(z.object({ legacyId: z.string(), reason: z.string() })),
});

export const travelImportOutputSchema = z.object({
  entities: z.object({
    places: entityResult,
    residences: entityResult,
    journeys: entityResult,
    segments: entityResult,
    transport: entityResult,
    stays: entityResult,
    airports: entityResult,
    ideas: entityResult,
  }),
  droppedColumns: z.array(z.string()),
  residenceOnlyPlaces: z.number().int().nonnegative(),
  preDeleteCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  dryRun: z.boolean(),
});
