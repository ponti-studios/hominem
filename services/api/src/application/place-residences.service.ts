import { randomUUID } from 'node:crypto';

import { db, runInTransaction, sql } from '@hominem/db/core';
import type { TransactionHandle } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';

import { placeResidencePeriodsSchema } from '../schemas/place-residences.schema';

type Period = {
  startDate: string;
  endDate: string | null;
  ongoing: boolean;
  precision: 'day' | 'month' | 'year';
  note?: string | null;
};
type Row = Record<string, unknown>;
type Residence = {
  id: string;
  placeId: string;
  place: string;
  country: string | null;
  periods: Period[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
type Counts = { created: number; updated: number; unchanged: number };
type Mutation = { residence: Residence | null } & Counts & { deleted?: boolean };
const result = (residence: Residence | null, counts: Counts, deleted?: boolean): Mutation => ({
  ...counts,
  residence,
  ...(deleted === undefined ? {} : { deleted }),
});
const iso = (value: unknown) => new Date(String(value)).toISOString();
const decode = (row: Row): Residence => ({
  id: String(row.id),
  placeId: String(row.place_id ?? row.placeId),
  place: String(row.place),
  country: row.country == null ? null : String(row.country),
  periods: placeResidencePeriodsSchema.parse(
    typeof row.periods === 'string' ? JSON.parse(row.periods) : row.periods,
  ),
  notes: row.notes == null ? null : String(row.notes),
  createdAt: iso(row.created_at ?? row.createdAt),
  updatedAt: iso(row.updated_at ?? row.updatedAt),
});

async function selectResidence(
  executor: typeof db | TransactionHandle,
  owner: string,
  input: { id?: string; placeId?: string; place?: string } = {},
) {
  const id = input.id ?? null;
  const placeId = input.placeId ?? null;
  const place = input.place ?? null;
  const rows = await sql<Row>`
    SELECT r.id, r.place_id, p.name AS place, p.country, r.notes,
      r.created_at, r.updated_at,
      coalesce(jsonb_agg(jsonb_build_object(
        'startDate', rp.start_date, 'endDate', rp.end_date, 'ongoing', rp.ongoing,
        'precision', rp.precision, 'note', rp.note
      ) ORDER BY rp.start_date, rp.id) FILTER (WHERE rp.id IS NOT NULL), '[]'::jsonb) AS periods
    FROM app.place_residences r
    JOIN app.places p ON p.id = r.place_id AND p.owner_userid = r.owner_userid
    LEFT JOIN app.place_residence_periods rp ON rp.residence_id = r.id AND rp.owner_userid = r.owner_userid
    WHERE r.owner_userid = ${owner}
      AND (${id}::uuid IS NULL OR r.id = ${id}::uuid)
      AND (${placeId}::uuid IS NULL OR r.place_id = ${placeId}::uuid)
      AND (${place}::text IS NULL OR p.name ILIKE ${place}::text)
    GROUP BY r.id, p.name, p.country
    ORDER BY p.name, r.created_at
  `.execute(executor);
  return rows.rows.map(decode);
}

function validatePeriods(periods: Period[]) {
  const parsed = placeResidencePeriodsSchema.safeParse(periods);
  if (!parsed.success) throw new ValidationError('invalid_period');
  if (periods.filter((period) => period.ongoing).length > 1)
    throw new ValidationError('multiple_current_periods');
}

async function lockCurrentHome(trx: TransactionHandle, owner: string) {
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${owner}:place_residence_periods:current_home`}, 0))`.execute(
    trx,
  );
}

async function ensureSingleCurrent(
  trx: TransactionHandle,
  owner: string,
  periods: Period[],
  exceptId?: string,
) {
  await lockCurrentHome(trx, owner);
  if (!periods.some((period) => period.ongoing)) return;
  const other = await sql<{ id: string }>`
    SELECT rp.id FROM app.place_residence_periods rp
    JOIN app.place_residences r ON r.id = rp.residence_id AND r.owner_userid = rp.owner_userid
    WHERE rp.owner_userid = ${owner} AND rp.ongoing AND r.id IS DISTINCT FROM ${exceptId ?? null}
    LIMIT 1
  `.execute(trx);
  if (other.rows.length) throw new ValidationError('multiple_current_homes');
}

async function insertPeriods(
  trx: TransactionHandle,
  owner: string,
  residenceId: string,
  periods: Period[],
) {
  for (const period of periods) {
    await sql`INSERT INTO app.place_residence_periods
      (owner_userid, residence_id, start_date, end_date, ongoing, precision, note)
      VALUES (${owner}, ${residenceId}, ${period.startDate}, ${period.endDate}, ${period.ongoing}, ${period.precision}, ${period.note ?? null})`.execute(
      trx,
    );
  }
}

export async function listPlaceResidences(
  owner: string,
  input: { limit: number; offset: number; placeId?: string; place?: string; current?: boolean },
) {
  const rows = await selectResidence(db, owner, { placeId: input.placeId, place: input.place });
  const filtered = rows.filter(
    (row) =>
      input.current === undefined || row.periods.some((period) => period.ongoing) === input.current,
  );
  return {
    residences: filtered.slice(input.offset, input.offset + input.limit),
    total: filtered.length,
    limit: input.limit,
    offset: input.offset,
    truncated: input.offset + input.limit < filtered.length,
  };
}

export async function getPlaceResidence(owner: string, input: { id: string }) {
  return (await selectResidence(db, owner, { id: input.id }))[0] ?? null;
}

export async function createPlaceResidence(
  owner: string,
  input: { placeId: string; periods: Period[]; notes?: string | null; dryRun?: boolean },
) {
  validatePeriods(input.periods);
  return runInTransaction(async (trx) => {
    await lockCurrentHome(trx, owner);
    const place = await sql<{ id: string; name: string; country: string | null }>`
      SELECT id, name, country FROM app.places WHERE id = ${input.placeId} AND owner_userid = ${owner}
    `.execute(trx);
    const selectedPlace = place.rows[0];
    if (!selectedPlace) throw new ValidationError('unknown_place');
    const existing = await sql<{ id: string }>`
      SELECT id FROM app.place_residences WHERE owner_userid = ${owner} AND place_id = ${input.placeId}
    `.execute(trx);
    if (existing.rows.length) {
      const current = await selectResidence(trx, owner, { id: existing.rows[0]!.id });
      return result(current[0] ?? null, { created: 0, updated: 0, unchanged: 1 });
    }
    const id = randomUUID();
    if (input.dryRun) {
      const now = new Date().toISOString();
      return result(
        {
          id,
          placeId: selectedPlace.id,
          place: selectedPlace.name,
          country: selectedPlace.country,
          periods: input.periods,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        },
        { created: 1, updated: 0, unchanged: 0 },
      );
    }
    await sql`INSERT INTO app.place_residences (id, owner_userid, place_id, notes)
      VALUES (${id}, ${owner}, ${input.placeId}, ${input.notes ?? null})`.execute(trx);
    await insertPeriods(trx, owner, id, input.periods);
    return result((await selectResidence(trx, owner, { id }))[0] ?? null, {
      created: 1,
      updated: 0,
      unchanged: 0,
    });
  });
}

export async function updatePlaceResidence(
  owner: string,
  input: {
    id: string;
    periods?: Period[];
    notes?: string | null;
    dryRun?: boolean;
    ifUpdatedAt?: string;
  },
) {
  return runInTransaction(async (trx) => {
    const locked = await sql<{ id: string; updated_at: string }>`
      SELECT id, updated_at FROM app.place_residences
      WHERE id = ${input.id} AND owner_userid = ${owner} FOR UPDATE
    `.execute(trx);
    const parent = locked.rows[0];
    if (!parent) return result(null, { created: 0, updated: 0, unchanged: 0 });
    const current = (await selectResidence(trx, owner, { id: input.id }))[0]!;
    if (input.ifUpdatedAt && Date.parse(current.updatedAt) !== Date.parse(input.ifUpdatedAt))
      throw new ValidationError('version_conflict');
    if (input.periods) {
      validatePeriods(input.periods);
      await ensureSingleCurrent(trx, owner, input.periods, input.id);
    }
    const periods = input.periods ?? current.periods;
    const notes = input.notes !== undefined ? input.notes : current.notes;
    const unchanged =
      JSON.stringify(periods) === JSON.stringify(current.periods) && notes === current.notes;
    if (unchanged || input.dryRun)
      return result(
        { ...current, periods, notes },
        {
          created: 0,
          updated: unchanged ? 0 : 1,
          unchanged: unchanged ? 1 : 0,
        },
      );
    if (input.periods) {
      await sql`DELETE FROM app.place_residence_periods WHERE residence_id = ${input.id} AND owner_userid = ${owner}`.execute(
        trx,
      );
      await insertPeriods(trx, owner, input.id, input.periods);
    }
    await sql`UPDATE app.place_residences SET notes = ${notes}, updated_at = now()
      WHERE id = ${input.id} AND owner_userid = ${owner}`.execute(trx);
    return result((await selectResidence(trx, owner, { id: input.id }))[0] ?? null, {
      created: 0,
      updated: 1,
      unchanged: 0,
    });
  });
}

export async function deletePlaceResidence(
  owner: string,
  input: string | { id: string; ifUpdatedAt?: string; dryRun?: boolean },
) {
  const id = typeof input === 'string' ? input : input.id;
  return runInTransaction(async (trx) => {
    await sql<{ updated_at: string }>`
      SELECT updated_at FROM app.place_residences WHERE id = ${id} AND owner_userid = ${owner} FOR UPDATE
    `.execute(trx);
    const residence = (await selectResidence(trx, owner, { id }))[0] ?? null;
    if (!residence) return result(null, { created: 0, updated: 0, unchanged: 0 }, false);
    if (
      typeof input !== 'string' &&
      input.ifUpdatedAt &&
      Date.parse(residence.updatedAt) !== Date.parse(input.ifUpdatedAt)
    )
      throw new ValidationError('version_conflict');
    if (typeof input !== 'string' && input.dryRun)
      return result(residence, { created: 0, updated: 0, unchanged: 0 }, false);
    const deleted =
      await sql`DELETE FROM app.place_residences WHERE id = ${id} AND owner_userid = ${owner}`.execute(
        trx,
      );
    if (!Number(deleted.numAffectedRows)) throw new ValidationError('version_conflict');
    return result(residence, { created: 0, updated: 0, unchanged: 0 }, true);
  });
}
