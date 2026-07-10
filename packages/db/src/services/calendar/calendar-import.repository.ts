import type { Insertable, Selectable } from 'kysely';

import { db } from '../../db';
import { ValidationError } from '../../errors';
import { runInTransaction } from '../../transaction';
import type { DbHandle } from '../../transaction';
import type {
  AppEventOccurrences,
  AppEvents,
  AppImportRecords,
  AppImportRuns,
  AppImportSources,
  JsonValue,
} from '../../types/database';

type EventRow = Selectable<AppEvents>;
type EventOccurrenceRow = Selectable<AppEventOccurrences>;
type ImportRecordRow = Selectable<AppImportRecords>;
type ImportRunRow = Selectable<AppImportRuns>;
type ImportSourceRow = Selectable<AppImportSources>;

export interface CalendarOccurrenceImportInput {
  calendarUid: string;
  occurrenceKey: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
  occurrenceDate?: string | null;
  isAllDay: boolean;
  isCancelled: boolean;
  externalVersion?: string | null;
  contentHash: string;
  rawObjectKey?: string | null;
  metadata?: JsonValue;
}

export interface ImportCalendarOccurrencesInput {
  provider: string;
  sourceExternalAccountId: string;
  sourceDisplayName: string;
  inputObjectKey?: string | null;
  inputChecksum?: string | null;
  occurrences: readonly CalendarOccurrenceImportInput[];
}

export interface CalendarImportRunRecord {
  id: string;
  sourceId: string;
  status: string;
  recordsRead: number;
  recordsImported: number;
  recordsRejected: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CalendarOccurrenceRecord {
  id: string;
  eventId: string;
  occurrenceKey: string;
  startsAt: string;
  endsAt: string | null;
  occurrenceDate: string | null;
  isAllDay: boolean;
  status: string;
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ValidationError(`${field} is required.`);
  }
  return normalized;
}

function timestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new ValidationError(`${field} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

function date(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${field} must be an ISO date.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ValidationError(`${field} must be an ISO date.`);
  }
  return value;
}

function calendarRecordExternalId(input: CalendarOccurrenceImportInput): string {
  return `${requiredText(input.calendarUid, 'calendarUid')}:${requiredText(input.occurrenceKey, 'occurrenceKey')}`;
}

function toCalendarImportRunRecord(row: ImportRunRow): CalendarImportRunRecord {
  return {
    id: row.id,
    sourceId: row.sourceId,
    status: row.status,
    recordsRead: row.recordsRead,
    recordsImported: row.recordsImported,
    recordsRejected: row.recordsRejected,
    startedAt: row.startedAt === null ? null : String(row.startedAt),
    completedAt: row.completedAt === null ? null : String(row.completedAt),
  };
}

function toCalendarOccurrenceRecord(row: EventOccurrenceRow): CalendarOccurrenceRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    occurrenceKey: row.occurrenceKey,
    startsAt: String(row.startsAt),
    endsAt: row.endsAt === null ? null : String(row.endsAt),
    occurrenceDate: row.occurrenceDate === null ? null : String(row.occurrenceDate),
    isAllDay: row.isAllDay,
    status: row.status,
  };
}

async function findOrCreateSource(
  handle: DbHandle,
  ownerUserid: string,
  input: ImportCalendarOccurrencesInput,
): Promise<ImportSourceRow> {
  const provider = requiredText(input.provider, 'provider');
  const externalAccountId = requiredText(input.sourceExternalAccountId, 'sourceExternalAccountId');

  const existing = await handle
    .selectFrom('app.importSources')
    .selectAll()
    .where('ownerUserid', '=', ownerUserid)
    .where('provider', '=', provider)
    .where('externalAccountId', '=', externalAccountId)
    .executeTakeFirst();
  if (existing) {
    return existing as ImportSourceRow;
  }

  const inserted = await handle
    .insertInto('app.importSources')
    .values({
      ownerUserid,
      provider,
      sourceKind: 'calendar',
      displayName: requiredText(input.sourceDisplayName, 'sourceDisplayName'),
      externalAccountId,
    })
    .onConflict((conflict) => conflict.doNothing())
    .returningAll()
    .executeTakeFirst();
  if (inserted) {
    return inserted as ImportSourceRow;
  }

  const concurrentSource = await handle
    .selectFrom('app.importSources')
    .selectAll()
    .where('ownerUserid', '=', ownerUserid)
    .where('provider', '=', provider)
    .where('externalAccountId', '=', externalAccountId)
    .executeTakeFirst();
  if (!concurrentSource) {
    throw new ValidationError('Unable to create calendar import source.');
  }
  return concurrentSource as ImportSourceRow;
}

async function findOrCreateEvent(
  handle: DbHandle,
  ownerUserid: string,
  source: ImportSourceRow,
  occurrence: CalendarOccurrenceImportInput,
): Promise<EventRow> {
  const calendarUid = requiredText(occurrence.calendarUid, 'calendarUid');
  const existingSource = await handle
    .selectFrom('app.calendarEventSources as calendarSource')
    .innerJoin('app.events as event', 'event.id', 'calendarSource.eventId')
    .selectAll('event')
    .where('calendarSource.sourceId', '=', source.id)
    .where('calendarSource.calendarUid', '=', calendarUid)
    .where('event.ownerUserid', '=', ownerUserid)
    .executeTakeFirst();

  const startsAt = timestamp(occurrence.startsAt, 'startsAt');
  const endsAt = occurrence.endsAt === undefined || occurrence.endsAt === null
    ? null
    : timestamp(occurrence.endsAt, 'endsAt');
  if (endsAt && endsAt < startsAt) {
    throw new ValidationError('endsAt must be on or after startsAt.');
  }

  const eventValues: Insertable<AppEvents> = {
    ownerUserid,
    eventType: 'calendar',
    title: requiredText(occurrence.title, 'title'),
    description: occurrence.description ?? null,
    startsAt,
    endsAt,
    isAllDay: occurrence.isAllDay,
    source: source.provider,
    externalId: calendarUid,
    recurrence: {},
    metadata: {
      calendarLocation: occurrence.location ?? null,
    },
  };

  if (existingSource) {
    return (await handle
      .updateTable('app.events')
      .set(eventValues)
      .where('id', '=', existingSource.id)
      .returningAll()
      .executeTakeFirstOrThrow()) as EventRow;
  }

  const event = (await handle
    .insertInto('app.events')
    .values(eventValues)
    .returningAll()
    .executeTakeFirstOrThrow()) as EventRow;

  await handle
    .insertInto('app.calendarEventSources')
    .values({
      sourceId: source.id,
      eventId: event.id,
      calendarUid,
    })
    .execute();

  return event;
}

async function findOrCreateImportRecord(
  handle: DbHandle,
  source: ImportSourceRow,
  importRun: ImportRunRow,
  occurrence: CalendarOccurrenceImportInput,
): Promise<ImportRecordRow> {
  const externalId = calendarRecordExternalId(occurrence);
  const contentHash = requiredText(occurrence.contentHash, 'contentHash');
  const inserted = await handle
    .insertInto('app.importRecords')
    .values({
      sourceId: source.id,
      importRunId: importRun.id,
      externalId,
      externalVersion: occurrence.externalVersion ?? null,
      recordType: 'calendar_occurrence',
      contentHash,
      rawObjectKey: occurrence.rawObjectKey ?? null,
      occurredAt: timestamp(occurrence.startsAt, 'startsAt'),
      metadata: occurrence.metadata ?? {},
    })
    .onConflict((conflict) => conflict.columns(['sourceId', 'externalId', 'contentHash']).doNothing())
    .returningAll()
    .executeTakeFirst();
  if (inserted) {
    return inserted as ImportRecordRow;
  }

  const existing = await handle
    .selectFrom('app.importRecords')
    .selectAll()
    .where('sourceId', '=', source.id)
    .where('externalId', '=', externalId)
    .where('contentHash', '=', contentHash)
    .executeTakeFirst();
  if (!existing) {
    throw new ValidationError('Unable to resolve calendar import record.');
  }
  return existing as ImportRecordRow;
}

async function upsertOccurrence(
  handle: DbHandle,
  event: EventRow,
  occurrence: CalendarOccurrenceImportInput,
): Promise<EventOccurrenceRow> {
  const startsAt = timestamp(occurrence.startsAt, 'startsAt');
  const endsAt = occurrence.endsAt === undefined || occurrence.endsAt === null
    ? null
    : timestamp(occurrence.endsAt, 'endsAt');
  if (endsAt && endsAt < startsAt) {
    throw new ValidationError('endsAt must be on or after startsAt.');
  }

  const occurrenceDate = occurrence.occurrenceDate === undefined || occurrence.occurrenceDate === null
    ? null
    : date(occurrence.occurrenceDate, 'occurrenceDate');
  if (occurrence.isAllDay && !occurrenceDate) {
    throw new ValidationError('occurrenceDate is required for all-day events.');
  }

  const values: Insertable<AppEventOccurrences> = {
    eventId: event.id,
    occurrenceKey: requiredText(occurrence.occurrenceKey, 'occurrenceKey'),
    startsAt,
    endsAt,
    occurrenceDate,
    isAllDay: occurrence.isAllDay,
    status: occurrence.isCancelled ? 'cancelled' : 'confirmed',
    metadata: occurrence.metadata ?? {},
  };

  return (await handle
    .insertInto('app.eventOccurrences')
    .values(values)
    .onConflict((conflict) =>
      conflict.columns(['eventId', 'occurrenceKey']).doUpdateSet({
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        occurrenceDate: values.occurrenceDate,
        isAllDay: values.isAllDay,
        status: values.status,
        metadata: values.metadata,
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()) as EventOccurrenceRow;
}

export const CalendarImportRepository = {
  async importOccurrences(
    ownerUserid: string,
    input: ImportCalendarOccurrencesInput,
  ): Promise<{ run: CalendarImportRunRecord; occurrences: CalendarOccurrenceRecord[] }> {
    if (input.occurrences.length === 0) {
      throw new ValidationError('At least one calendar occurrence is required.');
    }

    const source = await runInTransaction((transaction) => findOrCreateSource(transaction, ownerUserid, input));
    const importRun = (await db
      .insertInto('app.importRuns')
      .values({
        sourceId: source.id,
        status: 'running',
        inputObjectKey: input.inputObjectKey ?? null,
        inputChecksum: input.inputChecksum ?? null,
        recordsRead: input.occurrences.length,
        startedAt: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()) as ImportRunRow;

    try {
      const occurrences = await runInTransaction(async (transaction) => {
        const imported: CalendarOccurrenceRecord[] = [];
        for (const occurrenceInput of input.occurrences) {
          const event = await findOrCreateEvent(transaction, ownerUserid, source, occurrenceInput);
          const sourceRecord = await findOrCreateImportRecord(transaction, source, importRun, occurrenceInput);
          const occurrence = await upsertOccurrence(transaction, event, occurrenceInput);

          await transaction
            .insertInto('app.entitySourceRecords')
            .values({
              sourceRecordId: sourceRecord.id,
              canonicalEntityTable: 'app.event_occurrences',
              canonicalEntityId: occurrence.id,
              mappingKind: 'primary',
              confidence: 1,
            })
            .onConflict((conflict) => conflict.doNothing())
            .execute();

          imported.push(toCalendarOccurrenceRecord(occurrence));
        }
        return imported;
      });

      const completedRun = (await db
        .updateTable('app.importRuns')
        .set({
          status: 'completed',
          recordsImported: occurrences.length,
          completedAt: new Date().toISOString(),
        })
        .where('id', '=', importRun.id)
        .returningAll()
        .executeTakeFirstOrThrow()) as ImportRunRow;

      return { run: toCalendarImportRunRecord(completedRun), occurrences };
    } catch (error) {
      const errorSummary = error instanceof Error ? error.message : 'Calendar import failed.';
      await db
        .updateTable('app.importRuns')
        .set({
          status: 'failed',
          errorSummary,
          completedAt: new Date().toISOString(),
        })
        .where('id', '=', importRun.id)
        .execute();
      throw error;
    }
  },
};
