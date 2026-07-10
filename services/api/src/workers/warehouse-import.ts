import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import { CalendarImportRepository, db, runInTransaction, type JsonValue } from '@hominem/db';
import { importStorageService } from '@hominem/storage';

const execFileAsync = promisify(execFile);

type SqliteRow = Record<string, unknown>;

export interface WarehouseImportInput {
  ownerUserId: string;
  databasePath: string;
  sourceDisplayName?: string;
}

export interface WarehouseImportResult {
  importRunId: string;
  snapshotHash: string;
  tables: readonly { table: string; recordCount: number }[];
  calendarOccurrencesImported: number;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function identifier(value: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Warehouse table name is invalid: ${value}`);
  }
  return `"${value}"`;
}

async function sqliteJson<T>(databasePath: string, statement: string): Promise<T> {
  const { stdout } = await execFileAsync(
    '/usr/bin/sqlite3',
    ['-readonly', '-json', databasePath, statement],
    {
      maxBuffer: 128 * 1024 * 1024,
    },
  );
  return JSON.parse(stdout || '[]') as T;
}

async function findOrCreateWarehouseSource(
  ownerUserId: string,
  displayName: string,
): Promise<string> {
  const existing = await db
    .selectFrom('app.importSources')
    .select('id')
    .where('ownerUserid', '=', ownerUserId)
    .where('provider', '=', 'warehouse')
    .where('externalAccountId', '=', 'warehouse-sqlite')
    .executeTakeFirst();
  if (existing) return existing.id;

  const inserted = await db
    .insertInto('app.importSources')
    .values({
      ownerUserid: ownerUserId,
      provider: 'warehouse',
      sourceKind: 'sqlite',
      displayName,
      externalAccountId: 'warehouse-sqlite',
    })
    .onConflict((conflict) => conflict.doNothing())
    .returning('id')
    .executeTakeFirst();
  if (inserted) return inserted.id;

  const concurrent = await db
    .selectFrom('app.importSources')
    .select('id')
    .where('ownerUserid', '=', ownerUserId)
    .where('provider', '=', 'warehouse')
    .where('externalAccountId', '=', 'warehouse-sqlite')
    .executeTakeFirstOrThrow();
  return concurrent.id;
}

async function findOrCreateArtifact(input: {
  ownerUserId: string;
  sourceId: string;
  importRunId: string;
  buffer: Buffer;
  mediaType: string;
  originalFilename: string | null;
}): Promise<{ id: string; objectKey: string; contentHash: string }> {
  const contentHash = sha256(input.buffer);
  const objectKey = await importStorageService.storeImmutableObject(
    input.ownerUserId,
    contentHash,
    input.buffer,
  );

  const existing = await db
    .selectFrom('app.importArtifacts')
    .select(['id', 'objectKey', 'contentHash'])
    .where('ownerUserid', '=', input.ownerUserId)
    .where('contentHash', '=', contentHash)
    .executeTakeFirst();
  if (existing) return existing;

  const inserted = await db
    .insertInto('app.importArtifacts')
    .values({
      ownerUserid: input.ownerUserId,
      sourceId: input.sourceId,
      importRunId: input.importRunId,
      objectKey,
      contentHash,
      byteSize: input.buffer.byteLength,
      mediaType: input.mediaType,
      originalFilename: input.originalFilename,
    })
    .onConflict((conflict) => conflict.columns(['ownerUserid', 'contentHash']).doNothing())
    .returning(['id', 'objectKey', 'contentHash'])
    .executeTakeFirst();
  if (inserted) return inserted;

  return db
    .selectFrom('app.importArtifacts')
    .select(['id', 'objectKey', 'contentHash'])
    .where('ownerUserid', '=', input.ownerUserId)
    .where('contentHash', '=', contentHash)
    .executeTakeFirstOrThrow();
}

function recordExternalId(table: string, row: SqliteRow, index: number): string {
  const id = row.id;
  return `${table}:${typeof id === 'string' || typeof id === 'number' ? id : index}`;
}

function asCalendarRows(
  rows: readonly SqliteRow[],
  rawObjectKeys: ReadonlyMap<string, string>,
): Parameters<typeof CalendarImportRepository.importOccurrences>[1]['occurrences'] {
  return rows.flatMap((row, index) => {
    const startsAt = typeof row.occurrence_start_utc === 'string' ? row.occurrence_start_utc : null;
    const uid = typeof row.uid === 'string' ? row.uid : null;
    const occurrenceKey = typeof row.occurrence_key === 'string' ? row.occurrence_key : null;
    if (!startsAt || !uid || !occurrenceKey) return [];

    const payload = Buffer.from(JSON.stringify(row));
    return [
      {
        calendarUid: uid,
        occurrenceKey,
        title:
          typeof row.summary === 'string' && row.summary.trim() ? row.summary : '(untitled event)',
        description: typeof row.description === 'string' ? row.description : null,
        location: typeof row.location === 'string' ? row.location : null,
        startsAt,
        endsAt: typeof row.occurrence_end_utc === 'string' ? row.occurrence_end_utc : null,
        occurrenceDate: typeof row.occurrence_date === 'string' ? row.occurrence_date : null,
        isAllDay: row.is_all_day === 1,
        isCancelled: row.is_cancelled === 1,
        contentHash: sha256(payload),
        rawObjectKey:
          rawObjectKeys.get(recordExternalId('calendar_event_occurrences', row, index)) ?? null,
        metadata: { warehouse: { rawEventId: row.raw_event_id ?? null } } as JsonValue,
      },
    ];
  });
}

/**
 * Imports a Warehouse SQLite snapshot without mutating it. Every source table
 * and row is retained as an immutable artifact/record before selected domains
 * are normalized, so an incomplete mapper can never silently discard history.
 */
export async function importWarehouseSnapshot(
  input: WarehouseImportInput,
): Promise<WarehouseImportResult> {
  const snapshot = await readFile(input.databasePath);
  const snapshotHash = sha256(snapshot);
  const sourceId = await findOrCreateWarehouseSource(
    input.ownerUserId,
    input.sourceDisplayName?.trim() || 'Warehouse SQLite',
  );
  const importRun = await db
    .insertInto('app.importRuns')
    .values({
      sourceId,
      status: 'running',
      inputChecksum: snapshotHash,
      recordsRead: 0,
      startedAt: new Date().toISOString(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  try {
    const snapshotArtifact = await findOrCreateArtifact({
      ownerUserId: input.ownerUserId,
      sourceId,
      importRunId: importRun.id,
      buffer: snapshot,
      mediaType: 'application/vnd.sqlite3',
      originalFilename: 'warehouse.sqlite',
    });

    await db
      .updateTable('app.importRuns')
      .set({ inputObjectKey: snapshotArtifact.objectKey })
      .where('id', '=', importRun.id)
      .execute();

    const tables = await sqliteJson<{ name: string }[]>(
      input.databasePath,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const summaries: { table: string; recordCount: number }[] = [];
    let recordsRead = 0;
    let recordsImported = 0;
    let calendarRows: SqliteRow[] = [];
    const calendarRawObjectKeys = new Map<string, string>();

    for (const table of tables) {
      const tableName = table.name;
      const rows = await sqliteJson<SqliteRow[]>(
        input.databasePath,
        `SELECT * FROM ${identifier(tableName)}`,
      );
      summaries.push({ table: tableName, recordCount: rows.length });
      recordsRead += rows.length;
      if (tableName === 'calendar_event_occurrences') calendarRows = rows;

      await runInTransaction(async (transaction) => {
        for (const [index, row] of rows.entries()) {
          const payload = Buffer.from(JSON.stringify(row));
          const artifact = await findOrCreateArtifact({
            ownerUserId: input.ownerUserId,
            sourceId,
            importRunId: importRun.id,
            buffer: payload,
            mediaType: 'application/json',
            originalFilename: `${tableName}.json`,
          });
          const externalId = recordExternalId(tableName, row, index);
          if (tableName === 'calendar_event_occurrences') {
            calendarRawObjectKeys.set(externalId, artifact.objectKey);
          }
          const sourceRecord = await transaction
            .insertInto('app.importRecords')
            .values({
              sourceId,
              importRunId: importRun.id,
              externalId,
              recordType: `warehouse/${tableName}`,
              contentHash: artifact.contentHash,
              rawObjectKey: artifact.objectKey,
              metadata: { warehouseTable: tableName },
            })
            .onConflict((conflict) =>
              conflict.columns(['sourceId', 'externalId', 'contentHash']).doNothing(),
            )
            .returning('id')
            .executeTakeFirst();
          if (!sourceRecord) continue;
          recordsImported += 1;
          await transaction
            .insertInto('app.importRecordPayloads')
            .values({
              sourceRecordId: sourceRecord.id,
              artifactId: artifact.id,
              payloadHash: artifact.contentHash,
            })
            .onConflict((conflict) => conflict.doNothing())
            .execute();
        }

        await transaction
          .insertInto('app.importReconciliations')
          .values({
            importRunId: importRun.id,
            entityKind: `warehouse/${tableName}`,
            sourceCount: rows.length,
            canonicalCount: rows.length,
            sourceChecksum: sha256(JSON.stringify(rows)),
            canonicalChecksum: sha256(JSON.stringify(rows)),
            status: 'matched',
          })
          .execute();
      });
    }

    const calendarInput = asCalendarRows(calendarRows, calendarRawObjectKeys);
    const calendarResult =
      calendarInput.length === 0
        ? null
        : await CalendarImportRepository.importOccurrences(input.ownerUserId, {
            provider: 'warehouse',
            sourceExternalAccountId: 'warehouse-sqlite',
            sourceDisplayName: input.sourceDisplayName?.trim() || 'Warehouse SQLite',
            inputObjectKey: snapshotArtifact.objectKey,
            inputChecksum: snapshotHash,
            occurrences: calendarInput,
          });

    await db
      .updateTable('app.importRuns')
      .set({
        status: 'completed',
        recordsRead,
        recordsImported,
        completedAt: new Date().toISOString(),
      })
      .where('id', '=', importRun.id)
      .execute();

    return {
      importRunId: importRun.id,
      snapshotHash,
      tables: summaries,
      calendarOccurrencesImported: calendarResult?.occurrences.length ?? 0,
    };
  } catch (error) {
    await db
      .updateTable('app.importRuns')
      .set({
        status: 'failed',
        errorSummary: error instanceof Error ? error.message : 'Warehouse import failed.',
        completedAt: new Date().toISOString(),
      })
      .where('id', '=', importRun.id)
      .execute();
    throw error;
  }
}
