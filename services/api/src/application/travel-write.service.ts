import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { db, runInTransaction, sql } from '@hominem/db/core';
import type { TransactionHandle } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';

import { resolveAirportSelection } from './airport-catalogue.service';

type Entity = 'journey' | 'segment' | 'transport' | 'stay' | 'place' | 'idea';
type Row = Record<string, unknown>;
const TABLE: Record<Entity, string> = {
  journey: 'travel_journeys',
  segment: 'travel_journey_segments',
  transport: 'travel_transport',
  stay: 'travel_stays',
  place: 'places',
  idea: 'travel_ideas',
};
const FIELDS: Record<Entity, Record<string, string>> = {
  journey: {
    name: 'name',
    startDate: 'start_date',
    endDate: 'end_date',
    purpose: 'purpose',
    notes: 'notes',
    archived: 'archived',
  },
  segment: {
    journeyId: 'journey_id',
    seq: 'seq',
    placeId: 'place_id',
    arrivalDate: 'arrival_date',
    departureDate: 'departure_date',
    notes: 'notes',
  },
  transport: {
    date: 'date',
    mode: 'mode',
    origin: 'origin',
    destination: 'destination',
    originReferenceId: 'origin_reference_id',
    destinationReferenceId: 'destination_reference_id',
    carrier: 'carrier',
    number: 'number',
    bookingRef: 'booking_ref',
    depSegmentId: 'dep_segment_id',
    arrSegmentId: 'arr_segment_id',
    journeyId: 'journey_id',
    legacyTrip: 'legacy_trip',
    notes: 'notes',
  },
  stay: {
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
  place: {
    wantToGo: 'want_to_go',
    archived: 'archived',
  },
  idea: { idea: 'idea', type: 'type', status: 'status', notes: 'notes' },
};
const table = (entity: Entity) => sql.raw(`app.${TABLE[entity]}`);
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

function decodeEntity(entity: Entity, row: Row): Row {
  const decoded = camel(row);
  if (entity !== 'place') return decoded;
  return {
    ...decoded,
    place: decoded.place ?? decoded.name,
    type: decoded.type ?? decoded.placeType,
    status: decoded.wantToGo ? 'Want to go' : 'Visited',
  };
}

async function readById(trx: TransactionHandle, entity: Entity, owner: string, id: string) {
  if (entity === 'place') {
    const result = await sql<Row>`
      SELECT p.id, p.owner_userid, p.name AS place, p.country, p.place_type AS type,
        p.first_visited, p.last_visited, p.notes, t.want_to_go, t.archived,
        greatest(p.updatedat, t.updated_at) AS updated_at, p.createdat AS created_at
      FROM app.travel_places t
      JOIN app.places p ON p.id = t.place_id AND p.owner_userid = t.owner_userid
      WHERE t.owner_userid = ${owner} AND t.place_id = ${id} LIMIT 1
    `.execute(trx);
    return result.rows[0] ? decodeEntity(entity, result.rows[0]) : null;
  }
  const result =
    await sql<Row>`SELECT * FROM ${table(entity)} WHERE owner_userid=${owner} AND id=${id} LIMIT 1`.execute(
      trx,
    );
  return result.rows[0] ? decodeEntity(entity, result.rows[0]) : null;
}

async function findNaturalRow(trx: TransactionHandle, owner: string, entity: Entity, input: Row) {
  if (entity === 'place') return { rows: [] };
  if (entity === 'journey')
    return sql<Row>`SELECT * FROM app.travel_journeys WHERE owner_userid=${owner} AND lower(name)=lower(${String(input.name)}) AND start_date IS NOT DISTINCT FROM ${input.startDate ?? null} AND end_date IS NOT DISTINCT FROM ${input.endDate ?? null} LIMIT 1`.execute(
      trx,
    );
  if (entity === 'segment')
    return sql<Row>`SELECT * FROM app.travel_journey_segments WHERE owner_userid=${owner} AND journey_id=${String(input.journeyId)} AND seq=${Number(input.seq)} LIMIT 1`.execute(
      trx,
    );
  if (entity === 'transport')
    return sql<Row>`SELECT * FROM app.travel_transport WHERE owner_userid=${owner} AND journey_id=${String(input.journeyId)} AND date IS NOT DISTINCT FROM ${input.date ?? null} AND upper(origin)=upper(${String(input.origin)}) AND upper(destination)=upper(${String(input.destination)}) AND lower(coalesce(carrier,''))=lower(coalesce(${input.carrier ?? null},'')) AND lower(coalesce(number,''))=lower(coalesce(${input.number ?? null},'')) LIMIT 1`.execute(
      trx,
    );
  if (entity === 'stay') {
    if (input.evidence === 'want' && input.segmentId == null)
      return sql<Row>`SELECT * FROM app.travel_stays WHERE owner_userid=${owner} AND evidence='want' AND segment_id IS NULL AND lower(coalesce(property,''))=lower(coalesce(${input.property ?? null},'')) AND lower(city)=lower(${String(input.city)}) AND check_in IS NULL LIMIT 1`.execute(
        trx,
      );
    return sql<Row>`SELECT * FROM app.travel_stays WHERE owner_userid=${owner} AND segment_id=${String(input.segmentId)} AND lower(coalesce(property,''))=lower(coalesce(${input.property ?? null},'')) AND check_in IS NOT DISTINCT FROM ${input.checkIn ?? null} LIMIT 1`.execute(
      trx,
    );
  }
  return sql<Row>`SELECT * FROM app.travel_ideas WHERE owner_userid=${owner} AND lower(idea)=lower(${String(input.idea)}) LIMIT 1`.execute(
    trx,
  );
}

export async function writeTravelEntity(
  owner: string,
  entity: Entity,
  operation: 'create' | 'update',
  input: Row,
) {
  if (entity === 'place') return writeTravelPlace(owner, input);
  const dryRun = input.dryRun === true;
  const id = typeof input.id === 'string' ? input.id : undefined;
  return runInTransaction(async (trx) => {
    let current: Row | null = id ? await readById(trx, entity, owner, id) : null;
    if (!id && operation === 'create') {
      const found = await findNaturalRow(trx, owner, entity, input);
      current = found.rows[0] ? decodeEntity(entity, found.rows[0]) : null;
      if (current)
        return { entity: current, action: 'unchanged', created: 0, updated: 0, unchanged: 1 };
    }
    if (id && !current) return { entity: null, action: 'notFound' };
    if (id && input.ifUpdatedAt && !matchesVersion(current?.updatedAt, input.ifUpdatedAt))
      return { entity: current, action: 'version_conflict', reason: 'version_conflict' };
    const payload: Row = {};
    for (const [key, column] of Object.entries(FIELDS[entity]))
      if (input[key] !== undefined) payload[column] = input[key];

    if (entity === 'stay' && input.segmentId != null) {
      const segment = await sql<{
        journey_id: string;
      }>`SELECT journey_id FROM app.travel_journey_segments WHERE owner_userid=${owner} AND id=${String(input.segmentId)} LIMIT 1`.execute(
        trx,
      );
      if (!segment.rows[0]) return { entity: null, reason: 'unknown_segment' };
      if (input.journeyId !== undefined && input.journeyId !== segment.rows[0].journey_id)
        return { entity: null, reason: 'segment_journey_mismatch' };
      payload.journey_id = segment.rows[0].journey_id;
    }
    if (entity === 'transport') {
      const mode = String(input.mode ?? current?.mode ?? '');
      const originCode = String(input.origin ?? current?.origin ?? '');
      const destinationCode = String(input.destination ?? current?.destination ?? '');
      const origin = await resolveAirportSelection(trx, owner, {
        code: originCode,
        referenceId: String(input.originReferenceId ?? current?.originReferenceId ?? '') || null,
      });
      const destination = await resolveAirportSelection(trx, owner, {
        code: destinationCode,
        referenceId:
          String(input.destinationReferenceId ?? current?.destinationReferenceId ?? '') || null,
      });
      if (!origin || !destination) throw new ValidationError('unknown_airport');
      payload.origin = origin.code;
      payload.destination = destination.code;
      payload.origin_reference_id = origin.referenceId;
      payload.destination_reference_id = destination.referenceId;
      if (mode !== 'air' && mode !== 'rail') throw new ValidationError('invalid_transport_mode');
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
          ? decodeEntity(entity, { ...normalizedCurrent, ...payload })
          : decodeEntity(entity, { id: randomUUID(), owner_userid: owner, ...payload }),
        action: current ? 'updated' : 'created',
        created: current ? 0 : 1,
        updated: current ? 1 : 0,
        unchanged: 0,
      };
    if (current) {
      const assignments = Object.entries(payload).map(
        ([key, value]) => sql`${sql.ref(key)}=${value}`,
      );
      await sql`UPDATE ${table(entity)} SET ${sql.join(assignments)} WHERE owner_userid=${owner} AND id=${String(current.id)}`.execute(
        trx,
      );
      return {
        entity: await readById(trx, entity, owner, String(current.id)),
        action: 'updated',
        created: 0,
        updated: 1,
        unchanged: 0,
      };
    }
    const newId = randomUUID();
    const columns = ['id', 'owner_userid', ...Object.keys(payload)];
    const values = [newId, owner, ...Object.values(payload)];
    await sql`INSERT INTO ${table(entity)} (${sql.join(columns.map((column) => sql.ref(column)))} ) VALUES (${sql.join(values.map((value) => sql.val(value)))})`.execute(
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
          : constraint.includes('transport_dep_segment') ||
              constraint.includes('transport_arr_segment')
            ? 'segment_journey_mismatch'
            : constraint.includes('stays_segment')
              ? 'unknown_segment'
              : constraint.includes('date') || constraint.includes('range')
                ? 'invalid_date_range'
                : 'travel_write_failed';
    throw new ValidationError(reason);
  });
}

async function writeTravelPlace(owner: string, input: Row) {
  const dryRun = input.dryRun === true;
  const id = typeof input.id === 'string' ? input.id : undefined;
  return runInTransaction(async (trx) => {
    const current = id ? await readById(trx, 'place', owner, id) : null;
    if (id && !current) return { entity: null, action: 'notFound' };
    if (id && input.ifUpdatedAt && !matchesVersion(current?.updatedAt, input.ifUpdatedAt))
      return { entity: current, action: 'version_conflict', reason: 'version_conflict' };
    const placePayload: Row = {};
    for (const [key, column] of Object.entries({
      place: 'name',
      country: 'country',
      type: 'place_type',
      firstVisited: 'first_visited',
      lastVisited: 'last_visited',
      notes: 'notes',
    }))
      if (input[key] !== undefined) placePayload[column] = input[key];
    const relationshipPayload: Row = {};
    for (const [key, column] of Object.entries(FIELDS.place))
      if (input[key] !== undefined) relationshipPayload[column] = input[key];
    const changed =
      !current ||
      Object.entries({
        place: input.place,
        country: input.country,
        type: input.type,
        firstVisited: input.firstVisited,
        lastVisited: input.lastVisited,
        notes: input.notes,
        wantToGo: input.wantToGo,
        archived: input.archived,
      }).some(
        ([key, value]) =>
          value !== undefined && !isDeepStrictEqual(current[key] ?? null, value ?? null),
      );
    if (!changed)
      return { entity: current, action: 'unchanged', created: 0, updated: 0, unchanged: 1 };
    const entityId = id ?? randomUUID();
    if (dryRun) {
      const projected = {
        ...current,
        id: entityId,
        ownerUserid: owner,
        ...Object.fromEntries(
          Object.entries(input).filter(([key]) =>
            [
              'place',
              'country',
              'type',
              'firstVisited',
              'lastVisited',
              'notes',
              'wantToGo',
              'archived',
            ].includes(key),
          ),
        ),
      };
      return {
        entity: projected,
        action: current ? 'updated' : 'created',
        created: current ? 0 : 1,
        updated: current ? 1 : 0,
        unchanged: 0,
      };
    }
    if (current) {
      if (Object.keys(placePayload).length) {
        const assignments = Object.entries(placePayload).map(
          ([key, value]) => sql`${sql.ref(key)} = ${value}`,
        );
        await sql`UPDATE app.places SET ${sql.join(assignments)} WHERE id = ${entityId} AND owner_userid = ${owner}`.execute(
          trx,
        );
      }
      if (Object.keys(relationshipPayload).length) {
        const assignments = Object.entries(relationshipPayload).map(
          ([key, value]) => sql`${sql.ref(key)} = ${value}`,
        );
        await sql`UPDATE app.travel_places SET ${sql.join(assignments)} WHERE place_id = ${entityId} AND owner_userid = ${owner}`.execute(
          trx,
        );
      }
    } else {
      const columns = ['id', 'owner_userid', ...Object.keys(placePayload)];
      const values = [entityId, owner, ...Object.values(placePayload)];
      await sql`INSERT INTO app.places (${sql.join(columns.map((column) => sql.ref(column)))} ) VALUES (${sql.join(values.map((value) => sql.val(value)))})`.execute(
        trx,
      );
      await sql`INSERT INTO app.travel_places (place_id, owner_userid, want_to_go, archived)
        VALUES (${entityId}, ${owner}, ${relationshipPayload.want_to_go ?? false}, ${relationshipPayload.archived ?? false})`.execute(
        trx,
      );
    }
    return {
      entity: await readById(trx, 'place', owner, entityId),
      action: current ? 'updated' : 'created',
      created: current ? 0 : 1,
      updated: current ? 1 : 0,
      unchanged: 0,
    };
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
      }>`SELECT (SELECT count(*) FROM app.travel_journey_segments WHERE owner_userid=${owner} AND journey_id=${id}) + (SELECT count(*) FROM app.travel_transport WHERE owner_userid=${owner} AND journey_id=${id}) + (SELECT count(*) FROM app.travel_stays WHERE owner_userid=${owner} AND journey_id=${id}) AS count`.execute(
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
          sql<Row>`SELECT * FROM app.travel_journey_segments WHERE owner_userid=${owner} AND journey_id=${id} ORDER BY seq`.execute(
            trx,
          ),
          sql<Row>`SELECT * FROM app.travel_transport WHERE owner_userid=${owner} AND journey_id=${id}`.execute(
            trx,
          ),
          sql<Row>`SELECT * FROM app.travel_stays WHERE owner_userid=${owner} AND journey_id=${id}`.execute(
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
    const deleted = cascadeSnapshot ? { ...current, cascaded: cascadeSnapshot } : current;
    if (input.dryRun === true) return { deleted, notFound: [], dryRun: true };
    if (entity === 'place') {
      await sql`DELETE FROM app.travel_places WHERE owner_userid = ${owner} AND place_id = ${id}`.execute(
        trx,
      );
      return { deleted, notFound: [] };
    }
    await sql`DELETE FROM ${table(entity)} WHERE owner_userid=${owner} AND id=${id}`.execute(trx);
    return { deleted, notFound: [] };
  });
}

export async function getTravelWriteEntity(
  owner: string,
  entity: 'transport' | 'stay',
  input: { id: string },
) {
  const result =
    await sql<Row>`SELECT * FROM ${table(entity)} WHERE owner_userid=${owner} AND id=${input.id} LIMIT 1`.execute(
      db,
    );
  return { entity: result.rows[0] ? camel(result.rows[0]) : null, reason: null };
}
