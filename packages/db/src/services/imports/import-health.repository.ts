import { sql } from 'kysely';

import { db } from '../../db';
import type { JsonValue } from '../../types/database';

export interface ImportSourceHealthRecord {
  sourceId: string;
  provider: string;
  sourceKind: string;
  displayName: string;
  status: string;
  lastSyncedAt: string | null;
  runCount: number;
  latestRunStatus: string | null;
  latestRunCompletedAt: string | null;
}

export interface ReconciliationHealthRecord {
  entityKind: string;
  status: string;
  sourceCount: number;
  canonicalCount: number;
  createdAt: string;
}

export interface PersonalDataHealthRecord {
  databaseAccessible: true;
  importSourceCount: number;
  importRunCount: number;
  latestImportCompletedAt: string | null;
  artifactCount: number;
  rawRecordCount: number;
  canonicalCounts: {
    calendarOccurrences: number;
    financeTransactions: number;
    notes: number;
    chats: number;
  };
  sources: ImportSourceHealthRecord[];
  reconciliations: ReconciliationHealthRecord[];
  warnings: string[];
}

type CountRow = { count: number | string | bigint };

function countValue(row: CountRow | undefined): number {
  return Number(row?.count ?? 0);
}

function textDate(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function reconciliationHasWarning(details: JsonValue): boolean {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return false;
  const record = details as Record<string, JsonValue>;
  return Number(record.recordsRejected ?? 0) > 0 || Number(record.unmappedFieldCount ?? 0) > 0;
}

export class ImportHealthRepository {
  static async getPersonalDataHealth(ownerUserId: string): Promise<PersonalDataHealthRecord> {
    const [
      sourceCountRow,
      runCountRow,
      latestRun,
      artifactCountRow,
      rawRecordCountRow,
      calendarCountRow,
      financeCountRow,
      notesCountRow,
      chatsCountRow,
      sources,
      reconciliations,
      pendingReviewCountRow,
    ] = await Promise.all([
      db
        .selectFrom('app.importSources')
        .select(db.fn.countAll<number>().as('count'))
        .where('ownerUserid', '=', ownerUserId)
        .executeTakeFirst(),
      db
        .selectFrom('app.importRuns as run')
        .innerJoin('app.importSources as source', 'source.id', 'run.sourceId')
        .select(db.fn.countAll<number>().as('count'))
        .where('source.ownerUserid', '=', ownerUserId)
        .executeTakeFirst(),
      db
        .selectFrom('app.importRuns as run')
        .innerJoin('app.importSources as source', 'source.id', 'run.sourceId')
        .select(['run.completedAt'])
        .where('source.ownerUserid', '=', ownerUserId)
        .where('run.completedAt', 'is not', null)
        .orderBy('run.completedAt', 'desc')
        .limit(1)
        .executeTakeFirst(),
      db
        .selectFrom('app.importArtifacts')
        .select(db.fn.countAll<number>().as('count'))
        .where('ownerUserid', '=', ownerUserId)
        .executeTakeFirst(),
      db
        .selectFrom('app.importRecords as record')
        .innerJoin('app.importSources as source', 'source.id', 'record.sourceId')
        .select(db.fn.countAll<number>().as('count'))
        .where('source.ownerUserid', '=', ownerUserId)
        .executeTakeFirst(),
      db
        .selectFrom('app.eventOccurrences as occurrence')
        .innerJoin('app.events as event', 'event.id', 'occurrence.eventId')
        .select(db.fn.countAll<number>().as('count'))
        .where('event.ownerUserid', '=', ownerUserId)
        .where('event.eventType', '=', 'calendar')
        .executeTakeFirst(),
      db
        .selectFrom('app.financeTransactions')
        .select(db.fn.countAll<number>().as('count'))
        .where('userId', '=', ownerUserId)
        .executeTakeFirst(),
      db
        .selectFrom('app.notes')
        .select(db.fn.countAll<number>().as('count'))
        .where('ownerUserid', '=', ownerUserId)
        .executeTakeFirst(),
      db
        .selectFrom('app.chats')
        .select(db.fn.countAll<number>().as('count'))
        .where('ownerUserid', '=', ownerUserId)
        .executeTakeFirst(),
      db
        .selectFrom('app.importSources as source')
        .leftJoin('app.importRuns as latestRun', (join) =>
          join
            .onRef('latestRun.sourceId', '=', 'source.id')
            .on(
              'latestRun.createdat',
              '=',
              sql`(
                select max(r.createdat)
                from app.import_runs r
                where r.source_id = source.id
              )`,
            ),
        )
        .select((eb) => [
          'source.id as sourceId',
          'source.provider as provider',
          'source.sourceKind as sourceKind',
          'source.displayName as displayName',
          'source.status as status',
          'source.lastSyncedAt as lastSyncedAt',
          'latestRun.status as latestRunStatus',
          'latestRun.completedAt as latestRunCompletedAt',
          eb
            .selectFrom('app.importRuns as runCount')
            .select(db.fn.countAll<number>().as('runCount'))
            .whereRef('runCount.sourceId', '=', 'source.id')
            .as('runCount'),
        ])
        .where('source.ownerUserid', '=', ownerUserId)
        .orderBy('source.sourceKind', 'asc')
        .orderBy('source.displayName', 'asc')
        .execute(),
      db
        .selectFrom('app.importReconciliations as reconciliation')
        .innerJoin('app.importRuns as run', 'run.id', 'reconciliation.importRunId')
        .innerJoin('app.importSources as source', 'source.id', 'run.sourceId')
        .select([
          'reconciliation.entityKind as entityKind',
          'reconciliation.status as status',
          'reconciliation.sourceCount as sourceCount',
          'reconciliation.canonicalCount as canonicalCount',
          'reconciliation.createdat as createdAt',
          'reconciliation.details as details',
        ])
        .where('source.ownerUserid', '=', ownerUserId)
        .orderBy('reconciliation.createdat', 'desc')
        .limit(20)
        .execute(),
      db
        .selectFrom('app.importReviewItems as review')
        .innerJoin('app.importRecords as record', 'record.id', 'review.sourceRecordId')
        .innerJoin('app.importSources as source', 'source.id', 'record.sourceId')
        .select(db.fn.countAll<number>().as('count'))
        .where('source.ownerUserid', '=', ownerUserId)
        .where('review.status', '=', 'open')
        .executeTakeFirst(),
    ]);

    const warnings: string[] = [];
    const pendingReviewCount = countValue(pendingReviewCountRow);
    if (pendingReviewCount > 0) {
      warnings.push(`${pendingReviewCount} import review item(s) need attention.`);
    }
    const failedReconciliationCount = reconciliations.filter(
      (reconciliation) => reconciliation.status !== 'matched' || reconciliationHasWarning(reconciliation.details),
    ).length;
    if (failedReconciliationCount > 0) {
      warnings.push(`${failedReconciliationCount} recent reconciliation check(s) reported mismatches or warnings.`);
    }

    return {
      databaseAccessible: true,
      importSourceCount: countValue(sourceCountRow),
      importRunCount: countValue(runCountRow),
      latestImportCompletedAt: textDate(latestRun?.completedAt),
      artifactCount: countValue(artifactCountRow),
      rawRecordCount: countValue(rawRecordCountRow),
      canonicalCounts: {
        calendarOccurrences: countValue(calendarCountRow),
        financeTransactions: countValue(financeCountRow),
        notes: countValue(notesCountRow),
        chats: countValue(chatsCountRow),
      },
      sources: sources.map((source) => ({
        sourceId: source.sourceId,
        provider: source.provider,
        sourceKind: source.sourceKind,
        displayName: source.displayName,
        status: source.status,
        lastSyncedAt: textDate(source.lastSyncedAt),
        runCount: Number(source.runCount ?? 0),
        latestRunStatus: source.latestRunStatus,
        latestRunCompletedAt: textDate(source.latestRunCompletedAt),
      })),
      reconciliations: reconciliations.map((reconciliation) => ({
        entityKind: reconciliation.entityKind,
        status: reconciliation.status,
        sourceCount: reconciliation.sourceCount,
        canonicalCount: reconciliation.canonicalCount,
        createdAt: String(reconciliation.createdAt),
      })),
      warnings,
    };
  }
}
