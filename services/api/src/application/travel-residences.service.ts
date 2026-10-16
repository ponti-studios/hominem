import { db, runInTransaction, sql } from '@hominem/db/core';
import type { TransactionHandle } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';

import { travelResidencePeriodsSchema } from '../schemas/travel-residences.schema';

const residenceQuery = () =>
  db
    .selectFrom('app.travelResidences as r')
    .innerJoin('app.travelPlaces as p', 'p.id', 'r.placeId')
    .select([
      'r.id',
      'r.legacyId',
      'r.placeId',
      'p.place',
      'p.country',
      'r.periods',
      'r.notes',
      'r.createdAt',
      'r.updatedAt',
    ]);

const asIsoTimestamp = (value: string | Date) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const decode = <T extends { periods: unknown; createdAt: string | Date; updatedAt: string | Date }>(
  row: T,
) => ({
  ...row,
  createdAt: asIsoTimestamp(row.createdAt),
  updatedAt: asIsoTimestamp(row.updatedAt),
  periods: travelResidencePeriodsSchema.parse(
    typeof row.periods === 'string' ? JSON.parse(row.periods) : row.periods,
  ),
});

export async function listTravelResidences(
  owner: string,
  input: { limit: number; offset: number; placeId?: string; place?: string; current?: boolean },
) {
  const rows = await residenceQuery()
    .where('r.ownerUserid', '=', owner)
    .$if(Boolean(input.placeId), (q) => q.where('r.placeId', '=', input.placeId!))
    .$if(Boolean(input.place), (q) => q.where('p.place', 'ilike', input.place!))
    .orderBy('p.place')
    .execute();
  const filtered = rows
    .filter(
      (row) =>
        input.current === undefined || decode(row).periods.some((p) => p.ongoing) === input.current,
    )
    .map(decode);
  return {
    residences: filtered.slice(input.offset, input.offset + input.limit),
    total: filtered.length,
    limit: input.limit,
    offset: input.offset,
    truncated: input.offset + input.limit < filtered.length,
  };
}

export async function getTravelResidence(owner: string, input: { id?: string; legacyId?: string }) {
  let query = residenceQuery().where('r.ownerUserid', '=', owner);
  query = input.id
    ? query.where('r.id', '=', input.id)
    : query.where('r.legacyId', '=', input.legacyId!);
  const row = await query.executeTakeFirst();
  return row ? decode(row) : null;
}

function validatePeriods(
  periods: { startDate: string; endDate: string | null; ongoing: boolean }[],
) {
  if (
    !periods.length ||
    periods.some((p) => (p.ongoing && p.endDate) || (p.endDate && p.endDate < p.startDate))
  )
    throw new ValidationError('invalid_period');
  if (periods.filter((period) => period.ongoing).length > 1)
    throw new ValidationError('multiple_current_periods');
}

async function ensureSingleCurrent(
  trx: TransactionHandle,
  owner: string,
  periods: { ongoing: boolean }[],
  exceptId?: string,
) {
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${owner}:travel_residences:current_home`}, 0))`.execute(
    trx,
  );
  if (!periods.some((p) => p.ongoing)) return;
  const residences = await trx
    .selectFrom('app.travelResidences')
    .select(['id', 'periods'])
    .where('ownerUserid', '=', owner)
    .execute();
  if (
    residences.some(
      (row) =>
        row.id !== exceptId &&
        travelResidencePeriodsSchema
          .parse(typeof row.periods === 'string' ? JSON.parse(row.periods) : row.periods)
          .some((period) => period.ongoing),
    )
  )
    throw new ValidationError('multiple_current_homes');
}

export async function createTravelResidence(
  owner: string,
  input: {
    placeId: string;
    legacyId?: string;
    periods: {
      startDate: string;
      endDate: string | null;
      ongoing: boolean;
      precision: 'day' | 'month' | 'year';
      note?: string | null;
    }[];
    notes?: string | null;
    dryRun?: boolean;
  },
) {
  validatePeriods(input.periods);
  return runInTransaction(async (trx) => {
    const place = await trx
      .selectFrom('app.travelPlaces')
      .select(['id', 'place', 'country'])
      .where('id', '=', input.placeId)
      .where('ownerUserid', '=', owner)
      .executeTakeFirst();
    if (!place) throw new ValidationError('unknown_place');
    if (input.legacyId) {
      const existing = await trx
        .selectFrom('app.travelResidences as r')
        .innerJoin('app.travelPlaces as p', 'p.id', 'r.placeId')
        .select([
          'r.id',
          'r.legacyId',
          'r.placeId',
          'p.place',
          'p.country',
          'r.periods',
          'r.notes',
          'r.createdAt',
          'r.updatedAt',
        ])
        .where('r.ownerUserid', '=', owner)
        .where('r.legacyId', '=', input.legacyId)
        .executeTakeFirst();
      if (existing) return decode(existing);
    }
    await ensureSingleCurrent(trx, owner, input.periods);
    const legacyId = input.legacyId ?? crypto.randomUUID();
    if (input.dryRun) {
      const now = new Date().toISOString();
      return {
        id: crypto.randomUUID(),
        legacyId,
        placeId: place.id,
        place: place.place,
        country: place.country,
        periods: input.periods,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
    }
    const [row] = await trx
      .insertInto('app.travelResidences')
      .values({
        ownerUserid: owner,
        placeId: input.placeId,
        legacyId,
        periods: JSON.stringify(input.periods),
        notes: input.notes ?? null,
      })
      .returning('id')
      .execute();
    const saved = await trx
      .selectFrom('app.travelResidences as r')
      .innerJoin('app.travelPlaces as p', 'p.id', 'r.placeId')
      .select([
        'r.id',
        'r.legacyId',
        'r.placeId',
        'p.place',
        'p.country',
        'r.periods',
        'r.notes',
        'r.createdAt',
        'r.updatedAt',
      ])
      .where('r.ownerUserid', '=', owner)
      .where('r.id', '=', row!.id)
      .executeTakeFirstOrThrow();
    return decode(saved);
  });
}

export async function updateTravelResidence(
  owner: string,
  input: {
    id: string;
    periods?: {
      startDate: string;
      endDate: string | null;
      ongoing: boolean;
      precision: 'day' | 'month' | 'year';
      note?: string | null;
    }[];
    notes?: string | null;
    dryRun?: boolean;
    ifUpdatedAt?: string;
  },
) {
  return runInTransaction(async (trx) => {
    const currentRow = await trx
      .selectFrom('app.travelResidences as r')
      .innerJoin('app.travelPlaces as p', 'p.id', 'r.placeId')
      .select([
        'r.id',
        'r.legacyId',
        'r.placeId',
        'p.place',
        'p.country',
        'r.periods',
        'r.notes',
        'r.createdAt',
        'r.updatedAt',
      ])
      .where('r.ownerUserid', '=', owner)
      .where('r.id', '=', input.id)
      .forUpdate()
      .executeTakeFirst();
    const current = currentRow ? decode(currentRow) : null;
    if (!current) return null;
    if (
      input.ifUpdatedAt &&
      Date.parse(String(current.updatedAt)) !== Date.parse(input.ifUpdatedAt)
    )
      throw new ValidationError('version_conflict');
    if (input.periods) {
      validatePeriods(input.periods);
      await ensureSingleCurrent(trx, owner, input.periods, input.id);
    }
    const periods = input.periods ?? current.periods;
    const notes = input.notes !== undefined ? input.notes : current.notes;
    if (
      input.dryRun ||
      (JSON.stringify(periods) === JSON.stringify(current.periods) && notes === current.notes)
    )
      return { ...current, periods, notes };
    let update = trx
      .updateTable('app.travelResidences')
      .set({
        ...(input.periods ? { periods: JSON.stringify(input.periods) } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      })
      .where('id', '=', input.id)
      .where('ownerUserid', '=', owner);
    if (input.ifUpdatedAt) update = update.where('updatedAt', '=', input.ifUpdatedAt);
    const result = await update.returning('id').execute();
    if (!result.length) throw new ValidationError('version_conflict');
    const saved = await trx
      .selectFrom('app.travelResidences as r')
      .innerJoin('app.travelPlaces as p', 'p.id', 'r.placeId')
      .select([
        'r.id',
        'r.legacyId',
        'r.placeId',
        'p.place',
        'p.country',
        'r.periods',
        'r.notes',
        'r.createdAt',
        'r.updatedAt',
      ])
      .where('r.ownerUserid', '=', owner)
      .where('r.id', '=', input.id)
      .executeTakeFirstOrThrow();
    return decode(saved);
  });
}

export async function deleteTravelResidence(
  owner: string,
  input: string | { id: string; ifUpdatedAt?: string; dryRun?: boolean },
) {
  const id = typeof input === 'string' ? input : input.id;
  return runInTransaction(async (trx) => {
    const rawRow = await trx
      .selectFrom('app.travelResidences as r')
      .innerJoin('app.travelPlaces as p', 'p.id', 'r.placeId')
      .select([
        'r.id',
        'r.legacyId',
        'r.placeId',
        'p.place',
        'p.country',
        'r.periods',
        'r.notes',
        'r.createdAt',
        'r.updatedAt',
      ])
      .where('r.ownerUserid', '=', owner)
      .where('r.id', '=', id)
      .forUpdate()
      .executeTakeFirst();
    const row = rawRow ? decode(rawRow) : null;
    if (!row) return null;
    if (
      typeof input !== 'string' &&
      input.ifUpdatedAt &&
      Date.parse(String(row.updatedAt)) !== Date.parse(input.ifUpdatedAt)
    )
      throw new ValidationError('version_conflict');
    if (typeof input !== 'string' && input.dryRun) return row;
    let deletion = trx
      .deleteFrom('app.travelResidences')
      .where('id', '=', id)
      .where('ownerUserid', '=', owner);
    if (typeof input !== 'string' && input.ifUpdatedAt)
      deletion = deletion.where('updatedAt', '=', input.ifUpdatedAt);
    const result = await deletion.returning('id').execute();
    if (!result.length) throw new ValidationError('version_conflict');
    return row;
  });
}
