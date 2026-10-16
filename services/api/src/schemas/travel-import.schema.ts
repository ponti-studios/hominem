import { z } from 'zod';

const sheetRows = z.array(z.record(z.string(), z.unknown())).max(1000);

export const travelImportInputSchema = z.object({
  rows: z.object({
    places: sheetRows.default([]),
    residences: sheetRows.default([]),
    journeys: sheetRows.default([]),
    segments: sheetRows.default([]),
    transport: sheetRows.default([]),
    stays: sheetRows.default([]),
    airports: sheetRows.default([]),
    ideas: sheetRows.default([]),
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
