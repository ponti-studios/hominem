import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { authDb, db } from '@hominem/db';
import { afterEach, describe, expect, it } from 'vitest';

import { importWarehouseSnapshot } from './warehouse-import';

const execFileAsync = promisify(execFile);
const runIntegration = process.env.NODE_ENV === 'test' ? describe : describe.skip;

async function createWarehouseFixture(): Promise<{ directory: string; databasePath: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'hominem-warehouse-'));
  const databasePath = join(directory, 'warehouse.db');
  await execFileAsync('/usr/bin/sqlite3', [
    databasePath,
    `
      CREATE TABLE calendar_event_occurrences (
        id INTEGER PRIMARY KEY,
        raw_event_id INTEGER,
        uid TEXT,
        occurrence_key TEXT,
        occurrence_start_utc TEXT,
        occurrence_end_utc TEXT,
        occurrence_date TEXT,
        is_all_day INTEGER,
        is_cancelled INTEGER,
        summary TEXT,
        description TEXT,
        location TEXT
      );
      CREATE TABLE finance_accounts (id INTEGER PRIMARY KEY, name TEXT, account_type TEXT);
      INSERT INTO calendar_event_occurrences VALUES
        (1, 101, 'weekly-sync', '2026-07-14T16:00:00.000Z', '2026-07-14T16:00:00.000Z', '2026-07-14T17:00:00.000Z', NULL, 0, 0, 'Project sync', 'Private body', 'Studio');
      INSERT INTO finance_accounts VALUES (22, 'Checking', 'depository');
    `,
  ]);
  return { directory, databasePath };
}

runIntegration('importWarehouseSnapshot', () => {
  const userIds: string[] = [];
  const directories: string[] = [];

  afterEach(async () => {
    for (const directory of directories.splice(0))
      await rm(directory, { recursive: true, force: true });
    for (const userId of userIds.splice(0))
      await authDb.deleteFrom('user').where('id', '=', userId).execute();
  });

  it('retains every source row and normalizes calendar occurrences idempotently', async () => {
    const userId = randomUUID();
    userIds.push(userId);
    await authDb
      .insertInto('user')
      .values({ id: userId, name: 'Warehouse Test User', email: `${userId}@example.com` })
      .execute();
    const fixture = await createWarehouseFixture();
    directories.push(fixture.directory);

    const first = await importWarehouseSnapshot({
      ownerUserId: userId,
      databasePath: fixture.databasePath,
    });
    const second = await importWarehouseSnapshot({
      ownerUserId: userId,
      databasePath: fixture.databasePath,
    });

    expect(first.tables).toEqual([
      { table: 'calendar_event_occurrences', recordCount: 1 },
      { table: 'finance_accounts', recordCount: 1 },
    ]);
    expect(first.calendarOccurrencesImported).toBe(1);
    expect(second.calendarOccurrencesImported).toBe(1);

    const [records, artifacts, events, occurrences, reconciliations] = await Promise.all([
      db
        .selectFrom('app.importRecords as record')
        .innerJoin('app.importSources as source', 'source.id', 'record.sourceId')
        .selectAll('record')
        .where('source.ownerUserid', '=', userId)
        .execute(),
      db.selectFrom('app.importArtifacts').selectAll().where('ownerUserid', '=', userId).execute(),
      db.selectFrom('app.events').selectAll().where('ownerUserid', '=', userId).execute(),
      db
        .selectFrom('app.eventOccurrences as occurrence')
        .innerJoin('app.events as event', 'event.id', 'occurrence.eventId')
        .selectAll('occurrence')
        .where('event.ownerUserid', '=', userId)
        .execute(),
      db
        .selectFrom('app.importReconciliations as reconciliation')
        .innerJoin('app.importRuns as run', 'run.id', 'reconciliation.importRunId')
        .innerJoin('app.importSources as source', 'source.id', 'run.sourceId')
        .selectAll('reconciliation')
        .where('source.ownerUserid', '=', userId)
        .execute(),
    ]);

    expect(records).toHaveLength(3);
    expect(artifacts.length).toBeGreaterThanOrEqual(3);
    expect(events).toHaveLength(1);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.status).toBe('confirmed');
    expect(reconciliations).toHaveLength(4);
  });
});
