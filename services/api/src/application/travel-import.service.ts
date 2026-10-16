import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { runInTransaction, sql } from '@hominem/db/core';
import type { TransactionHandle } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import type { z } from 'zod';

import { nativeTravelRows, travelImportInputSchema } from '../schemas/travel-import.schema';
import { travelResidenceImportedPeriodsSchema } from '../schemas/travel-residences.schema';

type Entity = keyof z.infer<typeof travelImportInputSchema>['rows'];
type Row = Record<string, unknown>;
type StoredRow = Row & { id: string };
type Table =
  | 'travel_airports'
  | 'travel_places'
  | 'travel_residences'
  | 'travel_journeys'
  | 'travel_journey_segments'
  | 'travel_transport'
  | 'travel_stays'
  | 'travel_ideas';
type Counter = {
  created: number;
  updated: number;
  unchanged: number;
  rejected: { legacyId: string; reason: string }[];
};

const ORDER: Entity[] = [
  'airports',
  'places',
  'residences',
  'journeys',
  'segments',
  'transport',
  'stays',
  'ideas',
];
const TABLE: Record<Entity, Table> = {
  airports: 'travel_airports',
  places: 'travel_places',
  residences: 'travel_residences',
  journeys: 'travel_journeys',
  segments: 'travel_journey_segments',
  transport: 'travel_transport',
  stays: 'travel_stays',
  ideas: 'travel_ideas',
};
const EMPTY: Record<Entity, Row[]> = {
  airports: [],
  places: [],
  residences: [],
  journeys: [],
  segments: [],
  transport: [],
  stays: [],
  ideas: [],
};
const quotedTable = (name: Table) => sql.raw(`app.${name}`);
function snakeCaseRow(row: StoredRow): StoredRow {
  const normalized: StoredRow = { id: String(row.id) };
  for (const [key, value] of Object.entries(row)) {
    normalized[key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)] = value;
  }
  return normalized;
}

function value(row: Row, key: string): string {
  const raw = row[key];
  return raw === undefined || raw === null ? '' : String(raw).trim();
}

function required(row: Row, key: string): string {
  const result = value(row, key);
  if (!result) throw new Error(`missing_${key}`);
  return result;
}

function optional(row: Row, key: string): string | null {
  return value(row, key) || null;
}

function date(row: Row, key: string): string | null {
  const result = optional(row, key);
  if (!result) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`invalid_${key}`);
  if (new Date(`${result}T00:00:00.000Z`).toISOString().slice(0, 10) !== result) {
    throw new Error(`invalid_${key}`);
  }
  return result;
}

function number(row: Row, key: string): number | null {
  const result = optional(row, key);
  if (!result) return null;
  const parsed = Number(result);
  if (!Number.isFinite(parsed)) throw new Error(`invalid_${key}`);
  return parsed;
}

function legacyId(entity: Entity, row: Row): string {
  const field = {
    airports: 'airport_id',
    places: 'place_id',
    residences: 'legacyId',
    journeys: 'journey_id',
    segments: 'segment_id',
    transport: 'transport_id',
    stays: 'stay_id',
    ideas: 'idea_id',
  }[entity];
  return value(row, field) || '(missing)';
}

function payload(
  entity: Entity,
  row: Row,
  refs: {
    airports: Map<string, StoredRow>;
    places: Map<string, StoredRow>;
    journeys: Map<string, StoredRow>;
    segments: Map<string, StoredRow>;
  },
): Row {
  switch (entity) {
    case 'airports':
      return {
        legacy_id: required(row, 'airport_id'),
        code: required(row, 'code').toUpperCase(),
        name: required(row, 'name'),
        serves_place: required(row, 'serves_place'),
        city: required(row, 'city'),
        country: required(row, 'country'),
        notes: optional(row, 'notes'),
        latitude: number(row, 'latitude'),
        longitude: number(row, 'longitude'),
      };
    case 'places':
      return {
        legacy_id: required(row, 'place_id'),
        place: required(row, 'place'),
        country: required(row, 'country'),
        type: required(row, 'type'),
        status: required(row, 'status'),
        first_visited: date(row, 'first_visited'),
        last_visited: date(row, 'last_visited'),
        notes: optional(row, 'notes'),
      };
    case 'residences': {
      const place = refs.places.get(required(row, 'placeLegacyId'));
      if (!place) throw new Error('unknown_place');
      if (
        (value(row, 'place') &&
          String(place.place).toLowerCase() !== value(row, 'place').toLowerCase()) ||
        (value(row, 'country') &&
          String(place.country).toLowerCase() !== value(row, 'country').toLowerCase())
      ) {
        throw new Error('residence_place_mismatch');
      }
      const parsedPeriods = travelResidenceImportedPeriodsSchema.safeParse(row.periods);
      if (!parsedPeriods.success) {
        const multipleOngoing = parsedPeriods.error.issues.some(
          (issue) => issue.message === 'multiple_current_homes',
        );
        throw new Error(multipleOngoing ? 'multiple_current_homes' : 'invalid_period');
      }
      const periods = parsedPeriods.data;
      return {
        legacy_id: required(row, 'legacyId'),
        place_id: place.id,
        periods: JSON.stringify(periods),
        source_first_visited: optional(row, 'sourceFirstVisited'),
        source_last_visited: optional(row, 'sourceLastVisited'),
        notes: optional(row, 'notes'),
      };
    }
    case 'journeys':
      return {
        legacy_id: required(row, 'journey_id'),
        name: required(row, 'name'),
        start_date: date(row, 'start_date'),
        end_date: date(row, 'end_date'),
        purpose: optional(row, 'purpose'),
        notes: optional(row, 'notes'),
      };
    case 'segments': {
      const journey = refs.journeys.get(required(row, 'journey_id'));
      if (!journey) throw new Error('unknown_journey');
      const placeLegacyId = optional(row, 'place_legacy_id');
      const placeName = value(row, 'place').toLowerCase();
      const matches = placeLegacyId
        ? [refs.places.get(placeLegacyId)].filter((place): place is StoredRow => Boolean(place))
        : [...new Map([...refs.places.values()].map((place) => [place.id, place])).values()].filter(
            (place) => String(place.place).toLowerCase() === placeName,
          );
      if (matches.length !== 1)
        throw new Error(matches.length ? 'ambiguous_place' : 'unknown_place');
      const seq = Number(required(row, 'seq'));
      if (!Number.isInteger(seq) || seq < 1) throw new Error('invalid_seq');
      return {
        legacy_id: required(row, 'segment_id'),
        journey_id: journey.id,
        seq,
        place_id: matches[0]!.id,
        arrival_date: date(row, 'arrival_date'),
        departure_date: date(row, 'departure_date'),
        notes: optional(row, 'notes'),
      };
    }
    case 'transport': {
      const journey = refs.journeys.get(required(row, 'journey_id'));
      if (!journey) throw new Error('unknown_journey');
      const origin = required(row, 'origin').toUpperCase();
      const destination = required(row, 'destination').toUpperCase();
      if (!refs.airports.has(origin)) throw new Error('unknown_origin_airport');
      if (!refs.airports.has(destination)) throw new Error('unknown_destination_airport');
      const depLegacyId = optional(row, 'dep_segment');
      const arrLegacyId = optional(row, 'arr_segment');
      const dep = depLegacyId ? refs.segments.get(depLegacyId) : null;
      const arr = arrLegacyId ? refs.segments.get(arrLegacyId) : null;
      if (depLegacyId && !dep) throw new Error('unknown_departure_segment');
      if (arrLegacyId && !arr) throw new Error('unknown_arrival_segment');
      if ((dep && dep.journey_id !== journey.id) || (arr && arr.journey_id !== journey.id)) {
        throw new Error('segment_journey_mismatch');
      }
      return {
        legacy_id: required(row, 'transport_id'),
        date: date(row, 'date'),
        mode: required(row, 'mode').toLowerCase(),
        origin,
        destination,
        carrier: optional(row, 'carrier'),
        number: optional(row, 'number'),
        booking_ref: optional(row, 'booking_ref'),
        dep_segment_id: dep?.id ?? null,
        arr_segment_id: arr?.id ?? null,
        journey_id: journey.id,
        legacy_trip: optional(row, 'legacy_trip'),
        notes: optional(row, 'notes'),
      };
    }
    case 'stays': {
      const evidence = required(row, 'evidence').toLowerCase();
      const journeyLegacyId = optional(row, 'journey_id');
      const segmentLegacyId = optional(row, 'segment_id');
      if (Boolean(journeyLegacyId) !== Boolean(segmentLegacyId)) {
        throw new Error('stay_links_partial');
      }
      if (!journeyLegacyId && evidence !== 'want') throw new Error('stay_links_required');
      const journey = journeyLegacyId ? refs.journeys.get(journeyLegacyId) : null;
      if (journeyLegacyId && !journey) throw new Error('unknown_journey');
      const segment = segmentLegacyId ? refs.segments.get(segmentLegacyId) : null;
      if (segmentLegacyId && !segment) throw new Error('unknown_segment');
      if (segment && journey && segment.journey_id !== journey.id) {
        throw new Error('segment_journey_mismatch');
      }
      return {
        legacy_id: required(row, 'stay_id'),
        segment_id: segment?.id ?? null,
        journey_id: journey?.id ?? null,
        check_in: date(row, 'check_in'),
        check_out: date(row, 'check_out'),
        city: required(row, 'city'),
        country: optional(row, 'country'),
        property: optional(row, 'property'),
        booking_ref: optional(row, 'booking_ref'),
        evidence,
        notes: optional(row, 'notes'),
      };
    }
    case 'ideas':
      return {
        legacy_id: required(row, 'idea_id'),
        idea: required(row, 'idea'),
        type: required(row, 'type'),
        status: required(row, 'status'),
        notes: optional(row, 'notes'),
      };
  }
}

function keyFor(entity: Entity, row: Row): string {
  if (entity !== 'transport') return String(row.legacy_id);
  return [row.legacy_id, row.journey_id, row.date ?? '', row.origin, row.destination].join(
    '\u001f',
  );
}

function hasOngoingPeriod(value: unknown): boolean {
  try {
    const periods = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(periods) && periods.some((period) => period?.ongoing === true);
  } catch {
    return false;
  }
}

function rejectionReason(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === '23505') return 'duplicate_key';
    if (error.code === '23503') return 'invalid_reference';
  }
  const message = error instanceof Error ? error.message : '';
  return /^[a-z][a-z0-9_]*$/.test(message) ? message : 'invalid_row';
}

async function loadRows(trx: TransactionHandle, entity: Entity, owner: string, replacing: boolean) {
  if (replacing) return new Map<string, StoredRow>();
  const result =
    await sql<StoredRow>`SELECT * FROM ${quotedTable(TABLE[entity])} WHERE owner_userid = ${owner}`.execute(
      trx,
    );
  return new Map(
    result.rows.map((row) => {
      const normalized = snakeCaseRow(row);
      return [String(normalized.id), normalized];
    }),
  );
}

async function countRows(trx: TransactionHandle, entity: Entity, owner: string) {
  const result = await sql<{ count: string }>`
    SELECT count(*)::text AS count FROM ${quotedTable(TABLE[entity])} WHERE owner_userid = ${owner}
  `.execute(trx);
  return Number(result.rows[0]?.count ?? 0);
}

async function writeRow(
  trx: TransactionHandle,
  owner: string,
  entity: Entity,
  fields: Row,
  current: StoredRow | undefined,
  dryRun: boolean,
): Promise<{ row: StoredRow; action: 'created' | 'updated' | 'unchanged' }> {
  const equalValue = (left: unknown, right: unknown) => {
    if (typeof right === 'string' && (right.startsWith('{') || right.startsWith('['))) {
      try {
        const parsedLeft =
          typeof left === 'string' && (left.startsWith('{') || left.startsWith('['))
            ? JSON.parse(left)
            : left;
        return isDeepStrictEqual(parsedLeft, JSON.parse(right));
      } catch {
        return left === right;
      }
    }
    return (left ?? null) === (right ?? null);
  };
  const changed = Object.entries(fields).some(([key, next]) => !equalValue(current?.[key], next));
  if (current && !changed) return { row: current, action: 'unchanged' };
  if (current && dryRun) {
    const row: StoredRow = { ...current, ...fields };
    return { row, action: 'updated' };
  }
  if (current) {
    const assignments = Object.entries(fields).map(
      ([key, val]) => sql`${sql.ref(key)} = ${sql.val(val)}`,
    );
    await sql`UPDATE ${quotedTable(TABLE[entity])} SET ${sql.join(assignments)} WHERE id = ${current.id} AND owner_userid = ${owner}`.execute(
      trx,
    );
    const row: StoredRow = { ...current, ...fields };
    return { row, action: 'updated' };
  }
  const id = randomUUID();
  const row: StoredRow = { id, owner_userid: owner, ...fields };
  if (!dryRun) {
    const columns = ['id', 'owner_userid', ...Object.keys(fields)];
    const values = [id, owner, ...Object.values(fields)];
    await sql`INSERT INTO ${quotedTable(TABLE[entity])} (${sql.join(columns.map((column) => sql.ref(column)))}
      ) VALUES (${sql.join(values.map((val) => sql.val(val)))})`.execute(trx);
  }
  return { row, action: 'created' };
}

export async function importTravelRows(
  ownerUserId: string,
  input: z.infer<typeof travelImportInputSchema>,
) {
  if (input.entities) input = { ...input, rows: nativeTravelRows(input.entities) };
  if (input.mode === 'replace' && input.iUnderstand !== true)
    throw new ValidationError('confirmation_required');
  return runInTransaction(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${ownerUserId}, 0))`.execute(trx);
    if (input.dryRun) await sql`SAVEPOINT travel_import_dry_run`.execute(trx);
    const rows: Record<Entity, Row[]> = { ...EMPTY, ...input.rows };
    let residenceOnlyPlaces = 0;
    const preDeleteCounts: Record<Entity, number> = {
      airports: 0,
      places: 0,
      journeys: 0,
      segments: 0,
      transport: 0,
      stays: 0,
      ideas: 0,
      residences: 0,
    };
    for (const entity of ORDER) {
      preDeleteCounts[entity] = await countRows(trx, entity, ownerUserId);
    }
    if (input.mode === 'replace') {
      const deleteOrder: Entity[] = [
        'transport',
        'stays',
        'residences',
        'segments',
        'journeys',
        'places',
        'airports',
        'ideas',
      ];
      for (const entity of deleteOrder) {
        await sql`DELETE FROM ${quotedTable(TABLE[entity])} WHERE owner_userid = ${ownerUserId}`.execute(
          trx,
        );
      }
    }

    const existing: Record<Entity, Map<string, StoredRow>> = {
      airports: new Map(),
      places: new Map(),
      journeys: new Map(),
      segments: new Map(),
      transport: new Map(),
      stays: new Map(),
      ideas: new Map(),
      residences: new Map(),
    };
    for (const entity of ORDER)
      existing[entity] = await loadRows(trx, entity, ownerUserId, input.mode === 'replace');
    const refs = {
      airports: new Map<string, StoredRow>(),
      places: new Map<string, StoredRow>(),
      journeys: new Map<string, StoredRow>(),
      segments: new Map<string, StoredRow>(),
    };
    for (const row of existing.airports.values()) refs.airports.set(String(row.code), row);
    for (const row of existing.places.values()) {
      refs.places.set(String(row.id), row);
      refs.places.set(String(row.legacy_id), row);
    }
    for (const row of existing.journeys.values()) refs.journeys.set(String(row.legacy_id), row);
    for (const row of existing.segments.values()) refs.segments.set(String(row.legacy_id), row);
    const entities: Record<Entity, Counter> = {
      airports: { created: 0, updated: 0, unchanged: 0, rejected: [] },
      places: { created: 0, updated: 0, unchanged: 0, rejected: [] },
      journeys: { created: 0, updated: 0, unchanged: 0, rejected: [] },
      segments: { created: 0, updated: 0, unchanged: 0, rejected: [] },
      transport: { created: 0, updated: 0, unchanged: 0, rejected: [] },
      stays: { created: 0, updated: 0, unchanged: 0, rejected: [] },
      ideas: { created: 0, updated: 0, unchanged: 0, rejected: [] },
      residences: { created: 0, updated: 0, unchanged: 0, rejected: [] },
    };

    for (const entity of ORDER) {
      for (const sourceRow of rows[entity] ?? []) {
        const id = legacyId(entity, sourceRow);
        await sql`SAVEPOINT travel_import_row`.execute(trx);
        try {
          if (entity === 'places' && value(sourceRow, 'status').toLowerCase() === 'lived in') {
            if (!rows.residences.some((residence) => value(residence, 'legacyId') === id)) {
              entities.places.rejected.push({ legacyId: id, reason: 'missing_residence_record' });
              await sql`RELEASE SAVEPOINT travel_import_row`.execute(trx);
              continue;
            }
            const key = `${value(sourceRow, 'place').toLowerCase()}\u001f${value(sourceRow, 'country').toLowerCase()}`;
            const hasCanonical = rows.places.some(
              (candidate) =>
                value(candidate, 'status').toLowerCase() !== 'lived in' &&
                `${value(candidate, 'place').toLowerCase()}\u001f${value(candidate, 'country').toLowerCase()}` ===
                  key,
            );
            if (!hasCanonical) {
              const fields = payload(entity, sourceRow, refs);
              const current = [...existing.places.values()].find(
                (candidate) => String(candidate.legacy_id) === value(sourceRow, 'place_id'),
              );
              const result = await writeRow(trx, ownerUserId, entity, fields, current, false);
              existing.places.set(result.row.id, result.row);
              refs.places.set(result.row.id, result.row);
              refs.places.set(String(fields.legacy_id), result.row);
              entities.places[result.action] += 1;
              residenceOnlyPlaces += 1;
            }
            await sql`RELEASE SAVEPOINT travel_import_row`.execute(trx);
            continue;
          }
          if (entity === 'places' && value(sourceRow, 'status').toLowerCase() !== 'lived in') {
            const naturalKey = `${value(sourceRow, 'place').toLowerCase()}\u001f${value(sourceRow, 'country').toLowerCase()}`;
            const duplicate = [...existing.places.values()].some(
              (candidate) =>
                `${String(candidate.place).toLowerCase()}\u001f${String(candidate.country).toLowerCase()}` ===
                  naturalKey && String(candidate.legacy_id) !== id,
            );
            if (duplicate) throw new Error('duplicate_place');
          }
          const fields = payload(entity, sourceRow, refs);
          if (
            entity === 'residences' &&
            hasOngoingPeriod(fields.periods) &&
            [...existing.residences.values()].some(
              (candidate) =>
                String(candidate.legacy_id) !== String(fields.legacy_id) &&
                hasOngoingPeriod(candidate.periods),
            )
          ) {
            throw new Error('multiple_current_homes');
          }
          const composite = keyFor(entity, fields);
          const current = [...existing[entity].values()].find(
            (candidate) => keyFor(entity, candidate) === composite,
          );
          const result = await writeRow(trx, ownerUserId, entity, fields, current, false);
          const stored = result.row;
          existing[entity].set(stored.id, stored);
          entities[entity][result.action] += 1;
          if (entity === 'airports') refs.airports.set(String(fields.code), stored);
          if (entity === 'places') {
            refs.places.set(stored.id, stored);
            refs.places.set(String(fields.legacy_id), stored);
          }
          if (entity === 'journeys') refs.journeys.set(String(fields.legacy_id), stored);
          if (entity === 'segments') refs.segments.set(String(fields.legacy_id), stored);
          await sql`RELEASE SAVEPOINT travel_import_row`.execute(trx);
        } catch (error) {
          await sql`ROLLBACK TO SAVEPOINT travel_import_row`.execute(trx);
          await sql`RELEASE SAVEPOINT travel_import_row`.execute(trx);
          const reason =
            entity === 'places' && rejectionReason(error) === 'duplicate_key'
              ? 'duplicate_place'
              : rejectionReason(error);
          entities[entity].rejected.push({ legacyId: id, reason });
        }
      }
    }
    const result = {
      entities,
      droppedColumns: ['journeys.segments', 'segments.destinations'],
      residenceOnlyPlaces,
      ...(input.mode === 'replace' ? { preDeleteCounts } : {}),
      dryRun: input.dryRun,
    };
    if (input.dryRun) {
      await sql`ROLLBACK TO SAVEPOINT travel_import_dry_run`.execute(trx);
      await sql`RELEASE SAVEPOINT travel_import_dry_run`.execute(trx);
    }
    return result;
  });
}
