import { openDatabaseSync } from 'expo-sqlite';

import type { SqlRow, SqliteDriver } from './sqlite-task-store';

// Binds the store to the on-device database. Opening is synchronous, so the
// first read never waits on a promise.
export function openTasksDatabase(): SqliteDriver {
  const db = openDatabaseSync('omiro-tasks.db');
  db.execSync('PRAGMA journal_mode = WAL;');

  return {
    exec: (sql) => db.execSync(sql),
    run: (sql, params = []) => ({ lastInsertRowId: db.runSync(sql, params).lastInsertRowId }),
    all: (sql, params = []) => db.getAllSync<SqlRow>(sql, params),
  };
}
