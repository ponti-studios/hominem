import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { db, runInTransaction, sql } from '@hominem/db/core';
import type { TransactionHandle } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';

type Entity = 'journey' | 'segment' | 'transport' | 'stay' | 'place' | 'airport' | 'idea';
type Row = Record<string, unknown>;
type Config = { table: string; prefix: string; keys: string[]; fields: Record<string, string> };
const CONFIG: Record<Entity, Config> = {
  journey: {
    table: 'travel_journeys',
    prefix: 'JRN',
    keys: ['legacyId'],
    fields: {
      legacyId: 'legacy_id',
      name: 'name',
      startDate: 'start_date',
      endDate: 'end_date',
      purpose: 'purpose',
      notes: 'notes',
      archived: 'archived',
    },
  },
  segment: {
    table: 'travel_journey_segments',
    prefix: 'SEG',
    keys: ['legacyId'],
    fields: {
      legacyId: 'legacy_id',
      journeyId: 'journey_id',
      seq: 'seq',
      placeId: 'place_id',
      arrivalDate: 'arrival_date',
      departureDate: 'departure_date',
      notes: 'notes',
    },
  },
  transport: {
    table: 'travel_transport',
    prefix: 'T',
    keys: ['legacyId', 'journeyId', 'date', 'origin', 'destination'],
    fields: {
      legacyId: 'legacy_id',
      date: 'date',
      mode: 'mode',
      origin: 'origin',
      destination: 'destination',
      carrier: 'carrier',
      number: 'number',
      bookingRef: 'booking_ref',
      depSegmentId: 'dep_segment_id',
      arrSegmentId: 'arr_segment_id',
      journeyId: 'journey_id',
      legacyTrip: 'legacy_trip',
      notes: 'notes',
    },
  },
  stay: {
    table: 'travel_stays',
    prefix: 'STY',
    keys: ['legacyId'],
    fields: {
      legacyId: 'legacy_id',
      segmentId: 'segment_id',
      journeyId: 'journey_id',
      checkIn: 'check_in',
      checkOut: 'check_out',
      city: 'city',
      country: 'country',
      property: 'property',
      bookingRef: 'booking_ref',
      evidence: 'evidence',
      notes: 'notes',
    },
  },
  place: {
    table: 'travel_places',
    prefix: 'PLC',
    keys: ['place', 'country'],
    fields: {
      legacyId: 'legacy_id',
      place: 'place',
      country: 'country',
      type: 'type',
      status: 'status',
      firstVisited: 'first_visited',
      lastVisited: 'last_visited',
      notes: 'notes',
      archived: 'archived',
    },
  },
  airport: {
    table: 'travel_airports',
    prefix: 'ARP',
    keys: ['code'],
    fields: {
      legacyId: 'legacy_id',
      code: 'code',
      name: 'name',
      servesPlace: 'serves_place',
      city: 'city',
      country: 'country',
      notes: 'notes',
      latitude: 'latitude',
      longitude: 'longitude',
    },
  },
  idea: {
    table: 'travel_ideas',
    prefix: 'IDA',
    keys: ['legacyId'],
    fields: { legacyId: 'legacy_id', idea: 'idea', type: 'type', status: 'status', notes: 'notes' },
  },
};
const table = (entity: Entity) => sql.raw(`app.${CONFIG[entity].table}`);
const snake = (value: Row): Row =>
  Object.fromEntries(
    Object.entries(value).map(([key, val]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      val,
    ]),
  );
const camel = (row: Row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_all, letter: string) => letter.toUpperCase()),
      value,
    ]),
  );
const matchesVersion = (stored: unknown, requested: unknown) =>
  stored !== undefined &&
  requested !== undefined &&
  Date.parse(String(stored)) === Date.parse(String(requested));

async function allocateLegacyId(trx: TransactionHandle, owner: string, entity: Entity) {
  const { prefix, table: tableName } = CONFIG[entity];
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${owner}:${tableName}:legacy_id`}, 0))`.execute(
    trx,
  );
  const result = await sql<{
    next: number;
  }>`SELECT coalesce(max(substring(legacy_id from '[0-9]+$')::int), 0) + 1 AS next FROM ${sql.raw(`app.${tableName}`)} WHERE owner_userid = ${owner} AND legacy_id ~ ${`^${prefix}-[0-9]+$`}`.execute(
    trx,
  );
  let next = Number(result.rows[0]?.next ?? 1);
  for (;;) {
    const legacyId = `${prefix}-${String(next).padStart(3, '0')}`;
    const found =
      await sql`SELECT 1 FROM ${table(entity)} WHERE owner_userid = ${owner} AND legacy_id = ${legacyId}`.execute(
        trx,
      );
    if (!found.rows.length) return legacyId;
    next += 1;
  }
}

async function readById(trx: TransactionHandle, entity: Entity, owner: string, id: string) {
  const result =
    await sql<Row>`SELECT * FROM ${table(entity)} WHERE owner_userid = ${owner} AND id = ${id} LIMIT 1`.execute(
      trx,
    );
  return result.rows[0] ? camel(result.rows[0]) : null;
}

export async function writeTravelEntity(
  owner: string,
  entity: Entity,
  operation: 'create' | 'update',
  input: Row,
) {
  const config = CONFIG[entity];
  const dryRun = input.dryRun === true;
  const id = typeof input.id === 'string' ? input.id : undefined;
  return runInTransaction(async (trx) => {
    let current: Row | null = null;
    if (id) current = await readById(trx, entity, owner, id);
    else if (operation === 'create') {
      if (entity === 'place') {
        const found =
          await sql<Row>`SELECT * FROM ${table(entity)} WHERE owner_userid = ${owner} AND lower(place) = lower(${String(input.place)}) AND lower(country) = lower(${String(input.country)}) LIMIT 1`.execute(
            trx,
          );
        current = found.rows[0] ? camel(found.rows[0]) : null;
      } else if (entity === 'airport') {
        const found =
          await sql<Row>`SELECT * FROM ${table(entity)} WHERE owner_userid = ${owner} AND lower(code) = lower(${String(input.code)}) LIMIT 1`.execute(
            trx,
          );
        current = found.rows[0] ? camel(found.rows[0]) : null;
      } else if (entity === 'transport') {
        const found = input.legacyId
          ? await sql<Row>`SELECT * FROM ${table(entity)} WHERE owner_userid = ${owner} AND legacy_id = ${String(input.legacyId)} AND journey_id = ${String(input.journeyId ?? '')} AND date IS NOT DISTINCT FROM ${input.date ?? null} AND origin = ${String(input.origin ?? '')} AND destination = ${String(input.destination ?? '')} LIMIT 1`.execute(
              trx,
            )
          : await sql<Row>`SELECT * FROM ${table(entity)} WHERE owner_userid = ${owner} AND journey_id = ${String(input.journeyId ?? '')} AND date IS NOT DISTINCT FROM ${input.date ?? null} AND origin = ${String(input.origin ?? '')} AND destination = ${String(input.destination ?? '')} LIMIT 1`.execute(
              trx,
            );
        current = found.rows[0] ? camel(found.rows[0]) : null;
      } else if (input.legacyId) {
        const found =
          await sql<Row>`SELECT * FROM ${table(entity)} WHERE owner_userid = ${owner} AND legacy_id = ${String(input.legacyId)} LIMIT 1`.execute(
            trx,
          );
        current = found.rows[0] ? camel(found.rows[0]) : null;
      }
    }
    if (id && !current) return { entity: null, action: 'notFound' };
    if (operation === 'create' && current)
      return { entity: current, action: 'unchanged', created: 0, updated: 0, unchanged: 1 };
    if (id && input.ifUpdatedAt && !matchesVersion(current?.updatedAt, input.ifUpdatedAt)) {
      return { entity: current, action: 'version_conflict', reason: 'version_conflict' };
    }
    const payload: Row = {};
    for (const [key, column] of Object.entries(config.fields)) {
      if (input[key] !== undefined) payload[column] = input[key];
    }
    if (entity === 'stay' && input.segmentId !== undefined && input.segmentId !== null) {
      const segment = await sql<{
        journey_id: string;
      }>`SELECT journey_id FROM app.travel_journey_segments WHERE owner_userid = ${owner} AND id = ${String(input.segmentId)} LIMIT 1`.execute(
        trx,
      );
      if (!segment.rows[0]) return { entity: null, reason: 'unknown_segment' };
      if (input.journeyId !== undefined && input.journeyId !== segment.rows[0].journey_id)
        return { entity: null, reason: 'segment_journey_mismatch' };
      payload.journey_id = segment.rows[0].journey_id;
    }
    if (operation === 'create') {
      const resolvedLegacyId =
        typeof input.legacyId === 'string'
          ? input.legacyId
          : await allocateLegacyId(trx, owner, entity);
      payload.legacy_id = resolvedLegacyId;
      if (entity === 'airport') payload.code = String(payload.code ?? '').toUpperCase();
      if (
        entity === 'transport' &&
        typeof payload.legacy_id === 'string' &&
        !/^T-[0-9]+$/.test(payload.legacy_id)
      ) {
        throw new ValidationError('invalid_legacy_id');
      }
    }
    const normalizedCurrent = current ? snake(current) : null;
    const changed =
      !normalizedCurrent ||
      Object.entries(payload).some(
        ([key, value]) => !isDeepStrictEqual(normalizedCurrent[key] ?? null, value ?? null),
      );
    if (!changed)
      return { entity: current, action: 'unchanged', created: 0, updated: 0, unchanged: 1 };
    if (dryRun)
      return {
        entity: current
          ? camel({ ...normalizedCurrent, ...payload })
          : { id: randomUUID(), ownerUserid: owner, ...camel(payload) },
        action: current ? 'updated' : 'created',
        created: current ? 0 : 1,
        updated: current ? 1 : 0,
        unchanged: 0,
      };
    if (current) {
      const assignments = Object.entries(payload).map(
        ([key, value]) => sql`${sql.ref(key)} = ${value}`,
      );
      await sql`UPDATE ${table(entity)} SET ${sql.join(assignments)} WHERE owner_userid = ${owner} AND id = ${String(current.id)}`.execute(
        trx,
      );
      const updated = await readById(trx, entity, owner, String(current.id));
      return { entity: updated, action: 'updated', created: 0, updated: 1, unchanged: 0 };
    }
    const newId = randomUUID();
    const columns = ['id', 'owner_userid', ...Object.keys(payload)];
    const values = [newId, owner, ...Object.values(payload)];
    await sql`INSERT INTO ${table(entity)} (${sql.join(columns.map((column) => sql.ref(column)))}) VALUES (${sql.join(values.map((value) => sql.val(value)))})`.execute(
      trx,
    );
    return {
      entity: await readById(trx, entity, owner, newId),
      action: 'created',
      created: 1,
      updated: 0,
      unchanged: 0,
    };
  }).catch((error: unknown) => {
    if (error instanceof ValidationError) throw error;
    const constraint =
      error && typeof error === 'object' && 'constraint' in error ? String(error.constraint) : '';
    const reason = constraint.includes('seq')
      ? 'duplicate_seq'
      : constraint.includes('journey_segments_place_id')
        ? 'unknown_place'
        : constraint.includes('journey_segments_journey_id')
          ? 'unknown_journey'
          : constraint.includes('transport_origin') || constraint.includes('transport_destination')
            ? 'unknown_airport'
            : constraint.includes('transport_dep_segment') ||
                constraint.includes('transport_arr_segment')
              ? 'segment_journey_mismatch'
              : constraint.includes('stays_segment')
                ? 'unknown_segment'
                : constraint.includes('date') || constraint.includes('range')
                  ? 'invalid_date_range'
                  : constraint.includes('legacy') || constraint.includes('import_key')
                    ? 'duplicate_legacy_id'
                    : 'travel_write_failed';
    throw new ValidationError(reason);
  });
}

export async function deleteTravelEntity(owner: string, entity: Entity, input: Row) {
  const id = String(input.id);
  return runInTransaction(async (trx) => {
    const current = await readById(trx, entity, owner, id);
    if (!current) return { deleted: null, notFound: [id] };
    if (input.ifUpdatedAt && !matchesVersion(current.updatedAt, input.ifUpdatedAt))
      return { deleted: null, reason: 'version_conflict', current };
    let cascadeSnapshot: Record<string, Row[]> | null = null;
    if (entity === 'journey') {
      const refs = await sql<{
        count: number;
      }>`SELECT (SELECT count(*) FROM app.travel_journey_segments WHERE owner_userid = ${owner} AND journey_id = ${id}) + (SELECT count(*) FROM app.travel_transport WHERE owner_userid = ${owner} AND journey_id = ${id}) + (SELECT count(*) FROM app.travel_stays WHERE owner_userid = ${owner} AND journey_id = ${id}) AS count`.execute(
        trx,
      );
      if (Number(refs.rows[0]?.count ?? 0) > 0 && input.cascade !== true)
        return {
          deleted: null,
          reason: 'journey_not_empty',
          referencingCount: Number(refs.rows[0]?.count ?? 0),
        };
      if (input.cascade === true) {
        const [segments, transport, stays] = await Promise.all([
          sql<Row>`SELECT * FROM app.travel_journey_segments WHERE owner_userid = ${owner} AND journey_id = ${id} ORDER BY seq`.execute(
            trx,
          ),
          sql<Row>`SELECT * FROM app.travel_transport WHERE owner_userid = ${owner} AND journey_id = ${id}`.execute(
            trx,
          ),
          sql<Row>`SELECT * FROM app.travel_stays WHERE owner_userid = ${owner} AND journey_id = ${id}`.execute(
            trx,
          ),
        ]);
        cascadeSnapshot = {
          segments: segments.rows.map(camel),
          transport: transport.rows.map(camel),
          stays: stays.rows.map(camel),
        };
      }
    }
    if (entity === 'place') {
      const refs = await sql<{
        count: number;
      }>`SELECT (SELECT count(*) FROM app.travel_journey_segments WHERE owner_userid = ${owner} AND place_id = ${id}) + (SELECT count(*) FROM app.travel_residences WHERE owner_userid = ${owner} AND place_id = ${id}) AS count`.execute(
        trx,
      );
      if (Number(refs.rows[0]?.count ?? 0) > 0)
        return {
          deleted: null,
          reason: 'place_in_use',
          referencingCount: Number(refs.rows[0]?.count ?? 0),
        };
    }
    if (entity === 'airport') {
      const code = String(current.code);
      const refs = await sql<{
        count: number;
      }>`SELECT count(*) AS count FROM app.travel_transport WHERE owner_userid = ${owner} AND (origin = ${code} OR destination = ${code})`.execute(
        trx,
      );
      if (Number(refs.rows[0]?.count ?? 0) > 0)
        return {
          deleted: null,
          reason: 'airport_in_use',
          referencingCount: Number(refs.rows[0]?.count ?? 0),
        };
    }
    const deleted = cascadeSnapshot ? { ...current, cascaded: cascadeSnapshot } : current;
    if (input.dryRun === true) return { deleted, notFound: [], dryRun: true };
    await sql`DELETE FROM ${table(entity)} WHERE owner_userid = ${owner} AND id = ${id}`.execute(
      trx,
    );
    return { deleted, notFound: [] };
  });
}

export async function getTravelWriteEntity(
  owner: string,
  entity: 'transport' | 'stay',
  input: { id?: string; legacyId?: string },
) {
  const result = input.id
    ? await sql<Row>`SELECT * FROM ${table(entity)} WHERE owner_userid = ${owner} AND id = ${input.id} LIMIT 1`.execute(
        db,
      )
    : entity === 'transport'
      ? await sql<Row>`SELECT * FROM ${table(entity)} WHERE owner_userid = ${owner} AND legacy_id = ${String(input.legacyId)} ORDER BY date NULLS LAST LIMIT 2`.execute(
          db,
        )
      : await sql<Row>`SELECT * FROM ${table(entity)} WHERE owner_userid = ${owner} AND legacy_id = ${String(input.legacyId)} LIMIT 2`.execute(
          db,
        );
  if (result.rows.length > 1) return { entity: null, reason: 'ambiguous_legacy_id' };
  return { entity: result.rows[0] ? camel(result.rows[0]) : null, reason: null };
}
