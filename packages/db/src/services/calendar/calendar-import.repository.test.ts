import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';
import { afterEach, describe, expect, it } from 'vitest';

import { authDb, db } from '../../db';
import { CalendarImportRepository } from './calendar-import.repository';

const runIntegration = process.env.NODE_ENV === 'test' ? describe : describe.skip;

runIntegration('CalendarImportRepository', () => {
  const userIds: string[] = [];

  afterEach(async () => {
    for (const userId of userIds.splice(0)) {
      await db.deleteFrom('app.importSources').where('ownerUserid', '=', userId).execute();
      await authDb.deleteFrom('user').where('id', '=', userId).execute();
    }
  });

  it('imports recurring occurrences once and preserves immutable provenance on retry', async () => {
    const userId = randomUUID();
    userIds.push(userId);
    await authDb
      .insertInto('user')
      .values({ id: userId, name: 'Calendar Test User', email: `${userId}@example.com` })
      .execute();

    const input = {
      provider: 'apple',
      sourceExternalAccountId: 'calendar-primary',
      sourceDisplayName: 'Primary Calendar',
      inputObjectKey: 'imports/apple/primary.ics',
      inputChecksum: 'fixture-checksum',
      occurrences: [
        {
          calendarUid: 'weekly-project-sync',
          occurrenceKey: '2026-07-14T16:00:00.000Z',
          title: 'Project sync',
          description: 'Weekly planning session',
          location: 'Studio',
          startsAt: '2026-07-14T16:00:00.000Z',
          endsAt: '2026-07-14T17:00:00.000Z',
          isAllDay: false,
          isCancelled: false,
          contentHash: 'occurrence-1',
        },
        {
          calendarUid: 'weekly-project-sync',
          occurrenceKey: '2026-07-21T16:00:00.000Z',
          title: 'Project sync',
          startsAt: '2026-07-21T16:00:00.000Z',
          endsAt: '2026-07-21T17:00:00.000Z',
          isAllDay: false,
          isCancelled: true,
          contentHash: 'occurrence-2',
        },
      ],
    };

    const firstImport = await CalendarImportRepository.importOccurrences(userId, input);
    const secondImport = await CalendarImportRepository.importOccurrences(userId, input);

    expect(firstImport.run).toMatchObject({
      status: 'completed',
      recordsRead: 2,
      recordsImported: 2,
    });
    expect(secondImport.occurrences.map((occurrence) => occurrence.id)).toEqual(
      firstImport.occurrences.map((occurrence) => occurrence.id),
    );

    const events = await db
      .selectFrom('app.events')
      .selectAll()
      .where('ownerUserid', '=', userId)
      .execute();
    const occurrences = await db
      .selectFrom('app.eventOccurrences')
      .selectAll()
      .where('eventId', '=', events[0]?.id ?? '')
      .orderBy('occurrenceKey')
      .execute();
    const sources = await db
      .selectFrom('app.calendarEventSources')
      .selectAll()
      .where('eventId', '=', events[0]?.id ?? '')
      .execute();
    const importRecords = await db
      .selectFrom('app.importRecords')
      .selectAll()
      .where('sourceId', '=', firstImport.run.sourceId)
      .execute();
    const mappings = await db
      .selectFrom('app.entitySourceRecords')
      .selectAll()
      .where(sql<boolean>`canonical_entity_table = 'app.event_occurrences'::regclass`)
      .execute();

    expect(events).toHaveLength(1);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.calendarUid).toBe('weekly-project-sync');
    expect(occurrences).toHaveLength(2);
    expect(occurrences.map((occurrence) => occurrence.status)).toEqual(['confirmed', 'cancelled']);
    expect(importRecords).toHaveLength(2);
    expect(
      mappings.filter((mapping) => mapping.canonicalEntityId === occurrences[0]?.id),
    ).toHaveLength(1);
    expect(
      mappings.filter((mapping) => mapping.canonicalEntityId === occurrences[1]?.id),
    ).toHaveLength(1);
  });
});
