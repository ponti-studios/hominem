import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db, sql } from '../../db';

describe('travel v2 schema', () => {
  const userIds: string[] = [];
  afterEach(async () => {
    for (const userId of userIds.splice(0)) {
      await authDb.deleteFrom('user').where('id', '=', userId).execute();
    }
  });

  async function createUser() {
    const id = randomUUID();
    userIds.push(id);
    await authDb
      .insertInto('user')
      .values({ id, name: 'Travel test', email: `${id}@example.com` })
      .execute();
    return id;
  }

  it('keeps legacy tables separate and creates the stop table under its approved name', async () => {
    const result = await sql<{ tableName: string }>`
      SELECT table_name AS "tableName" FROM information_schema.tables
      WHERE table_schema = 'app' AND table_name = ANY(${[
        'travel_trips',
        'travel_segments',
        'travel_trip_attendees',
        'travel_journeys',
        'travel_journey_segments',
        'travel_places',
        'travel_transport',
        'travel_stays',
        'travel_airports',
        'travel_ideas',
        'travel_residences',
        'travel_entity_history',
      ]}) ORDER BY table_name
    `.execute(db);
    expect(result.rows.map(({ tableName }) => tableName)).toEqual([
      'travel_airports',
      'travel_entity_history',
      'travel_ideas',
      'travel_journey_segments',
      'travel_journeys',
      'travel_places',
      'travel_residences',
      'travel_segments',
      'travel_stays',
      'travel_transport',
      'travel_trip_attendees',
      'travel_trips',
    ]);
  });

  it('enforces owner-consistent parent relationships, sequence uniqueness, and date ordering', async () => {
    const owner = await createUser();
    const otherOwner = await createUser();
    const journey = await db
      .insertInto('app.travelJourneys')
      .values({
        ownerUserid: owner,
        legacyId: 'JRN-test',
        name: 'Test',
        startDate: null,
        endDate: null,
        purpose: null,
        notes: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const place = await db
      .insertInto('app.travelPlaces')
      .values({
        ownerUserid: owner,
        legacyId: 'PLC-test',
        place: 'Test City',
        country: 'Testland',
        type: 'city',
        status: 'Visited',
        firstVisited: null,
        lastVisited: null,
        notes: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await expect(
      db
        .insertInto('app.travelJourneySegments')
        .values({
          ownerUserid: owner,
          legacyId: 'SEG-1',
          journeyId: journey.id,
          seq: 1,
          placeId: place.id,
          arrivalDate: '2026-10-10',
          departureDate: '2026-10-01',
          notes: null,
        })
        .execute(),
    ).rejects.toThrow();
    await db
      .insertInto('app.travelJourneySegments')
      .values({
        ownerUserid: owner,
        legacyId: 'SEG-1',
        journeyId: journey.id,
        seq: 1,
        placeId: place.id,
        arrivalDate: null,
        departureDate: null,
        notes: null,
      })
      .execute();
    await expect(
      db
        .insertInto('app.travelJourneySegments')
        .values({
          ownerUserid: owner,
          legacyId: 'SEG-2',
          journeyId: journey.id,
          seq: 1,
          placeId: place.id,
          arrivalDate: null,
          departureDate: null,
          notes: null,
        })
        .execute(),
    ).rejects.toThrow();
    await expect(
      db
        .insertInto('app.travelJourneySegments')
        .values({
          ownerUserid: otherOwner,
          legacyId: 'SEG-other',
          journeyId: journey.id,
          seq: 2,
          placeId: place.id,
          arrivalDate: null,
          departureDate: null,
          notes: null,
        })
        .execute(),
    ).rejects.toThrow();
  });

  it('retains create, update, and delete snapshots independently of the entity row', async () => {
    const owner = await createUser();
    const idea = await db
      .insertInto('app.travelIdeas')
      .values({
        ownerUserid: owner,
        legacyId: 'IDA-test',
        idea: 'First',
        type: 'experience',
        status: 'open',
        notes: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .updateTable('app.travelIdeas')
      .set({ idea: 'Updated' })
      .where('id', '=', idea.id)
      .execute();
    await db.deleteFrom('app.travelIdeas').where('id', '=', idea.id).execute();

    const history = await db
      .selectFrom('app.travelEntityHistory')
      .select(['operation', 'changedFields', 'snapshot'])
      .where('entityId', '=', idea.id)
      .orderBy('createdAt')
      .execute();
    expect(history.map(({ operation }) => operation)).toEqual(['create', 'update', 'delete']);
    expect(history[1]?.changedFields).toMatchObject({ idea: 'Updated' });
    expect(history[2]?.snapshot).toMatchObject({ idea: 'Updated' });
    expect(
      await db.selectFrom('app.travelIdeas').select('id').where('id', '=', idea.id).execute(),
    ).toHaveLength(0);
    await expect(
      db.deleteFrom('app.travelEntityHistory').where('entityId', '=', idea.id).execute(),
    ).rejects.toThrow('append-only');
  });

  it('skips cascade audit writes when one statement deletes multiple travel owners', async () => {
    const owners = [await createUser(), await createUser()];
    await db
      .insertInto('app.travelIdeas')
      .values(
        owners.map((owner, index) => ({
          ownerUserid: owner,
          legacyId: `IDA-multi-delete-${index}`,
          idea: 'Cascade test',
          type: 'experience',
          status: 'open',
        })),
      )
      .execute();

    await expect(
      authDb.deleteFrom('user').where('id', 'in', owners).execute(),
    ).resolves.toBeDefined();
    await expect(
      db.selectFrom('app.travelIdeas').select('id').where('ownerUserid', 'in', owners).execute(),
    ).resolves.toEqual([]);
  });

  it('allows only fully linked stays or unlinked wishlist stays', async () => {
    const owner = await createUser();
    const journey = await db
      .insertInto('app.travelJourneys')
      .values({ ownerUserid: owner, legacyId: 'JRN-stay', name: 'Stay', purpose: null })
      .returning('id')
      .executeTakeFirstOrThrow();
    const place = await db
      .insertInto('app.travelPlaces')
      .values({
        ownerUserid: owner,
        legacyId: 'PLC-stay',
        place: 'Stay City',
        country: 'Testland',
        type: 'city',
        status: 'Visited',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const segment = await db
      .insertInto('app.travelJourneySegments')
      .values({
        ownerUserid: owner,
        legacyId: 'SEG-stay',
        journeyId: journey.id,
        seq: 1,
        placeId: place.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const base = {
      ownerUserid: owner,
      city: 'Stay City',
      legacyId: 'STY-test',
      checkIn: null,
      checkOut: null,
      country: null,
      property: null,
      bookingRef: null,
      notes: null,
    };

    await db
      .insertInto('app.travelStays')
      .values({ ...base, legacyId: 'STY-wish', evidence: 'want', segmentId: null, journeyId: null })
      .execute();
    await expect(
      db
        .insertInto('app.travelStays')
        .values({
          ...base,
          legacyId: 'STY-partial',
          evidence: 'want',
          segmentId: segment.id,
          journeyId: null,
        })
        .execute(),
    ).rejects.toThrow();
    await expect(
      db
        .insertInto('app.travelStays')
        .values({
          ...base,
          legacyId: 'STY-unlinked',
          evidence: 'email',
          segmentId: null,
          journeyId: null,
        })
        .execute(),
    ).rejects.toThrow();
  });

  it('stores Residence periods under canonical Places and audits them', async () => {
    const owner = await createUser();
    const place = await db
      .insertInto('app.travelPlaces')
      .values({
        ownerUserid: owner,
        legacyId: 'PLC-residence',
        place: 'Residence City',
        country: 'Testland',
        type: 'city',
        status: 'Visited',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const periods = [
      {
        startDate: '2016-01-01',
        endDate: null,
        ongoing: false,
        precision: 'day',
        note: 'ended, exact end unrecorded',
      },
    ];
    const residenceId = randomUUID();

    await sql`
      INSERT INTO app.travel_residences (id, owner_userid, legacy_id, place_id, periods)
      VALUES (${residenceId}, ${owner}, 'PLC-residence-row', ${place.id}, ${JSON.stringify(periods)}::jsonb)
    `.execute(db);
    await expect(
      sql`
        INSERT INTO app.travel_residences (owner_userid, legacy_id, place_id, periods)
        VALUES (${owner}, 'PLC-empty-periods', ${place.id}, '[]'::jsonb)
      `.execute(db),
    ).rejects.toThrow();
    await expect(
      sql`
        INSERT INTO app.travel_residences (owner_userid, legacy_id, place_id, periods)
        VALUES (${owner}, 'PLC-residence-row', ${place.id}, ${JSON.stringify(periods)}::jsonb)
      `.execute(db),
    ).rejects.toThrow();

    const residence = await sql<{ periods: unknown }>`
      SELECT periods FROM app.travel_residences WHERE id = ${residenceId}
    `.execute(db);
    expect(residence.rows[0]?.periods).toEqual(periods);
    const history = await sql<{ operation: string; entityTable: string }>`
      SELECT operation, entity_table AS "entityTable" FROM app.travel_entity_history
      WHERE entity_id = ${residenceId}
    `.execute(db);
    expect(history.rows).toEqual([{ operation: 'create', entityTable: 'travel_residences' }]);
  });
});
