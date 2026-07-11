import { sql, type Selectable } from 'kysely';

import { db } from '../../db';
import { ValidationError } from '../../errors';
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

export type CalendarEvidenceRecord = {
  sourceRecordId: ImportRecordRow['id'] | null;
  sourceSystem: ImportSourceRow['provider'] | null;
  sourceFile: string | null;
  importRunId: ImportRunRow['id'] | null;
  importedAt: ImportRecordRow['createdat'] | null;
};

export type CalendarOccurrenceReadRecord = {
  occurrenceId: EventOccurrenceRow['id'];
  eventId: EventRow['id'];
  title: EventRow['title'];
  startsAt: EventOccurrenceRow['startsAt'];
  endsAt: EventOccurrenceRow['endsAt'];
  occurrenceDate: EventOccurrenceRow['occurrenceDate'];
  isAllDay: EventOccurrenceRow['isAllDay'];
  location: string | null;
  isCancelled: boolean;
  evidence: CalendarEvidenceRecord;
};

export interface CalendarSearchInput {
  query: string;
  startsFrom?: string | null;
  startsBefore?: string | null;
  includeCancelled?: boolean;
  limit?: number;
}

export interface CalendarUpcomingInput {
  startsFrom?: string | null;
  startsBefore?: string | null;
  limit?: number;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 25;

function boundedLimit(limit: number | null | undefined): number {
  if (limit === undefined || limit === null) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new ValidationError('limit must be a positive integer.');
  }
  return Math.min(limit, MAX_LIMIT);
}

function isoTimestamp(value: string | null | undefined, field: string): string | null {
  if (value === undefined || value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new ValidationError(`${field} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

function validateRange(startsFrom: string | null, startsBefore: string | null): void {
  if (startsFrom && startsBefore && startsFrom >= startsBefore) {
    throw new ValidationError('startsFrom must be before startsBefore.');
  }
}

function likeLiteral(value: string): string {
  return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

function basename(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).at(-1) ?? null;
}

function metadataLocation(metadata: JsonValue): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, JsonValue>).calendarLocation;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

type CalendarOccurrenceRow = {
  occurrenceId: EventOccurrenceRow['id'];
  eventId: EventRow['id'];
  title: EventRow['title'];
  startsAt: EventOccurrenceRow['startsAt'];
  endsAt: EventOccurrenceRow['endsAt'];
  occurrenceDate: EventOccurrenceRow['occurrenceDate'];
  isAllDay: EventOccurrenceRow['isAllDay'];
  status: EventOccurrenceRow['status'];
  metadata: EventRow['metadata'];
  sourceRecordId: ImportRecordRow['id'] | null;
  sourceSystem: ImportSourceRow['provider'] | null;
  rawObjectKey: ImportRecordRow['rawObjectKey'] | null;
  importRunId: ImportRunRow['id'] | null;
  importedAt: ImportRecordRow['createdat'] | null;
};

function toReadRecord(row: CalendarOccurrenceRow): CalendarOccurrenceReadRecord {
  return {
    occurrenceId: row.occurrenceId,
    eventId: row.eventId,
    title: row.title,
    startsAt: String(row.startsAt),
    endsAt: row.endsAt === null ? null : String(row.endsAt),
    occurrenceDate: row.occurrenceDate === null ? null : String(row.occurrenceDate),
    isAllDay: row.isAllDay,
    location: metadataLocation(row.metadata),
    isCancelled: row.status === 'cancelled',
    evidence: {
      sourceRecordId: row.sourceRecordId,
      sourceSystem: row.sourceSystem,
      sourceFile: basename(row.rawObjectKey),
      importRunId: row.importRunId,
      importedAt: row.importedAt === null ? null : String(row.importedAt),
    },
  };
}

function baseCalendarQuery(ownerUserId: string) {
  return db
    .selectFrom('app.eventOccurrences as occurrence')
    .innerJoin('app.events as event', 'event.id', 'occurrence.eventId')
    .leftJoin('app.entitySourceRecords as mapping', (join) =>
      join
        .onRef('mapping.canonicalEntityId', '=', 'occurrence.id')
        .on('mapping.canonicalEntityTable', '=', sql`'app.event_occurrences'::regclass`),
    )
    .leftJoin('app.importRecords as importRecord', 'importRecord.id', 'mapping.sourceRecordId')
    .leftJoin('app.importSources as source', 'source.id', 'importRecord.sourceId')
    .select([
      'occurrence.id as occurrenceId',
      'event.id as eventId',
      'event.title as title',
      'occurrence.startsAt as startsAt',
      'occurrence.endsAt as endsAt',
      'occurrence.occurrenceDate as occurrenceDate',
      'occurrence.isAllDay as isAllDay',
      'occurrence.status as status',
      'event.metadata as metadata',
      'mapping.sourceRecordId as sourceRecordId',
      'source.provider as sourceSystem',
      'importRecord.rawObjectKey as rawObjectKey',
      'importRecord.importRunId as importRunId',
      'importRecord.createdat as importedAt',
    ])
    .where('event.ownerUserid', '=', ownerUserId)
    .where('event.eventType', '=', 'calendar');
}

export class CalendarQueryRepository {
  static async getOccurrence(
    ownerUserId: string,
    occurrenceId: string,
  ): Promise<CalendarOccurrenceReadRecord | null> {
    const row = await baseCalendarQuery(ownerUserId)
      .where('occurrence.id', '=', occurrenceId)
      .executeTakeFirst();

    return row ? toReadRecord(row as CalendarOccurrenceRow) : null;
  }

  static async search(
    ownerUserId: string,
    input: CalendarSearchInput,
  ): Promise<CalendarOccurrenceReadRecord[]> {
    const query = input.query.trim();
    if (query.length < 2) {
      throw new ValidationError('query must be at least 2 characters.');
    }

    const startsFrom = isoTimestamp(input.startsFrom, 'startsFrom');
    const startsBefore = isoTimestamp(input.startsBefore, 'startsBefore');
    validateRange(startsFrom, startsBefore);

    const pattern = likeLiteral(query);
    let builder = baseCalendarQuery(ownerUserId)
      .where((eb) =>
        eb.or([
          eb('event.title', 'ilike', pattern),
          eb('event.description', 'ilike', pattern),
          eb(sql<string>`event.metadata ->> 'calendarLocation'`, 'ilike', pattern),
        ]),
      )
      .orderBy('occurrence.startsAt', 'asc')
      .orderBy('occurrence.id', 'asc')
      .limit(boundedLimit(input.limit));

    if (!input.includeCancelled) {
      builder = builder.where('occurrence.status', '!=', 'cancelled');
    }
    if (startsFrom) builder = builder.where('occurrence.startsAt', '>=', startsFrom);
    if (startsBefore) builder = builder.where('occurrence.startsAt', '<', startsBefore);

    const rows = await builder.execute();
    return rows.map((row) => toReadRecord(row as CalendarOccurrenceRow));
  }

  static async upcoming(
    ownerUserId: string,
    input: CalendarUpcomingInput = {},
  ): Promise<CalendarOccurrenceReadRecord[]> {
    const startsFrom = isoTimestamp(input.startsFrom, 'startsFrom') ?? new Date().toISOString();
    const startsBefore =
      isoTimestamp(input.startsBefore, 'startsBefore') ??
      new Date(Date.parse(startsFrom) + 1000 * 60 * 60 * 24 * 14).toISOString();
    validateRange(startsFrom, startsBefore);

    const rows = await baseCalendarQuery(ownerUserId)
      .where('occurrence.status', '!=', 'cancelled')
      .where('occurrence.startsAt', '>=', startsFrom)
      .where('occurrence.startsAt', '<', startsBefore)
      .orderBy('occurrence.startsAt', 'asc')
      .orderBy('occurrence.id', 'asc')
      .limit(boundedLimit(input.limit))
      .execute();

    return rows.map((row) => toReadRecord(row as CalendarOccurrenceRow));
  }
}
