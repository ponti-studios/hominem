import { db } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';

import { travelResidencePeriodsSchema } from '../schemas/travel-residences.schema';

const residenceQuery = () =>
  db
    .selectFrom('app.travelResidences as r')
    .innerJoin('app.travelPlaces as p', 'p.id', 'r.placeId')
    .select(['r.id', 'r.legacyId', 'r.placeId', 'p.place', 'p.country', 'r.periods', 'r.notes']);

const decode = <T extends { periods: unknown }>(row: T) => ({
  ...row,
  periods: travelResidencePeriodsSchema.parse(
    typeof row.periods === 'string' ? JSON.parse(row.periods) : row.periods,
  ),
});

export async function listTravelResidences(
  owner: string,
  input: { placeId?: string; place?: string; current?: boolean },
) {
  const rows = await residenceQuery()
    .where('r.ownerUserid', '=', owner)
    .$if(Boolean(input.placeId), (q) => q.where('r.placeId', '=', input.placeId!))
    .$if(Boolean(input.place), (q) => q.where('p.place', 'ilike', input.place!))
    .orderBy('p.place')
    .execute();
  return rows
    .filter(
      (row) =>
        input.current === undefined || decode(row).periods.some((p) => p.ongoing) === input.current,
    )
    .map(decode);
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
}

async function ensureSingleCurrent(
  owner: string,
  periods: { ongoing: boolean }[],
  exceptId?: string,
) {
  if (!periods.some((p) => p.ongoing)) return;
  const residences = await db
    .selectFrom('app.travelResidences')
    .select(['id', 'periods'])
    .where('ownerUserid', '=', owner)
    .execute();
  if (
    residences.some(
      (row) => row.id !== exceptId && decode(row).periods.some((period) => period.ongoing),
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
      precision: string;
      note?: string | null;
    }[];
    notes?: string | null;
  },
) {
  validatePeriods(input.periods);
  const place = await db
    .selectFrom('app.travelPlaces')
    .select('id')
    .where('id', '=', input.placeId)
    .where('ownerUserid', '=', owner)
    .executeTakeFirst();
  if (!place) throw new ValidationError('unknown_place');
  if (input.legacyId) {
    const existing = await getTravelResidence(owner, { legacyId: input.legacyId });
    if (existing) return existing;
  }
  await ensureSingleCurrent(owner, input.periods);
  const [row] = await db
    .insertInto('app.travelResidences')
    .values({
      ownerUserid: owner,
      placeId: input.placeId,
      legacyId: input.legacyId ?? crypto.randomUUID(),
      periods: JSON.stringify(input.periods),
      notes: input.notes ?? null,
    })
    .returning('id')
    .execute();
  return getTravelResidence(owner, { id: row!.id });
}

export async function updateTravelResidence(
  owner: string,
  input: {
    id: string;
    periods?: {
      startDate: string;
      endDate: string | null;
      ongoing: boolean;
      precision: string;
      note?: string | null;
    }[];
    notes?: string | null;
  },
) {
  if (input.periods) {
    validatePeriods(input.periods);
    await ensureSingleCurrent(owner, input.periods, input.id);
  }
  await db
    .updateTable('app.travelResidences')
    .set({
      ...(input.periods ? { periods: JSON.stringify(input.periods) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    })
    .where('id', '=', input.id)
    .where('ownerUserid', '=', owner)
    .execute();
  return getTravelResidence(owner, { id: input.id });
}

export async function deleteTravelResidence(owner: string, id: string) {
  const row = await getTravelResidence(owner, { id });
  if (!row) return null;
  await db
    .deleteFrom('app.travelResidences')
    .where('id', '=', id)
    .where('ownerUserid', '=', owner)
    .execute();
  return row;
}
