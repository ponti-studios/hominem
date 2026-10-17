import { z } from 'zod';

const sheetRows = z.array(z.record(z.string(), z.unknown())).max(1000);

export function nativeTravelRows(entities: Record<string, Record<string, unknown>[]>) {
  const list = (name: string) => entities[name] ?? [];
  const snake = (row: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        value,
      ]),
    );
  const rows = (name: string) => list(name).map(snake);
  const places = list('places').length ? list('places') : list('travel_places');
  const residences = list('place_residences').length
    ? list('place_residences')
    : list('travel_residences');
  return {
    places: places.map((source, index) => {
      const row = snake(source);
      return {
        ...row,
        place_id: places[index]?.id ?? row.id,
      };
    }),
    residences: residences.map((source, index) => {
      const row = snake(source);
      return {
        ...row,
        residence_id: residences[index]?.id ?? row.id,
      };
    }),
    journeys: rows('travel_journeys').map((row, index) => ({
      ...row,
      journey_id: list('travel_journeys')[index]?.id,
    })),
    segments: rows('travel_journey_segments').map((row, index) => ({
      ...row,
      segment_id: list('travel_journey_segments')[index]?.id,
      place_legacy_id: row.place_id,
    })),
    transport: rows('travel_transport').map((row, index) => ({
      ...row,
      transport_id: list('travel_transport')[index]?.id,
      dep_segment: row.dep_segment_id,
      arr_segment: row.arr_segment_id,
    })),
    stays: rows('travel_stays').map((row, index) => ({
      ...row,
      stay_id: list('travel_stays')[index]?.id,
      segment_id: row.segment_id,
    })),
    airports: rows('travel_airports').map((row, index) => ({
      ...row,
      airport_id: list('travel_airports')[index]?.id,
      serves_place: row.serves_place,
    })),
    ideas: rows('travel_ideas').map((row, index) => ({
      ...row,
      idea_id: list('travel_ideas')[index]?.id,
    })),
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
  rejected: z.array(z.object({ sourceId: z.string(), reason: z.string() })),
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
