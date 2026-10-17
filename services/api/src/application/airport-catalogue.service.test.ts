import { randomInt } from 'node:crypto';

import { authDb, db, sql } from '@hominem/db/core';
import { afterAll, describe, expect, it } from 'vitest';

import {
  getTravelAirport,
  syncAirportCatalogue,
  updateTravelAirportCuration,
} from './airport-catalogue.service';

describe('OurAirports reference refresh', () => {
  const base = 8_000_000_000_000 + randomInt(1_000_000);
  const runIds: string[] = [];
  const makeFeed = (changed = false) => {
    const records = Array.from({ length: 1000 }, (_, index) => {
      const id = base + index;
      const name =
        changed && index === 0 ? 'Updated source airport' : `OurAirports probe ${base} ${index}`;
      return `${id},P${id},small_airport,${name},${index / 100},${index / 100},ZZ,Probe,no,P${id},,L${id},2026-10-16T00:00:00Z`;
    });
    if (changed)
      records.push(
        `${base + 1000},P${base + 1000},small_airport,New source airport,1,2,ZZ,Probe,no,P${base + 1000},,L${base + 1000},2026-10-16T00:00:00Z`,
      );
    return `id,ident,type,name,latitude_deg,longitude_deg,iso_country,municipality,scheduled_service,gps_code,iata_code,local_code,last_updated\n${records.join('\n')}`;
  };
  const fetchFeed =
    (changed = false) =>
    async () =>
      new Response(makeFeed(changed), {
        headers: { 'last-modified': 'Fri, 16 Oct 2026 00:00:00 GMT' },
      });

  afterAll(async () => {
    await sql`UPDATE app.travel_airport_reference SET active=false,missing_from_source=true
      WHERE source_id BETWEEN ${base} AND ${base + 1000}`.execute(db);
    if (runIds.length)
      await sql`DELETE FROM app.travel_airport_reference_refresh_log WHERE id = ANY(${runIds}::uuid[])`.execute(
        db,
      );
  });

  it('records a failed OurAirports download without mutating the reference dataset', async () => {
    await expect(
      syncAirportCatalogue(async () => new Response(null, { status: 503 })),
    ).rejects.toThrow('airport_catalogue_download_failed:503');
    const failed = await sql<{ id: string; status: string; source_name: string; error: string }>`
      SELECT id,status,source_name,error FROM app.travel_airport_reference_refresh_log
      WHERE status='failed' AND error='airport_catalogue_download_failed:503'
      ORDER BY started_at DESC LIMIT 1`.execute(db);
    const row = failed.rows[0]!;
    runIds.push(row.id);
    expect(row).toMatchObject({ status: 'failed', error: 'airport_catalogue_download_failed:503' });
  });

  it('atomically upserts OurAirports rows and converges on replay', async () => {
    const initial = await syncAirportCatalogue(fetchFeed(), { deactivateMissing: false });
    runIds.push(initial.runId);
    expect(initial).toMatchObject({ seen: 1000, inserted: 1000, updated: 0, deactivated: 0 });

    const replay = await syncAirportCatalogue(fetchFeed(), { deactivateMissing: false });
    runIds.push(replay.runId);
    expect(replay).toMatchObject({ seen: 1000, inserted: 0, updated: 0, deactivated: 0 });

    const changed = await syncAirportCatalogue(fetchFeed(true), { deactivateMissing: false });
    runIds.push(changed.runId);
    expect(changed).toMatchObject({ seen: 1001, inserted: 1, updated: 1, deactivated: 0 });
    const updated = await sql<{ name: string; missing_from_source: boolean }>`
      SELECT name,missing_from_source FROM app.travel_airport_reference WHERE source_id=${base}`.execute(
      db,
    );
    expect(updated.rows[0]).toEqual({ name: 'Updated source airport', missingFromSource: false });
  });

  it('curates a reference endpoint, pins drift, and preserves empty-reference stations', async () => {
    const owner = `airport-curation-${base}`;
    const sourceId = base + 1001;
    const code = `P${sourceId}`;
    await authDb
      .insertInto('user')
      .values({ id: owner, name: 'Airport curation test', email: `${owner}@example.com` })
      .execute();
    try {
      await db
        .insertInto('app.travelAirportReference')
        .values({
          sourceId,
          code,
          name: 'Pinned airport',
          city: 'Pinned city',
          country: 'ZZ',
          type: 'large_airport',
        })
        .execute();
      const reference = await db
        .selectFrom('app.travelAirportReference')
        .select('id')
        .where('sourceId', '=', String(sourceId))
        .executeTakeFirstOrThrow();
      const place = await db
        .insertInto('app.places')
        .values({
          ownerUserid: owner,
          name: 'Pinned place',
          country: 'ZZ',
          placeType: 'city',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await db
        .insertInto('app.travelAirports')
        .values({
          ownerUserid: owner,
          code,
          referenceAirportId: reference.id,
          servesPlace: null,
          notes: null,
          latitude: null,
          longitude: null,
          standalone: false,
        })
        .execute();
      await updateTravelAirportCuration(owner, { code, servesPlace: 'Pinned place', latitude: 1 });
      await expect(
        updateTravelAirportCuration(owner, { code, servesPlace: 'Unknown place' }),
      ).rejects.toThrow('unknown_place');

      await db
        .updateTable('app.travelAirportReference')
        .set({ name: 'Drifted name', city: 'Drifted city', latitude: 2 })
        .where('id', '=', reference.id)
        .execute();
      const pinned = await getTravelAirport(owner, code);
      expect(pinned).toMatchObject({
        name: 'Pinned airport',
        city: 'Pinned city',
        servesPlace: 'Pinned place',
        latitude: 1,
      });
      const drift = await sql<{ driftEntries: Array<{ field: string }> }>`
        SELECT drift_entries AS "driftEntries" FROM app.travel_airport_reference_refresh_log
        WHERE drift_entries @> ${JSON.stringify([{ code, field: 'name' }])}::jsonb
        ORDER BY started_at DESC LIMIT 1`.execute(db);
      expect(drift.rows[0]?.driftEntries.map(({ field }) => field)).toContain('name');

      await db.deleteFrom('app.travelAirportReference').where('id', '=', reference.id).execute();
      await expect(
        db
          .selectFrom('app.travelAirportReference')
          .select('id')
          .where('id', '=', reference.id)
          .execute(),
      ).resolves.toHaveLength(1);

      const station = await updateTravelAirportCuration(owner, {
        code: 'NYP',
        name: 'New York Penn Station',
        city: 'New York',
        country: 'US',
        latitude: 40.75033,
        longitude: -73.99396,
        notes: 'rail station',
      });
      expect(station).toMatchObject({ code: 'NYP', standalone: true, inReference: false });
      expect(place.id).toBeTruthy();
    } finally {
      await authDb.deleteFrom('user').where('id', '=', owner).execute();
      await sql`DELETE FROM app.travel_airport_reference WHERE source_id=${sourceId}`.execute(db);
    }
  });
});
