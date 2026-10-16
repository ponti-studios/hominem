import { db } from '@hominem/db/core';

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
