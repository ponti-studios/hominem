import { CamelCasePlugin, Kysely, PostgresDialect, sql as kyselySql } from 'kysely';
import pg from 'pg';

import { env } from './env';
import type { DB } from './types/database';

export type Database = DB;

const { Pool, types } = pg;
const TEST_DATABASE_NAME = 'app-test';
const TEST_DATABASE_TARGETS = new Map([
  ['127.0.0.1', new Set(['5434'])],
  ['localhost', new Set(['5434'])],
  ['[::1]', new Set(['5434'])],
  ['db-test.compose.orb.local', new Set(['5432'])],
]);

function formatAllowedTestDatabaseTargets() {
  return [...TEST_DATABASE_TARGETS.entries()]
    .flatMap(([host, ports]) => [...ports].map((port) => `${host}:${port}/${TEST_DATABASE_NAME}`))
    .join(', ');
}

function assertSafeTestDatabaseUrl(databaseUrl: string) {
  if (process.env.NODE_ENV !== 'test') return;

  const url = new URL(databaseUrl);
  const databaseName = url.pathname.replace(/^\//, '');
  const host = url.hostname;
  const port = url.port;

  if (databaseName === TEST_DATABASE_NAME && TEST_DATABASE_TARGETS.get(host)?.has(port)) return;

  throw new Error(
    `Refusing to use DATABASE_URL in test mode. Expected ${formatAllowedTestDatabaseTargets()}, received ${host}:${port}/${databaseName}.`,
  );
}

// Re-export Kysely's sql template tag for raw SQL queries
// Usage: await sql`SELECT * FROM users`.execute(db)
export const sql = kyselySql;

// Configure pg to return dates as strings instead of Date objects
// This ensures consistent string types across the codebase
types.setTypeParser(types.builtins.TIMESTAMP, (val) => val);
types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => val);
types.setTypeParser(types.builtins.DATE, (val) => val);

// Configure pg to return numeric as number for consistent types
// Safe for finance amounts — precision loss only affects very large values
types.setTypeParser(types.builtins.NUMERIC, (val) => parseFloat(val));

// Create a connection pool
const connectionString = env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to initialize the database pool');
}

assertSafeTestDatabaseUrl(connectionString);

export const pool = new Pool({
  connectionString,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
  plugins: [new CamelCasePlugin()],
});

// better-auth manages its own tables (account, session, user, verification,
// jwks, deviceCode) and writes genuinely camelCase columns to Postgres directly, unlike
// our app.* tables which are snake_case at rest. Those tables must bypass
// CamelCasePlugin or it will mistranslate already-camelCase columns into snake_case SQL
// that doesn't exist.
export const authDb = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
});

// Health check
export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
