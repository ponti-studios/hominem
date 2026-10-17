import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { runInTransaction, sql } from '@hominem/db/core';
import type { TransactionHandle } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import type { z } from 'zod';

import { placeResidenceImportedPeriodsSchema } from '../schemas/place-residences.schema';
import { nativeTravelRows, travelImportInputSchema } from '../schemas/travel-import.schema';

type Entity = keyof z.infer<typeof travelImportInputSchema>['rows'];
type Row = Record<string, unknown>;
type StoredRow = Row & { id: string };
type Table =
  | 'travel_airports'
  | 'travel_places'
  | 'places'
  | 'place_residences'
  | 'travel_journeys'
  | 'travel_journey_segments'
  | 'travel_transport'
  | 'travel_stays'
  | 'travel_ideas';
type Counter = {
  created: number;
  updated: number;
  unchanged: number;
  rejected: { sourceId: string; reason: string }[];
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
  residences: 'place_residences',
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

function sourceId(entity: Entity, row: Row): string {
  const field = {
    airports: 'airport_id',
    places: 'place_id',
    residences: 'residence_id',
    journeys: 'journey_id',
    segments: 'segment_id',
    transport: 'transport_id',
    stays: 'stay_id',
    ideas: 'idea_id',
  }[entity];
  return value(row, 'id') || value(row, field) || '(missing)';
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
        code: required(row, 'code').toUpperCase(),
        reference_airport_id: optional(row, 'reference_airport_id'),
        name: optional(row, 'name'),
        serves_place: optional(row, 'serves_place'),
        city: optional(row, 'city'),
        country: optional(row, 'country'),
        notes: optional(row, 'notes'),
        latitude: number(row, 'latitude'),
        longitude: number(row, 'longitude'),
      };
    case 'places':
      return {
        name: required(row, 'place'),
        country: required(row, 'country'),
        place_type: required(row, 'type'),
        want_to_go: row.want_to_go === true || value(row, 'status').toLowerCase() === 'want to go',
        first_visited: date(row, 'first_visited'),
        last_visited: date(row, 'last_visited'),
        notes: optional(row, 'notes'),
        archived: row.archived === true || value(row, 'archived').toLowerCase() === 'true',
        lived_in_source:
          row.travel_relationship === false || value(row, 'status').toLowerCase() === 'lived in',
      };
    case 'residences': {
      const placeAlias = optional(row, 'place_id') ?? required(row, 'placeLegacyId');
      const place = refs.places.get(placeAlias);
      if (!place) throw new Error('unknown_place');
      if (
        (value(row, 'place') &&
          String(place.name ?? place.place).toLowerCase() !== value(row, 'place').toLowerCase()) ||
        (value(row, 'country') &&
          String(place.country).toLowerCase() !== value(row, 'country').toLowerCase())
      ) {
        throw new Error('residence_place_mismatch');
      }
      const parsedPeriods = placeResidenceImportedPeriodsSchema.safeParse(row.periods);
      if (!parsedPeriods.success) {
        const multipleOngoing = parsedPeriods.error.issues.some(
          (issue) => issue.message === 'multiple_current_homes',
        );
        throw new Error(multipleOngoing ? 'multiple_current_homes' : 'invalid_period');
      }
      const periods = parsedPeriods.data;
      return {
        place_id: place.id,
        periods,
        notes: optional(row, 'notes'),
      };
    }
    case 'journeys':
      return {
        name: required(row, 'name'),
        start_date: date(row, 'start_date'),
        end_date: date(row, 'end_date'),
        purpose: optional(row, 'purpose'),
        notes: optional(row, 'notes'),
      };
    case 'segments': {
      const journey = refs.journeys.get(required(row, 'journey_id'));
      if (!journey) throw new Error('unknown_journey');
      const placeLegacyId = optional(row, 'place_legacy_id') ?? optional(row, 'place_id');
      const placeName = value(row, 'place').toLowerCase();
      const matches = placeLegacyId
        ? [refs.places.get(placeLegacyId)].filter((place): place is StoredRow => Boolean(place))
        : [...new Map([...refs.places.values()].map((place) => [place.id, place])).values()].filter(
            (place) => String(place.name ?? place.place).toLowerCase() === placeName,
          );
      if (matches.length !== 1)
        throw new Error(matches.length ? 'ambiguous_place' : 'unknown_place');
      const seq = Number(required(row, 'seq'));
      if (!Number.isInteger(seq) || seq < 1) throw new Error('invalid_seq');
      return {
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
      const mode = required(row, 'mode').toLowerCase();
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
        date: date(row, 'date'),
        mode,
        origin,
        destination,
        ...(mode === 'air'
          ? {
              origin_reference_id:
                optional(row, 'origin_reference_id') ??
                refs.airports.get(origin)?.reference_airport_id ??
                null,
              destination_reference_id:
                optional(row, 'destination_reference_id') ??
                refs.airports.get(destination)?.reference_airport_id ??
                null,
            }
          : { origin_reference_id: null, destination_reference_id: null }),
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
        idea: required(row, 'idea'),
        type: required(row, 'type'),
        status: required(row, 'status'),
        notes: optional(row, 'notes'),
      };
  }
}

function keyFor(entity: Entity, row: Row): string {
  const norm = (value: unknown) =>
    String(value ?? '')
      .trim()
      .toLocaleLowerCase();
  const parts: Record<Entity, unknown[]> = {
    airports: [norm(row.code)],
    places: [row.id ?? ''],
    residences: [row.place_id],
    journeys: [norm(row.name), row.start_date ?? '', row.end_date ?? ''],
    segments: [row.journey_id, row.seq],
    transport: [
      row.journey_id,
      row.date ?? '',
      norm(row.origin),
      norm(row.destination),
      norm(row.carrier),
      norm(row.number),
    ],
    stays:
      row.evidence === 'want'
        ? [norm(row.property), norm(row.city)]
        : [row.segment_id, norm(row.property), row.check_in ?? ''],
    ideas: [norm(row.idea)],
  };
  return parts[entity].map((part) => String(part ?? '')).join('\u001f');
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
  if (entity === 'places') {
    const result = await sql<StoredRow>`SELECT p.id, p.owner_userid, p.name, p.country,
      p.place_type, p.first_visited, p.last_visited, p.notes, t.want_to_go, t.archived,
      true AS has_travel_relationship
      FROM app.travel_places t JOIN app.places p ON p.id=t.place_id AND p.owner_userid=t.owner_userid
      WHERE t.owner_userid=${owner}`.execute(trx);
    return new Map(
      result.rows.map((row) => {
        const normalized = snakeCaseRow(row);
        return [String(normalized.id), normalized];
      }),
    );
  }
  if (entity === 'residences') {
    const result = await sql<StoredRow>`SELECT r.id, r.owner_userid, r.place_id, r.notes,
      coalesce(jsonb_agg(jsonb_build_object('id', rp.id, 'startDate', rp.start_date, 'endDate', rp.end_date,
        'ongoing', rp.ongoing, 'precision', rp.precision, 'note', rp.note)
        ORDER BY rp.start_date, rp.id) FILTER (WHERE rp.id IS NOT NULL), '[]'::jsonb) AS periods
      FROM app.place_residences r LEFT JOIN app.place_residence_periods rp
        ON rp.residence_id=r.id AND rp.owner_userid=r.owner_userid
      WHERE r.owner_userid=${owner} GROUP BY r.id`.execute(trx);
    return new Map(
      result.rows.map((row) => {
        const normalized = snakeCaseRow(row);
        return [String(normalized.id), normalized];
      }),
    );
  }
  const result = await sql<StoredRow>`SELECT * FROM ${quotedTable(TABLE[entity])}
    WHERE owner_userid = ${owner}`.execute(trx);
  return new Map(
    result.rows.map((row) => {
      const normalized = snakeCaseRow(row);
      return [String(normalized.id), normalized];
    }),
  );
}

async function countRows(trx: TransactionHandle, entity: Entity, owner: string) {
  if (entity === 'places') {
    const result = await sql<{
      count: string;
    }>`SELECT count(*)::text AS count FROM app.travel_places WHERE owner_userid=${owner}`.execute(
      trx,
    );
    return Number(result.rows[0]?.count ?? 0);
  }
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
  identityId?: string,
): Promise<{ row: StoredRow; action: 'created' | 'updated' | 'unchanged' }> {
  if (entity === 'places') {
    const { want_to_go, archived, lived_in_source, ...placeFields } = fields;
    const isTravel = lived_in_source !== true;
    const relationshipChanged =
      !current ||
      (isTravel && current.has_travel_relationship !== true) ||
      current.want_to_go !== want_to_go ||
      current.archived !== archived;
    const changed =
      !current ||
      Object.entries(placeFields).some(
        ([key, next]) => (current[key] ?? null) !== (next ?? null),
      ) ||
      relationshipChanged;
    if (current && !changed) return { row: current, action: 'unchanged' };
    const id = current?.id ?? identityId ?? randomUUID();
    const row: StoredRow = {
      ...current,
      id,
      owner_userid: owner,
      ...placeFields,
      want_to_go,
      archived,
    };
    if (!dryRun) {
      if (current) {
        const assignments = Object.entries(placeFields).map(
          ([key, val]) => sql`${sql.ref(key)}=${sql.val(val)}`,
        );
        if (assignments.length)
          await sql`UPDATE app.places SET ${sql.join(assignments)} WHERE id=${id} AND owner_userid=${owner}`.execute(
            trx,
          );
      } else {
        const columns = ['id', 'owner_userid', ...Object.keys(placeFields)];
        const values = [id, owner, ...Object.values(placeFields)];
        await sql`INSERT INTO app.places (${sql.join(columns.map((column) => sql.ref(column)))} ) VALUES (${sql.join(values.map((val) => sql.val(val)))})`.execute(
          trx,
        );
      }
      if (isTravel)
        await sql`INSERT INTO app.travel_places (place_id, owner_userid, want_to_go, archived)
        VALUES (${id}, ${owner}, ${Boolean(want_to_go)}, ${Boolean(archived)})
        ON CONFLICT (place_id) DO UPDATE SET want_to_go=EXCLUDED.want_to_go, archived=EXCLUDED.archived`.execute(
          trx,
        );
    }
    return { row, action: current ? 'updated' : 'created' };
  }
  if (entity === 'residences') {
    const { periods: rawPeriods, ...parentFields } = fields;
    const periods = placeResidenceImportedPeriodsSchema.parse(rawPeriods ?? []);
    const storedPeriods = current?.periods;
    const comparablePeriods = (values: unknown) =>
      Array.isArray(values)
        ? values.map((period) => ({
            startDate: period.startDate,
            endDate: period.endDate ?? null,
            ongoing: period.ongoing,
            precision: period.precision,
            note: period.note ?? null,
          }))
        : values;
    const storedPeriodValues = Array.isArray(storedPeriods)
      ? comparablePeriods(storedPeriods)
      : storedPeriods;
    const incomingPeriodValues = comparablePeriods(periods);
    const idsChanged =
      Array.isArray(storedPeriods) &&
      periods.some((period, index) => period.id && period.id !== storedPeriods[index]?.id);
    const periodsChanged =
      !current || idsChanged || !isDeepStrictEqual(storedPeriodValues, incomingPeriodValues);
    const fieldsChanged =
      !current ||
      Object.entries(parentFields).some(
        ([key, next]) => !isDeepStrictEqual(current[key] ?? null, next ?? null),
      );
    if (current && !periodsChanged && !fieldsChanged) return { row: current, action: 'unchanged' };
    const id = current?.id ?? identityId ?? randomUUID();
    const row: StoredRow = { ...current, id, owner_userid: owner, ...parentFields, periods };
    if (!dryRun) {
      if (current) {
        const assignments = Object.entries(parentFields).map(
          ([key, val]) => sql`${sql.ref(key)}=${sql.val(val)}`,
        );
        if (assignments.length)
          await sql`UPDATE app.place_residences SET ${sql.join(assignments)} WHERE id=${id} AND owner_userid=${owner}`.execute(
            trx,
          );
        if (periodsChanged)
          await sql`DELETE FROM app.place_residence_periods WHERE residence_id=${id} AND owner_userid=${owner}`.execute(
            trx,
          );
      } else {
        await sql`INSERT INTO app.place_residences (id, owner_userid, place_id, notes)
          VALUES (${id}, ${owner}, ${parentFields.place_id}, ${parentFields.notes ?? null})`.execute(
          trx,
        );
      }
      if (periodsChanged)
        for (const period of periods) {
          await sql`INSERT INTO app.place_residence_periods
          (id, owner_userid, residence_id, start_date, end_date, ongoing, precision, note)
          VALUES (${period.id ?? randomUUID()}, ${owner}, ${id}, ${period.startDate}, ${period.endDate ?? null},
            ${period.ongoing}, ${period.precision}, ${period.note ?? null})`.execute(trx);
        }
    }
    return { row, action: current ? 'updated' : 'created' };
  }
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
  const id = identityId ?? randomUUID();
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
    const existingPlaceIdentities = await sql<{ name: string; country: string | null }>`
      SELECT name, country FROM app.places WHERE owner_userid=${ownerUserId}
    `.execute(trx);
    const existingPlaceNames = new Set(
      existingPlaceIdentities.rows.map(({ name, country }) =>
        [
          name.trim().toLocaleLowerCase(),
          String(country ?? '')
            .trim()
            .toLocaleLowerCase(),
        ].join('\u001f'),
      ),
    );
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
    const referenceRows =
      await sql<StoredRow>`SELECT id, source_id, code, name, city, country, latitude, longitude,
      id AS reference_airport_id FROM app.travel_airport_reference WHERE code IS NOT NULL
      ORDER BY scheduled_service DESC, active DESC, source_id`.execute(trx);
    for (const raw of referenceRows.rows) {
      const row = snakeCaseRow(raw);
      if (!refs.airports.has(String(row.code).toUpperCase()))
        refs.airports.set(String(row.code).toUpperCase(), row);
    }
    for (const row of existing.airports.values())
      refs.airports.set(String(row.code).toUpperCase(), row);
    const referencedLegCodes = await sql<{
      code: string;
    }>`SELECT origin AS code FROM app.travel_transport WHERE owner_userid=${ownerUserId}
      UNION SELECT destination AS code FROM app.travel_transport WHERE owner_userid=${ownerUserId}`.execute(
      trx,
    );
    for (const { code } of referencedLegCodes.rows) {
      if (!refs.airports.has(code.toUpperCase()))
        refs.airports.set(code.toUpperCase(), { id: code, code: code.toUpperCase() });
    }
    for (const row of existing.places.values()) {
      refs.places.set(String(row.id), row);
    }
    for (const row of existing.journeys.values()) refs.journeys.set(String(row.id), row);
    for (const row of existing.segments.values()) refs.segments.set(String(row.id), row);
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
        const id = sourceId(entity, sourceRow);
        await sql`SAVEPOINT travel_import_row`.execute(trx);
        try {
          if (entity === 'places' && value(sourceRow, 'status').toLowerCase() === 'lived in') {
            if (
              !rows.residences.some(
                (residence) =>
                  value(residence, 'place_id') === value(sourceRow, 'place_id') ||
                  value(residence, 'placeLegacyId') === id,
              )
            ) {
              entities.places.rejected.push({ sourceId: id, reason: 'missing_residence_record' });
              await sql`RELEASE SAVEPOINT travel_import_row`.execute(trx);
              continue;
            }
          }
          if (entity === 'places') {
            const alias = value(sourceRow, 'id') || value(sourceRow, 'place_id');
            const hasUuid =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                alias,
              );
            const identity = [
              value(sourceRow, 'place') || value(sourceRow, 'name'),
              value(sourceRow, 'country'),
            ]
              .map((part) => part.toLocaleLowerCase())
              .join('\u001f');
            if (!hasUuid && existingPlaceNames.has(identity))
              throw new Error('place_identity_required');
          }
          const fields = payload(entity, sourceRow, refs);
          if (entity === 'airports') {
            const ref = refs.airports.get(String(fields.code));
            if (ref?.reference_airport_id) {
              fields.reference_airport_id = ref.reference_airport_id;
              fields.standalone = false;
            } else {
              if (
                !fields.name ||
                !fields.city ||
                !fields.country ||
                fields.latitude == null ||
                fields.longitude == null
              )
                throw new Error('unknown_airport_request_operator_curation');
              fields.reference_airport_id = null;
              fields.standalone = true;
            }
          }
          if (
            entity === 'residences' &&
            hasOngoingPeriod(fields.periods) &&
            [...existing.residences.values()].some((candidate) =>
              hasOngoingPeriod(candidate.periods),
            )
          ) {
            throw new Error('multiple_current_homes');
          }
          const identityId = value(sourceRow, 'id');
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              identityId,
            );
          let current = isUuid
            ? [...existing[entity].values()].find((candidate) => candidate.id === identityId)
            : undefined;
          if (!current && entity === 'places' && isUuid) {
            const found = await sql<StoredRow>`SELECT p.id, p.owner_userid, p.name, p.country,
              p.place_type, p.first_visited, p.last_visited, p.notes,
              coalesce(t.want_to_go, false) AS want_to_go, coalesce(t.archived, false) AS archived,
              (t.place_id IS NOT NULL) AS has_travel_relationship
              FROM app.places p LEFT JOIN app.travel_places t
                ON t.place_id=p.id AND t.owner_userid=p.owner_userid
              WHERE p.id=${identityId} AND p.owner_userid=${ownerUserId}`.execute(trx);
            if (found.rows[0]) current = snakeCaseRow(found.rows[0]);
          }
          if (!current && entity !== 'places') {
            const composite = keyFor(entity, fields);
            current = [...existing[entity].values()].find(
              (candidate) => keyFor(entity, candidate) === composite,
            );
          }
          const result = await writeRow(
            trx,
            ownerUserId,
            entity,
            fields,
            current,
            false,
            isUuid ? identityId : undefined,
          );
          const stored = result.row;
          if (
            entity === 'places' &&
            value(sourceRow, 'status').toLowerCase() === 'lived in' &&
            result.action === 'created'
          )
            residenceOnlyPlaces += 1;
          existing[entity].set(stored.id, stored);
          entities[entity][result.action] += 1;
          if (entity === 'airports') refs.airports.set(String(fields.code), stored);
          if (entity === 'places') {
            refs.places.set(stored.id, stored);
            refs.places.set(id, stored);
          }
          if (entity === 'journeys') refs.journeys.set(id, stored);
          if (entity === 'segments') refs.segments.set(id, stored);
          await sql`RELEASE SAVEPOINT travel_import_row`.execute(trx);
        } catch (error) {
          await sql`ROLLBACK TO SAVEPOINT travel_import_row`.execute(trx);
          await sql`RELEASE SAVEPOINT travel_import_row`.execute(trx);
          const reason =
            entity === 'places' && rejectionReason(error) === 'duplicate_key'
              ? 'duplicate_place'
              : rejectionReason(error);
          entities[entity].rejected.push({ sourceId: id, reason });
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
