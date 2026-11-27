import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DB = join(homedir(), '.hominem', 'agent.db');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_request TEXT NOT NULL,
    ts_request_ms INTEGER NOT NULL,
    ts_response TEXT,
    ts_response_ms INTEGER,
    duration_ms INTEGER,
    connector TEXT NOT NULL,
    service TEXT,
    command TEXT NOT NULL,
    params TEXT,
    json_body TEXT,
    response TEXT,
    http_status INTEGER,
    ok INTEGER,
    is_error INTEGER,
    error TEXT,
    exit_code INTEGER,
    stderr TEXT
  );
  CREATE INDEX IF NOT EXISTS events_ts ON events(ts_request_ms);
  CREATE INDEX IF NOT EXISTS events_connector_ts ON events(connector, ts_request_ms);
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_start TEXT NOT NULL,
    ts_end TEXT,
    source TEXT NOT NULL,
    status TEXT,
    exit_code INTEGER,
    message TEXT,
    context TEXT
  );
  CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    context TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workflow_workers (
    run_id TEXT NOT NULL,
    worker_key TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    result TEXT,
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    started_at TEXT,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    PRIMARY KEY (run_id, worker_key),
    FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS workflow_workers_status
    ON workflow_workers(run_id, status);
  CREATE TABLE IF NOT EXISTS hominem_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL
  );
`;

export function dbPath(): string {
  return process.env.HOMINEM_AGENT_DB ?? DEFAULT_DB;
}

export function connect(path?: string): DatabaseSync {
  const file = path ?? dbPath();
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; ${SCHEMA}`);
  const migration = db.prepare(
    `INSERT OR IGNORE INTO hominem_migrations (name, applied_at) VALUES (?, ?)`,
  );
  migration.run('0000_hominem.sql', new Date().toISOString());
  migration.run('0001_workflows.sql', new Date().toISOString());
  return db;
}

function json(value: unknown): string | null {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

function bool(value: boolean | undefined): number | null {
  if (value === undefined) return null;
  return value ? 1 : 0;
}

export interface LogEventOptions {
  tsRequest: string;
  tsRequestMs: number;
  tsResponse?: string;
  tsResponseMs?: number;
  durationMs?: number;
  service?: string;
  params?: unknown;
  jsonBody?: unknown;
  response?: unknown;
  httpStatus?: number;
  ok?: boolean;
  isError?: boolean;
  error?: unknown;
  exitCode?: number;
  stderr?: string;
  path?: string;
}

export function logEvent(connector: string, command: string[], opts: LogEventOptions): number {
  const db = connect(opts.path);
  try {
    const result = db
      .prepare(
        `INSERT INTO events (
          ts_request, ts_request_ms, ts_response, ts_response_ms, duration_ms,
          connector, service, command, params, json_body, response, http_status,
          ok, is_error, error, exit_code, stderr
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        opts.tsRequest,
        opts.tsRequestMs,
        opts.tsResponse ?? null,
        opts.tsResponseMs ?? null,
        opts.durationMs ?? null,
        connector,
        opts.service ?? null,
        JSON.stringify(command),
        json(opts.params),
        json(opts.jsonBody),
        json(opts.response),
        opts.httpStatus ?? null,
        bool(opts.ok),
        bool(opts.isError),
        json(opts.error),
        opts.exitCode ?? null,
        opts.stderr ?? null,
      );
    return Number(result.lastInsertRowid);
  } finally {
    db.close();
  }
}

export interface LogRunOptions {
  tsStart?: string;
  tsEnd?: string;
  status?: string;
  exitCode?: number;
  message?: string;
  context?: unknown;
  path?: string;
}

export function logRun(source: string, opts: LogRunOptions = {}): number {
  const db = connect(opts.path);
  try {
    const result = db
      .prepare(
        `INSERT INTO runs (ts_start, ts_end, source, status, exit_code, message, context)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        opts.tsStart ?? new Date().toISOString(),
        opts.tsEnd ?? null,
        source,
        opts.status ?? null,
        opts.exitCode ?? null,
        opts.message ?? null,
        json(opts.context),
      );
    return Number(result.lastInsertRowid);
  } finally {
    db.close();
  }
}

export interface FinishRunOptions {
  status: string;
  exitCode?: number;
  message?: string;
  tsEnd?: string;
  path?: string;
}

export function finishRun(id: number, opts: FinishRunOptions): void {
  const db = connect(opts.path);
  try {
    db.prepare(
      `UPDATE runs SET ts_end = ?, status = ?, exit_code = ?, message = ? WHERE id = ?`,
    ).run(
      opts.tsEnd ?? new Date().toISOString(),
      opts.status,
      opts.exitCode ?? null,
      opts.message ?? null,
      id,
    );
  } finally {
    db.close();
  }
}
