import { randomUUID } from 'node:crypto';

import { runInTransaction, sql } from '@hominem/db/core';
import type { TransactionHandle } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import type * as z from 'zod';

import { travelJourneySaveInputSchema } from '../schemas/travel-maintenance.schema';

type Row = Record<string, unknown>;
type WriteAction = 'created' | 'updated' | 'unchanged';
const legacy = async (trx: TransactionHandle, owner: string, table: string, prefix: string) => {
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${owner}:${table}:legacy_id`}, 0))`.execute(
    trx,
  );
  const result = await sql<{
    next: number;
  }>`SELECT coalesce(max(substring(legacy_id from '[0-9]+$')::int), 0) + 1 AS next FROM ${sql.raw(`app.${table}`)} WHERE owner_userid = ${owner}`.execute(
    trx,
  );
  return `${prefix}-${String(result.rows[0]?.next ?? 1).padStart(3, '0')}`;
};
const shiftDate = (value: unknown, delta: number) => {
  if (typeof value !== 'string') return value;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
};

async function upsertDossierRow(
  trx: TransactionHandle,
  owner: string,
  tableName: string,
  fields: Row,
  key: string[],
  dryRun = false,
): Promise<{ action: WriteAction; row: Row }> {
  const where = key.map(
    (column) => sql`${sql.ref(column)} IS NOT DISTINCT FROM ${fields[column] ?? null}`,
  );
  const existing =
    await sql<Row>`SELECT * FROM ${sql.raw(`app.${tableName}`)} WHERE owner_userid = ${owner} AND ${sql.join(where, sql` AND `)} LIMIT 1`.execute(
      trx,
    );
  const current = existing.rows[0];
  const changed =
    !current ||
    Object.entries(fields).some(
      ([column, value]) =>
        JSON.stringify(current[column] ?? null) !== JSON.stringify(value ?? null),
    );
  if (!changed) return { action: 'unchanged', row: current };
  if (dryRun)
    return {
      action: current ? 'updated' : 'created',
      row: { ...current, ...fields, id: current?.id ?? randomUUID() },
    };
  if (current) {
    const assignments = Object.entries(fields).map(
      ([column, value]) => sql`${sql.ref(column)} = ${value}`,
    );
    await sql`UPDATE ${sql.raw(`app.${tableName}`)} SET ${sql.join(assignments)} WHERE owner_userid = ${owner} AND id = ${String(current.id)}`.execute(
      trx,
    );
    return { action: 'updated', row: { ...current, ...fields } };
  }
  const columns = ['owner_userid', ...Object.keys(fields)];
  const inserted =
    await sql<Row>`INSERT INTO ${sql.raw(`app.${tableName}`)} (${sql.join(columns.map((column) => sql.ref(column)))} ) VALUES (${sql.join([owner, ...Object.values(fields)].map((value) => sql.val(value)))}) RETURNING *`.execute(
      trx,
    );
  return { action: 'created', row: inserted.rows[0] };
}

export async function saveTravelJourney(
  owner: string,
  input: z.infer<typeof travelJourneySaveInputSchema>,
) {
  const parsed = travelJourneySaveInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const section = String(issue?.path[0] ?? 'dossier');
    throw new ValidationError(`${section}_invalid:${issue?.message ?? 'invalid_input'}`);
  }
  input = parsed.data;
  return runInTransaction(async (trx) => {
    const counters = {
      journeys: { created: 0, updated: 0, unchanged: 0 },
      segments: { created: 0, updated: 0, unchanged: 0 },
      transport: { created: 0, updated: 0, unchanged: 0 },
      stays: { created: 0, updated: 0, unchanged: 0 },
    };
    const journeyFields = {
      legacy_id: String(
        input.journey.legacyId ?? (await legacy(trx, owner, 'travel_journeys', 'JRN')),
      ),
      name: input.journey.name,
      start_date: input.journey.startDate ?? null,
      end_date: input.journey.endDate ?? null,
      purpose: input.journey.purpose ?? null,
      notes: input.journey.notes ?? null,
      ...(input.journey.archived === undefined ? {} : { archived: input.journey.archived }),
    };
    const journey = await upsertDossierRow(
      trx,
      owner,
      'travel_journeys',
      journeyFields,
      ['legacy_id'],
      input.dryRun,
    );
    counters.journeys[journey.action] += 1;
    const journeyId = String(journey.row?.id ?? '');
    const localSegments = new Map<string, string>();
    const segmentIdByLegacy = new Map<string, string>();
    const suppliedSegmentIds = new Set(
      input.segments.flatMap((segment) => (segment.legacyId ? [segment.legacyId] : [])),
    );
    const duplicateSequence = await sql<{ seq: number; legacy_id: string }>`
      SELECT seq, legacy_id FROM app.travel_journey_segments
      WHERE owner_userid = ${owner} AND journey_id = ${journeyId}
        AND seq = ANY(${input.segments.map((segment) => segment.seq)})
    `.execute(trx);
    if (duplicateSequence.rows.some((row) => !suppliedSegmentIds.has(row.legacy_id)))
      throw new ValidationError('segments_invalid:duplicate_seq');
    for (const source of input.segments) {
      const legacyId = String(
        source.legacyId ?? (await legacy(trx, owner, 'travel_journey_segments', 'SEG')),
      );
      const fields = {
        legacy_id: legacyId,
        journey_id: journeyId,
        seq: Number(source.seq),
        place_id: String(source.placeId),
        arrival_date: source.arrivalDate ?? null,
        departure_date: source.departureDate ?? null,
        notes: source.notes ?? null,
      };
      const place = await sql<{ id: string }>`
        SELECT id FROM app.travel_places WHERE owner_userid = ${owner} AND id = ${fields.place_id}
      `.execute(trx);
      if (!place.rows.length)
        throw new ValidationError(`segments_invalid:unknown_place:${legacyId}`);
      const priorSegment = await sql<{ journey_id: string; journeyId?: string }>`
        SELECT journey_id FROM app.travel_journey_segments
        WHERE owner_userid = ${owner} AND legacy_id = ${legacyId}
      `.execute(trx);
      if (
        priorSegment.rows[0] &&
        String(priorSegment.rows[0].journey_id ?? priorSegment.rows[0].journeyId) !== journeyId
      )
        throw new ValidationError(`segments_invalid:journey_mismatch:${legacyId}`);
      const saved = await upsertDossierRow(
        trx,
        owner,
        'travel_journey_segments',
        fields,
        ['legacy_id'],
        input.dryRun,
      );
      if (String(saved.row?.journey_id ?? saved.row?.journeyId) !== journeyId && !input.dryRun)
        throw new ValidationError(`segments_invalid:journey_mismatch:${legacyId}`);
      counters.segments[saved.action] += 1;
      segmentIdByLegacy.set(legacyId, String(saved.row?.id ?? randomUUID()));
      if (typeof source.key === 'string')
        localSegments.set(source.key, segmentIdByLegacy.get(legacyId)!);
    }
    for (const source of input.transport) {
      const legacyId = String(
        source.legacyId ?? (await legacy(trx, owner, 'travel_transport', 'T')),
      );
      const depSegmentId = String(source.depSegmentLegacyId ?? source.depSegmentKey ?? '')
        ? (segmentIdByLegacy.get(String(source.depSegmentLegacyId)) ??
          localSegments.get(String(source.depSegmentKey)) ??
          null)
        : null;
      const arrSegmentId = String(source.arrSegmentLegacyId ?? source.arrSegmentKey ?? '')
        ? (segmentIdByLegacy.get(String(source.arrSegmentLegacyId)) ??
          localSegments.get(String(source.arrSegmentKey)) ??
          null)
        : null;
      const fields = {
        legacy_id: legacyId,
        date: source.date ?? null,
        mode: source.mode,
        origin: String(source.origin),
        destination: String(source.destination),
        carrier: source.carrier ?? null,
        number: source.number ?? null,
        booking_ref: source.bookingRef ?? null,
        dep_segment_id: depSegmentId,
        arr_segment_id: arrSegmentId,
        journey_id: journeyId,
        legacy_trip: source.legacyTrip ?? null,
        notes: source.notes ?? null,
      };
      if (
        ((source.depSegmentLegacyId || source.depSegmentKey) && !depSegmentId) ||
        ((source.arrSegmentLegacyId || source.arrSegmentKey) && !arrSegmentId)
      )
        throw new ValidationError(`unknown_segment:${legacyId}`);
      const airports = await sql<{
        originExists: boolean;
        destinationExists: boolean;
      }>`SELECT EXISTS (SELECT 1 FROM app.travel_airports WHERE owner_userid = ${owner} AND code = ${fields.origin}) AS "originExists", EXISTS (SELECT 1 FROM app.travel_airports WHERE owner_userid = ${owner} AND code = ${fields.destination}) AS "destinationExists"`.execute(
        trx,
      );
      if (!airports.rows[0]?.originExists || !airports.rows[0]?.destinationExists)
        throw new ValidationError(`transport_invalid:unknown_airport:${legacyId}`);
      const saved = await upsertDossierRow(
        trx,
        owner,
        'travel_transport',
        fields,
        ['legacy_id', 'journey_id', 'date', 'origin', 'destination'],
        input.dryRun,
      );
      counters.transport[saved.action] += 1;
    }
    for (const source of input.stays) {
      const legacyId = String(source.legacyId ?? (await legacy(trx, owner, 'travel_stays', 'STY')));
      const segmentId =
        segmentIdByLegacy.get(String(source.segmentLegacyId ?? '')) ??
        localSegments.get(String(source.segmentKey ?? ''));
      if (!segmentId) throw new ValidationError(`unknown_segment:${legacyId}`);
      const fields = {
        legacy_id: legacyId,
        segment_id: segmentId,
        journey_id: journeyId,
        check_in: source.checkIn ?? null,
        check_out: source.checkOut ?? null,
        city: source.city,
        country: source.country ?? null,
        property: source.property ?? null,
        booking_ref: source.bookingRef ?? null,
        evidence: source.evidence,
        notes: source.notes ?? null,
      };
      const saved = await upsertDossierRow(
        trx,
        owner,
        'travel_stays',
        fields,
        ['legacy_id'],
        input.dryRun,
      );
      counters.stays[saved.action] += 1;
    }
    return { dryRun: input.dryRun, journey: journey.row, counters };
  });
}

export async function reorderTravelSegments(
  owner: string,
  input: { journeyId: string; order: string[]; dryRun: boolean },
) {
  return runInTransaction(async (trx) => {
    const found = await sql<{
      id: string;
      seq: number;
    }>`SELECT id, seq FROM app.travel_journey_segments WHERE owner_userid = ${owner} AND journey_id = ${input.journeyId} ORDER BY seq`.execute(
      trx,
    );
    const actual = new Set(found.rows.map((row) => row.id));
    if (
      found.rows.length !== input.order.length ||
      input.order.some((id) => !actual.has(id)) ||
      new Set(input.order).size !== input.order.length
    )
      return { reordered: false, reason: 'invalid_order', segments: found.rows };
    if (input.dryRun) return { reordered: true, dryRun: true, order: input.order };
    const max = Math.max(0, ...found.rows.map((row) => Number(row.seq)));
    const offset = max + input.order.length + 1;
    await sql`UPDATE app.travel_journey_segments SET seq = seq + ${offset} WHERE owner_userid = ${owner} AND journey_id = ${input.journeyId}`.execute(
      trx,
    );
    for (let i = 0; i < input.order.length; i += 1)
      await sql`UPDATE app.travel_journey_segments SET seq = ${i + 1} WHERE id = ${input.order[i]} AND owner_userid = ${owner}`.execute(
        trx,
      );
    return { reordered: true, segments: input.order.map((id, index) => ({ id, seq: index + 1 })) };
  });
}

export async function mergeTravelSegments(
  owner: string,
  input: { fromSegmentId: string; intoSegmentId: string; dryRun: boolean },
) {
  return runInTransaction(async (trx) => {
    const found =
      await sql<Row>`SELECT * FROM app.travel_journey_segments WHERE owner_userid = ${owner} AND id = ANY(${[input.fromSegmentId, input.intoSegmentId]})`.execute(
        trx,
      );
    const from = found.rows.find((row) => row.id === input.fromSegmentId);
    const into = found.rows.find((row) => row.id === input.intoSegmentId);
    if (!from || !into) return { merged: false, reason: 'notFound' };
    if (input.fromSegmentId === input.intoSegmentId)
      return { merged: false, reason: 'same_segment' };
    if (from.journey_id !== into.journey_id)
      return { merged: false, reason: 'segment_journey_mismatch' };
    const stayCount = await sql<{
      count: number;
    }>`SELECT count(*) AS count FROM app.travel_stays WHERE owner_userid = ${owner} AND segment_id = ${input.fromSegmentId}`.execute(
      trx,
    );
    if (input.dryRun)
      return {
        merged: true,
        dryRun: true,
        staysRepointed: Number(stayCount.rows[0]?.count ?? 0),
        deleted: from,
      };
    await sql`UPDATE app.travel_stays SET segment_id = ${input.intoSegmentId} WHERE owner_userid = ${owner} AND segment_id = ${input.fromSegmentId}`.execute(
      trx,
    );
    await sql`UPDATE app.travel_transport SET dep_segment_id = ${input.intoSegmentId} WHERE owner_userid = ${owner} AND dep_segment_id = ${input.fromSegmentId}`.execute(
      trx,
    );
    await sql`UPDATE app.travel_transport SET arr_segment_id = ${input.intoSegmentId} WHERE owner_userid = ${owner} AND arr_segment_id = ${input.fromSegmentId}`.execute(
      trx,
    );
    await sql`UPDATE app.travel_journey_segments SET arrival_date = CASE WHEN arrival_date IS NULL THEN ${from.arrival_date}::date WHEN ${from.arrival_date}::date IS NULL THEN arrival_date ELSE least(arrival_date, ${from.arrival_date}::date) END, departure_date = CASE WHEN departure_date IS NULL THEN ${from.departure_date}::date WHEN ${from.departure_date}::date IS NULL THEN departure_date ELSE greatest(departure_date, ${from.departure_date}::date) END, notes = concat_ws(E'\n', nullif(notes, ''), nullif(${String(from.notes ?? '')}, '')) WHERE owner_userid = ${owner} AND id = ${input.intoSegmentId}`.execute(
      trx,
    );
    await sql`DELETE FROM app.travel_journey_segments WHERE owner_userid = ${owner} AND id = ${input.fromSegmentId}`.execute(
      trx,
    );
    return { merged: true, deleted: from, staysRepointed: Number(stayCount.rows[0]?.count ?? 0) };
  });
}

export async function mergeTravelPlace(
  owner: string,
  input: { fromId: string; intoId: string; dryRun: boolean },
) {
  return runInTransaction(async (trx) => {
    const found =
      await sql<Row>`SELECT * FROM app.travel_places WHERE owner_userid = ${owner} AND id = ANY(${[input.fromId, input.intoId]})`.execute(
        trx,
      );
    const from = found.rows.find((row) => row.id === input.fromId);
    const into = found.rows.find((row) => row.id === input.intoId);
    if (!from || !into) return { merged: false, reason: 'notFound' };
    const count = await sql<{
      count: number;
    }>`SELECT count(*) AS count FROM app.travel_journey_segments WHERE owner_userid = ${owner} AND place_id = ${input.fromId}`.execute(
      trx,
    );
    if (input.dryRun)
      return {
        merged: true,
        dryRun: true,
        segmentsRepointed: Number(count.rows[0]?.count ?? 0),
        deleted: from,
      };
    await sql`UPDATE app.travel_journey_segments SET place_id = ${input.intoId} WHERE owner_userid = ${owner} AND place_id = ${input.fromId}`.execute(
      trx,
    );
    await sql`UPDATE app.travel_residences SET place_id = ${input.intoId} WHERE owner_userid = ${owner} AND place_id = ${input.fromId}`.execute(
      trx,
    );
    await sql`DELETE FROM app.travel_places WHERE owner_userid = ${owner} AND id = ${input.fromId}`.execute(
      trx,
    );
    return { merged: true, deleted: from, segmentsRepointed: Number(count.rows[0]?.count ?? 0) };
  });
}

export async function mergeTravelAirports(
  owner: string,
  input: { fromId: string; intoId: string; dryRun: boolean },
) {
  return runInTransaction(async (trx) => {
    const found =
      await sql<Row>`SELECT * FROM app.travel_airports WHERE owner_userid = ${owner} AND id = ANY(${[input.fromId, input.intoId]})`.execute(
        trx,
      );
    const from = found.rows.find((row) => row.id === input.fromId);
    const into = found.rows.find((row) => row.id === input.intoId);
    if (!from || !into) return { merged: false, reason: 'notFound' };
    const count = await sql<{
      count: number;
    }>`SELECT count(*) AS count FROM app.travel_transport WHERE owner_userid = ${owner} AND (origin = ${String(from.code)} OR destination = ${String(from.code)})`.execute(
      trx,
    );
    if (input.dryRun)
      return {
        merged: true,
        dryRun: true,
        legsRepointed: Number(count.rows[0]?.count ?? 0),
        deleted: from,
      };
    await sql`UPDATE app.travel_transport SET origin = ${String(into.code)} WHERE owner_userid = ${owner} AND origin = ${String(from.code)}`.execute(
      trx,
    );
    await sql`UPDATE app.travel_transport SET destination = ${String(into.code)} WHERE owner_userid = ${owner} AND destination = ${String(from.code)}`.execute(
      trx,
    );
    await sql`DELETE FROM app.travel_airports WHERE owner_userid = ${owner} AND id = ${input.fromId}`.execute(
      trx,
    );
    return { merged: true, deleted: from, legsRepointed: Number(count.rows[0]?.count ?? 0) };
  });
}

export async function refreshTravelPlaces(owner: string, dryRun: boolean) {
  return runInTransaction(async (trx) => {
    const result =
      await sql<Row>`SELECT p.id, p.place, p.status, p.first_visited, p.last_visited, min(s.arrival_date) AS derived_first, max(s.departure_date) AS derived_last, count(s.id) AS visits FROM app.travel_places p LEFT JOIN app.travel_journey_segments s ON s.owner_userid = p.owner_userid AND s.place_id = p.id WHERE p.owner_userid = ${owner} GROUP BY p.id ORDER BY p.place`.execute(
        trx,
      );
    const diff: Row[] = [];
    for (const row of result.rows) {
      const status = Number(row.visits) > 0 ? 'Visited' : 'Want to go';
      for (const [field, stored, derived] of [
        ['status', row.status, status],
        ['firstVisited', row.first_visited, row.derived_first],
        ['lastVisited', row.last_visited, row.derived_last],
      ] as const) {
        const a = stored == null ? null : String(stored).slice(0, 10);
        const b = derived == null ? null : String(derived).slice(0, 10);
        if (a !== b) diff.push({ id: row.id, place: row.place, field, stored: a, derived: b });
      }
      if (!dryRun)
        await sql`UPDATE app.travel_places SET status = ${status}, first_visited = ${row.derived_first}, last_visited = ${row.derived_last} WHERE owner_userid = ${owner} AND id = ${String(row.id)}`.execute(
          trx,
        );
    }
    return { dryRun, changesApplied: !dryRun, diff };
  });
}

export async function cloneTravelJourney(
  owner: string,
  input: { id: string; name?: string; startDate?: string | null; dryRun: boolean },
) {
  return runInTransaction(async (trx) => {
    const source =
      await sql<Row>`SELECT * FROM app.travel_journeys WHERE owner_userid = ${owner} AND id = ${input.id}`.execute(
        trx,
      );
    const journey = source.rows[0];
    if (!journey) return { journey: null, reason: 'unknown_journey' };
    const oldStart = journey.start_date
      ? new Date(`${String(journey.start_date).slice(0, 10)}T00:00:00Z`)
      : null;
    const newStart = input.startDate ? new Date(`${input.startDate}T00:00:00Z`) : oldStart;
    const delta =
      oldStart && newStart ? Math.round((newStart.valueOf() - oldStart.valueOf()) / 86400000) : 0;
    const segments =
      await sql<Row>`SELECT * FROM app.travel_journey_segments WHERE owner_userid = ${owner} AND journey_id = ${input.id} ORDER BY seq`.execute(
        trx,
      );
    const transports =
      await sql<Row>`SELECT * FROM app.travel_transport WHERE owner_userid = ${owner} AND journey_id = ${input.id}`.execute(
        trx,
      );
    const stays =
      await sql<Row>`SELECT * FROM app.travel_stays WHERE owner_userid = ${owner} AND journey_id = ${input.id}`.execute(
        trx,
      );
    if (input.dryRun)
      return {
        dryRun: true,
        counts: {
          journeys: 1,
          segments: segments.rows.length,
          transport: transports.rows.length,
          stays: stays.rows.length,
        },
        dateShiftDays: delta,
      };
    const newJourneyId = randomUUID();
    const newJourneyLegacy = await legacy(trx, owner, 'travel_journeys', 'JRN');
    await sql`INSERT INTO app.travel_journeys (id, owner_userid, legacy_id, name, start_date, end_date, purpose, notes, archived) VALUES (${newJourneyId}, ${owner}, ${newJourneyLegacy}, ${input.name ?? `${String(journey.name)} (copy)`}, ${shiftDate(journey.start_date, delta)}, ${shiftDate(journey.end_date, delta)}, ${journey.purpose}, ${journey.notes}, false)`.execute(
      trx,
    );
    const segmentIds = new Map<string, string>();
    for (const segment of segments.rows) {
      const id = randomUUID();
      segmentIds.set(String(segment.id), id);
      await sql`INSERT INTO app.travel_journey_segments (id, owner_userid, legacy_id, journey_id, seq, place_id, arrival_date, departure_date, notes) VALUES (${id}, ${owner}, ${await legacy(trx, owner, 'travel_journey_segments', 'SEG')}, ${newJourneyId}, ${segment.seq}, ${segment.place_id}, ${shiftDate(segment.arrival_date, delta)}, ${shiftDate(segment.departure_date, delta)}, ${segment.notes})`.execute(
        trx,
      );
    }
    for (const leg of transports.rows)
      await sql`INSERT INTO app.travel_transport (id, owner_userid, legacy_id, date, mode, origin, destination, carrier, number, booking_ref, dep_segment_id, arr_segment_id, journey_id, legacy_trip, notes) VALUES (${randomUUID()}, ${owner}, ${await legacy(trx, owner, 'travel_transport', 'T')}, ${shiftDate(leg.date, delta)}, ${leg.mode}, ${leg.origin}, ${leg.destination}, ${leg.carrier}, ${leg.number}, NULL, ${segmentIds.get(String(leg.dep_segment_id)) ?? null}, ${segmentIds.get(String(leg.arr_segment_id)) ?? null}, ${newJourneyId}, ${leg.legacy_trip}, ${leg.notes})`.execute(
        trx,
      );
    for (const stay of stays.rows)
      await sql`INSERT INTO app.travel_stays (id, owner_userid, legacy_id, segment_id, journey_id, check_in, check_out, city, country, property, booking_ref, evidence, notes) VALUES (${randomUUID()}, ${owner}, ${await legacy(trx, owner, 'travel_stays', 'STY')}, ${segmentIds.get(String(stay.segment_id)) ?? null}, ${newJourneyId}, ${shiftDate(stay.check_in, delta)}, ${shiftDate(stay.check_out, delta)}, ${stay.city}, ${stay.country}, ${stay.property}, NULL, ${stay.evidence}, ${stay.notes})`.execute(
        trx,
      );
    return {
      journey: {
        id: newJourneyId,
        legacyId: newJourneyLegacy,
        name: input.name ?? `${String(journey.name)} (copy)`,
      },
      counts: {
        journeys: 1,
        segments: segments.rows.length,
        transport: transports.rows.length,
        stays: stays.rows.length,
      },
      dateShiftDays: delta,
    };
  });
}
