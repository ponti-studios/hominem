import { randomUUID } from 'node:crypto';

import { authDb, db, sql } from '@hominem/db/core';
import { afterEach, describe, expect, it } from 'vitest';

import { createPlaceResidence, deletePlaceResidence } from './place-residences.service';
import { travelEntityHistory } from './travel-history-export.service';

describe('travel entity history', () => {
  const owners: string[] = [];

  afterEach(async () => {
    for (const owner of owners.splice(0))
      await authDb.deleteFrom('user').where('id', '=', owner).execute();
  });

  it('combines legacy and canonical residence history, including deleted period snapshots', async () => {
    const owner = randomUUID();
    owners.push(owner);
    await authDb
      .insertInto('user')
      .values({ id: owner, name: 'History probe', email: `${owner}@example.test` })
      .execute();
    const place = await db
      .insertInto('app.places')
      .values({ ownerUserid: owner, name: 'History probe place', country: null })
      .returning('id')
      .executeTakeFirstOrThrow();
    const created = await createPlaceResidence(owner, {
      placeId: place.id,
      periods: [
        {
          startDate: '2001-01-01',
          endDate: '2002-01-01',
          ongoing: false,
          precision: 'day',
        },
      ],
    });
    if (!created.residence) throw new Error('Expected residence');
    const period = await db
      .selectFrom('app.placeResidencePeriods')
      .select('id')
      .where('residenceId', '=', created.residence.id)
      .executeTakeFirstOrThrow();

    await sql`
      INSERT INTO app.travel_entity_history
        (owner_userid, entity_table, entity_id, operation, changed_fields, snapshot)
      VALUES (${owner}, 'travel_residences', ${created.residence.id}, 'update', '{}',
        ${JSON.stringify({ id: created.residence.id, notes: 'legacy event' })}::jsonb)
    `.execute(db);
    await deletePlaceResidence(owner, { id: created.residence.id });

    const history = await travelEntityHistory(owner, {
      entityType: 'residence',
      id: created.residence.id,
      limit: 100,
    });
    const snapshots = history.history.flatMap(({ snapshot }) =>
      snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? [snapshot] : [],
    );
    expect(snapshots).toContainEqual(expect.objectContaining({ notes: 'legacy event' }));
    expect(snapshots).toContainEqual(expect.objectContaining({ id: period.id }));
    expect(history.count).toBeGreaterThanOrEqual(4);
  });
});
