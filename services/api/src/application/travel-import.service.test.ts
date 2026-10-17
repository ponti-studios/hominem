import { randomUUID } from 'node:crypto';

import { authDb, db } from '@hominem/db/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { travelImportInputSchema } from '../schemas/travel-import.schema';
import { travelExport } from './travel-history-export.service';
import { importTravelRows } from './travel-import.service';

describe('travel import', () => {
  const owners: string[] = [];
  beforeAll(async () => {
    await db
      .insertInto('app.travelAirportReference')
      .values([
        {
          sourceId: 981001,
          code: 'AAA',
          name: 'Alpha',
          city: 'Alpha City',
          country: 'ZZ',
          type: 'small_airport',
          latitude: 1,
          longitude: 2,
        },
        {
          sourceId: 981002,
          code: 'BBB',
          name: 'Beta',
          city: 'Beta City',
          country: 'ZZ',
          type: 'small_airport',
          latitude: 3,
          longitude: 4,
        },
      ])
      .onConflict((conflict) => conflict.column('sourceId').doNothing())
      .execute();
  });
  afterAll(async () => {
    await db
      .deleteFrom('app.travelAirportReference')
      .where('sourceId', 'in', ['981001', '981002'])
      .execute();
  });
  afterEach(async () => {
    for (const owner of owners.splice(0)) {
      await authDb.deleteFrom('user').where('id', '=', owner).execute();
    }
  });

  async function createOwner() {
    const owner = randomUUID();
    owners.push(owner);
    await authDb
      .insertInto('user')
      .values({ id: owner, name: 'Travel import test', email: `${owner}@example.com` })
      .execute();
    return owner;
  }

  function sampleRows(): z.infer<typeof travelImportInputSchema>['rows'] {
    return {
      airports: [
        {
          airport_id: 'ARP-001',
          code: 'AAA',
          name: 'Alpha',
          serves_place: 'Alpha City',
          city: 'Alpha City',
          country: 'Testland',
          latitude: '1',
          longitude: '2',
          notes: '',
        },
        {
          airport_id: 'ARP-002',
          code: 'BBB',
          name: 'Beta',
          serves_place: 'Beta City',
          city: 'Beta City',
          country: 'Testland',
          latitude: '3',
          longitude: '4',
          notes: '',
        },
      ],
      places: [
        {
          place_id: 'PLC-001',
          place: 'Alpha City',
          country: 'Testland',
          type: 'city',
          status: 'Want to go',
          first_visited: '',
          last_visited: '',
          notes: '',
        },
      ],
      residences: [],
      journeys: [
        {
          journey_id: 'JRN-001',
          name: 'Test Journey',
          start_date: '2026-10-01',
          end_date: '2026-10-02',
          purpose: 'leisure',
          segments: 'Alpha City',
          notes: '',
        },
      ],
      segments: [
        {
          segment_id: 'SEG-001',
          journey_id: 'JRN-001',
          seq: '1',
          place: 'Alpha City',
          arrival_date: '2026-10-01',
          departure_date: '2026-10-02',
          destinations: 'Alpha City',
          notes: '',
        },
      ],
      transport: [
        {
          transport_id: 'T-001',
          date: '2026-10-01',
          mode: 'air',
          origin: 'AAA',
          destination: 'BBB',
          carrier: 'Test Air',
          number: 'TA1',
          booking_ref: 'BOOK1',
          dep_segment: '',
          arr_segment: 'SEG-001',
          journey_id: 'JRN-001',
          legacy_trip: '',
          notes: '',
        },
      ],
      stays: [
        {
          stay_id: 'STY-001',
          segment_id: 'SEG-001',
          journey_id: 'JRN-001',
          check_in: '2026-10-01',
          check_out: '2026-10-02',
          city: 'Alpha City',
          country: 'Testland',
          property: 'Test Hotel',
          booking_ref: 'HOTEL1',
          evidence: 'email',
          notes: '',
        },
      ],
      ideas: [
        { idea_id: 'IDA-001', idea: 'Visit Alpha', type: 'experience', status: 'open', notes: '' },
      ],
    };
  }

  it('projects the same per-entity create counters without writing any rows', async () => {
    const owner = await createOwner();
    const result = await importTravelRows(owner, {
      rows: sampleRows(),
      mode: 'append',
      dryRun: true,
    });

    expect(result.entities).toMatchObject({
      airports: { created: 2, updated: 0, unchanged: 0, rejected: [] },
      places: { created: 1, updated: 0, unchanged: 0, rejected: [] },
      journeys: { created: 1, updated: 0, unchanged: 0, rejected: [] },
      segments: { created: 1, updated: 0, unchanged: 0, rejected: [] },
      transport: { created: 1, updated: 0, unchanged: 0, rejected: [] },
      stays: { created: 1, updated: 0, unchanged: 0, rejected: [] },
      ideas: { created: 1, updated: 0, unchanged: 0, rejected: [] },
    });
    expect(result.droppedColumns).toEqual(['journeys.segments', 'segments.destinations']);
    const count = await db
      .selectFrom('app.travelJourneys')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('ownerUserid', '=', owner)
      .executeTakeFirstOrThrow();
    expect(Number(count.count)).toBe(0);
  });

  it('diverts lived-in places to residences attached to their canonical place', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.places.push({
      place_id: 'PLC-002',
      place: 'Alpha City',
      country: 'Testland',
      type: 'city',
      status: 'Lived in',
      first_visited: '',
      last_visited: '',
      notes: 'Home',
    });
    rows.residences = [
      {
        placeLegacyId: 'PLC-001',
        periods: [
          { startDate: '2016-01-01', endDate: null, ongoing: false, precision: 'day', note: null },
        ],
        sourceFirstVisited: null,
        sourceLastVisited: null,
        notes: 'Home',
      },
    ];

    const result = await importTravelRows(owner, { rows, mode: 'append', dryRun: false });
    const residence = await db
      .selectFrom('app.placeResidences')
      .selectAll()
      .where('ownerUserid', '=', owner)
      .executeTakeFirstOrThrow();

    expect(result.entities.places.created).toBe(1);
    expect(result.entities.residences).toMatchObject({ created: 1, rejected: [] });
    expect(result.residenceOnlyPlaces).toBe(0);
    expect(residence.placeId).toBe(
      (
        await db
          .selectFrom('app.places')
          .select('id')
          .where('ownerUserid', '=', owner)
          .where('name', '=', 'Alpha City')
          .executeTakeFirstOrThrow()
      ).id,
    );
    expect(
      await db
        .selectFrom('app.placeResidencePeriods')
        .select(['startDate', 'endDate', 'ongoing', 'precision', 'note'])
        .where('residenceId', '=', residence.id)
        .execute(),
    ).toEqual([
      { startDate: '2016-01-01', endDate: null, ongoing: false, precision: 'day', note: null },
    ]);
  });

  it('rejects a lived-in place if its authoritative residence record is missing', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.places.push({
      place_id: 'PLC-NO-RESIDENCE',
      place: 'Alpha City',
      country: 'Testland',
      type: 'city',
      status: 'Lived in',
      first_visited: '',
      last_visited: '',
      notes: '',
    });

    const result = await importTravelRows(owner, { rows, mode: 'append', dryRun: true });

    expect(result.entities.places.rejected).toEqual([
      { sourceId: 'PLC-NO-RESIDENCE', reason: 'missing_residence_record' },
    ]);
  });

  it('rejects a residence record that points to a different named place', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.residences = [
      {
        placeLegacyId: 'PLC-001',
        place: 'Other City',
        country: 'Testland',
        periods: [{ startDate: '2016-01-01', endDate: null, ongoing: false, precision: 'day' }],
      },
    ];

    const result = await importTravelRows(owner, { rows, mode: 'append', dryRun: true });

    expect(result.entities.residences.rejected).toEqual([
      { sourceId: '(missing)', reason: 'residence_place_mismatch' },
    ]);
  });

  it('keeps a lived-in place when it has no canonical peer and reports it', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.places = [{ ...rows.places[0]!, place_id: 'PLC-ONLY', status: 'Lived in' }];
    rows.residences = [
      {
        placeLegacyId: 'PLC-ONLY',
        periods: [
          { startDate: '2016-01-01', endDate: null, ongoing: false, precision: 'day', note: null },
        ],
        sourceFirstVisited: null,
        sourceLastVisited: null,
        notes: null,
      },
    ];

    const result = await importTravelRows(owner, { rows, mode: 'append', dryRun: false });

    expect(result.entities.places.created).toBe(1);
    expect(result.entities.residences.created).toBe(1);
    expect(result.residenceOnlyPlaces).toBe(1);
    const replay = await importTravelRows(owner, {
      ...travelImportInputSchema.parse(await travelExport(owner)),
      mode: 'append',
      dryRun: false,
    });
    expect(replay.entities.places).toMatchObject({
      created: 0,
      updated: 0,
      unchanged: 1,
      rejected: [],
    });
    expect(replay.entities.residences).toMatchObject({ created: 0, unchanged: 1, rejected: [] });
  });

  it('rejects an import that would create multiple current homes', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.residences = [
      {
        placeLegacyId: 'PLC-001',
        periods: [{ startDate: '2026-01-01', endDate: null, ongoing: true, precision: 'day' }],
        notes: null,
      },
      {
        placeLegacyId: 'PLC-001',
        periods: [{ startDate: '2026-02-01', endDate: null, ongoing: true, precision: 'day' }],
        notes: null,
      },
    ];

    const result = await importTravelRows(owner, { rows, mode: 'append', dryRun: true });

    expect(result.entities.residences).toMatchObject({
      created: 1,
      rejected: [{ reason: 'multiple_current_homes' }],
    });
  });

  it('imports unlinked wishlist stays while rejecting missing or partial links elsewhere', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.stays = [
      {
        ...rows.stays[0]!,
        stay_id: 'STY-WANT',
        segment_id: '',
        journey_id: '',
        evidence: 'want',
      },
      {
        ...rows.stays[0]!,
        stay_id: 'STY-MISSING',
        segment_id: '',
        journey_id: '',
        evidence: 'email',
      },
      {
        ...rows.stays[0]!,
        stay_id: 'STY-PARTIAL',
        segment_id: 'SEG-001',
        journey_id: '',
        evidence: 'want',
      },
    ];

    const result = await importTravelRows(owner, { rows, mode: 'append', dryRun: false });
    const wish = await db
      .selectFrom('app.travelStays')
      .select(['evidence', 'journeyId', 'segmentId'])
      .where('ownerUserid', '=', owner)
      .where('property', '=', 'Test Hotel')
      .executeTakeFirstOrThrow();

    expect(result.entities.stays).toMatchObject({
      created: 1,
      updated: 0,
      rejected: [{ reason: 'stay_links_required' }, { reason: 'stay_links_partial' }],
    });
    expect(wish).toEqual({ evidence: 'want', journeyId: null, segmentId: null });
  });

  it('imports in reference order, then converges on an identical append retry', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    const projected = await importTravelRows(owner, { rows, mode: 'append', dryRun: true });
    const applied = await importTravelRows(owner, { rows, mode: 'append', dryRun: false });
    const replay = await importTravelRows(
      owner,
      travelImportInputSchema.parse({ ...(await travelExport(owner)), mode: 'append' }),
    );

    expect(applied.entities).toEqual(projected.entities);
    expect(replay.entities).toEqual(
      Object.fromEntries(
        Object.entries(rows).map(([entity, entityRows]) => [
          entity,
          {
            created: 0,
            updated: 0,
            unchanged: entityRows.length,
            rejected: [],
          },
        ]),
      ),
    );
  });

  it('converges native export and import, including residence rows', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.residences = [
      {
        placeLegacyId: 'PLC-001',
        periods: [
          { startDate: '2020-01-01', endDate: '2021-01-01', ongoing: false, precision: 'day' },
        ],
        notes: 'probe',
      },
    ];
    await importTravelRows(owner, { rows, mode: 'append', dryRun: false });

    const native = await travelExport(owner);
    const nativeResult = await importTravelRows(
      owner,
      travelImportInputSchema.parse({ ...native, dryRun: true }),
    );
    expect(nativeResult.entities.places.created).toBe(0);
    expect(nativeResult.entities.residences.created).toBe(0);
    expect(nativeResult.entities.journeys.created).toBe(0);

    expect(native.entities.place_residences).toHaveLength(1);
    const exportedPeriods = native.entities.place_residences?.[0]?.periods as {
      id: string;
    }[];
    expect(exportedPeriods[0]?.id).toMatch(/^[0-9a-f-]{36}$/i);
    const replay = await importTravelRows(
      owner,
      travelImportInputSchema.parse({ ...native, mode: 'append' }),
    );
    const storedPeriods = await db
      .selectFrom('app.placeResidencePeriods')
      .select('app.placeResidencePeriods.id')
      .innerJoin(
        'app.placeResidences',
        'app.placeResidences.id',
        'app.placeResidencePeriods.residenceId',
      )
      .where('app.placeResidences.ownerUserid', '=', owner)
      .execute();
    expect(replay.entities.residences).toMatchObject({ created: 0, unchanged: 1, rejected: [] });
    expect(storedPeriods.map(({ id }) => id)).toEqual(exportedPeriods.map(({ id }) => id));
  });

  it('upserts sparse values, preserves archive state, and audits imported updates', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    await importTravelRows(owner, { rows, mode: 'append', dryRun: false });
    await db
      .updateTable('app.travelJourneys')
      .set({ archived: true })
      .where('ownerUserid', '=', owner)
      .where('name', '=', 'Test Journey')
      .execute();

    const updatedRows = sampleRows();
    updatedRows.journeys[0] = {
      ...updatedRows.journeys[0]!,
      start_date: '2026-10-01',
      end_date: '2026-10-02',
      purpose: '',
      notes: 'Updated from source',
    };
    const result = await importTravelRows(owner, {
      rows: updatedRows,
      mode: 'append',
      dryRun: false,
    });
    const journey = await db
      .selectFrom('app.travelJourneys')
      .select(['archived', 'endDate', 'id', 'notes', 'purpose', 'startDate'])
      .where('ownerUserid', '=', owner)
      .where('name', '=', 'Test Journey')
      .executeTakeFirstOrThrow();
    const history = await db
      .selectFrom('app.travelEntityHistory')
      .select(['changedFields', 'operation'])
      .where('ownerUserid', '=', owner)
      .where('entityId', '=', journey.id)
      .where('operation', '=', 'update')
      .execute();

    expect(result.entities.journeys).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
    expect(journey).toMatchObject({
      archived: true,
      endDate: '2026-10-02',
      notes: 'Updated from source',
      purpose: null,
      startDate: '2026-10-01',
    });
    expect(history).toHaveLength(2);
    expect(history).toContainEqual(
      expect.objectContaining({
        changedFields: expect.objectContaining({ notes: 'Updated from source' }),
      }),
    );
  });

  it('rejects only rows with unresolvable references and requires explicit replace confirmation', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.segments.push({
      segment_id: 'SEG-BAD',
      journey_id: 'JRN-001',
      seq: '2',
      place: 'Missing Place',
      arrival_date: '',
      departure_date: '',
      destinations: '',
      notes: '',
    });
    const result = await importTravelRows(owner, { rows, mode: 'append', dryRun: true });
    expect(result.entities.segments.rejected).toEqual([
      { sourceId: 'SEG-BAD', reason: 'unknown_place' },
    ]);
    await expect(importTravelRows(owner, { rows, mode: 'replace', dryRun: true })).rejects.toThrow(
      'confirmation_required',
    );
  });

  it('preserves distinct same-named Places within the import batch', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.places.push({
      ...rows.places[0]!,
      place_id: 'PLC-DUPLICATE',
      place: 'alpha city',
    });

    const result = await importTravelRows(owner, { rows, mode: 'append', dryRun: false });

    expect(result.entities.places).toMatchObject({
      created: 2,
      updated: 0,
      unchanged: 0,
      rejected: [],
    });
    await expect(
      db.selectFrom('app.travelJourneys').select('id').where('ownerUserid', '=', owner).execute(),
    ).resolves.toHaveLength(1);
    await expect(
      db.selectFrom('app.places').select('id').where('ownerUserid', '=', owner).execute(),
    ).resolves.toHaveLength(2);
  });

  it('projects replace counts without deleting existing rows during dry-run', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    await importTravelRows(owner, { rows, mode: 'append', dryRun: false });

    const result = await importTravelRows(owner, {
      rows: { ...rows, ideas: [] },
      mode: 'replace',
      dryRun: true,
      iUnderstand: true,
    });
    const ideas = await db
      .selectFrom('app.travelIdeas')
      .select('id')
      .where('ownerUserid', '=', owner)
      .execute();

    expect(result.preDeleteCounts?.ideas).toBe(1);
    expect(result.entities.ideas).toEqual({ created: 0, updated: 0, unchanged: 0, rejected: [] });
    expect(ideas).toHaveLength(1);
  });

  it('replaces atomically with a pre-delete snapshot and keeps deleted-row audit history', async () => {
    const owner = await createOwner();
    await importTravelRows(owner, { rows: sampleRows(), mode: 'append', dryRun: false });
    const replacementRows = sampleRows();
    replacementRows.ideas = [
      { idea_id: 'IDA-002', idea: 'Visit Beta', type: 'experience', status: 'open', notes: '' },
    ];

    const result = await importTravelRows(owner, {
      rows: replacementRows,
      mode: 'replace',
      dryRun: false,
      iUnderstand: true,
    });
    const ideas = await db
      .selectFrom('app.travelIdeas')
      .select('idea')
      .where('ownerUserid', '=', owner)
      .execute();
    const deletedIdeaHistory = await db
      .selectFrom('app.travelEntityHistory')
      .select('snapshot')
      .where('ownerUserid', '=', owner)
      .where('entityTable', '=', 'travel_ideas')
      .where('operation', '=', 'delete')
      .execute();

    expect(result.preDeleteCounts).toEqual({
      airports: 2,
      places: 1,
      residences: 0,
      journeys: 1,
      segments: 1,
      transport: 1,
      stays: 1,
      ideas: 1,
    });
    expect(result.entities.ideas).toMatchObject({ created: 1, updated: 0, unchanged: 0 });
    expect(ideas.map(({ idea }) => idea)).toEqual(['Visit Beta']);
    expect(deletedIdeaHistory).toContainEqual(
      expect.objectContaining({ snapshot: expect.objectContaining({}) }),
    );
  });

  it('keeps duplicate transport legacy ids distinct by the specified composite key', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.journeys.push({
      journey_id: 'JRN-002',
      name: 'Second Journey',
      start_date: '',
      end_date: '',
      purpose: '',
      segments: '',
      notes: '',
    });
    rows.transport.push({
      ...rows.transport[0]!,
      journey_id: 'JRN-002',
      date: '2026-10-03',
      origin: 'BBB',
      destination: 'AAA',
      dep_segment: '',
      arr_segment: '',
      booking_ref: 'BOOK2',
    });
    const result = await importTravelRows(owner, { rows, mode: 'append', dryRun: true });
    expect(result.entities.transport.created).toBe(2);
    expect(result.entities.transport.rejected).toEqual([]);
  });

  it('runs database constraint checks during dry-run and rolls the projection back', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.segments.push({ ...rows.segments[0]!, segment_id: 'SEG-002' });

    const preview = await importTravelRows(owner, { rows, mode: 'append', dryRun: true });
    expect(preview.entities.segments.rejected).toEqual([]);
    await expect(
      db.selectFrom('app.travelJourneys').select('id').where('ownerUserid', '=', owner).execute(),
    ).resolves.toEqual([]);
    const applied = await importTravelRows(owner, { rows, mode: 'append', dryRun: false });
    expect(applied.entities).toEqual(preview.entities);
  });

  it('validates residence periods with the shared contract and rejects multiple current periods', async () => {
    const owner = await createOwner();
    const rows = sampleRows();
    rows.residences = [
      {
        placeLegacyId: 'PLC-001',
        periods: [
          { startDate: '2026-01-02', endDate: '2026-01-01', ongoing: false, precision: 'day' },
        ],
        sourceFirstVisited: null,
        sourceLastVisited: null,
        notes: null,
      },
      {
        placeLegacyId: 'PLC-001',
        periods: [
          { startDate: '2020-01-01', endDate: null, ongoing: true, precision: 'day' },
          { startDate: '2021-01-01', endDate: null, ongoing: true, precision: 'day' },
        ],
        sourceFirstVisited: null,
        sourceLastVisited: null,
        notes: null,
      },
    ];

    const result = await importTravelRows(owner, { rows, mode: 'append', dryRun: false });
    expect(result.entities.residences.rejected).toEqual([
      { sourceId: '(missing)', reason: 'invalid_period' },
      { sourceId: '(missing)', reason: 'multiple_current_homes' },
    ]);
    await expect(
      db.selectFrom('app.placeResidences').select('id').where('ownerUserid', '=', owner).execute(),
    ).resolves.toEqual([]);
  });

  it('serializes imports per owner so concurrent runs cannot create two current homes', async () => {
    const owner = await createOwner();
    const makeRows = (suffix: string): z.infer<typeof travelImportInputSchema>['rows'] => {
      const rows = sampleRows();
      rows.places = [
        {
          place_id: `PLC-${suffix}`,
          place: `Home ${suffix}`,
          country: 'Testland',
          type: 'city',
          status: 'Visited',
          first_visited: '',
          last_visited: '',
          notes: '',
        },
      ];
      rows.residences = [
        {
          placeLegacyId: `PLC-${suffix}`,
          periods: [{ startDate: '2026-10-01', endDate: null, ongoing: true, precision: 'day' }],
          sourceFirstVisited: null,
          sourceLastVisited: null,
          notes: null,
        },
      ];
      return rows;
    };

    const results = await Promise.all([
      importTravelRows(owner, { rows: makeRows('A'), mode: 'append', dryRun: false }),
      importTravelRows(owner, { rows: makeRows('B'), mode: 'append', dryRun: false }),
    ]);
    const residenceResults = results.map((result) => result.entities.residences);
    expect(residenceResults.reduce((sum, result) => sum + result.created, 0)).toBe(1);
    expect(residenceResults.flatMap((result) => result.rejected)).toEqual([
      expect.objectContaining({ reason: 'multiple_current_homes' }),
    ]);
  });
});
