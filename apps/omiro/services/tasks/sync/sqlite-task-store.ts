import type { ServerTaskFields, StoredTask } from './task-mapping';
import type { OutboxOp, OutboxPayload, TaskStore } from './task-store';

export type SqlValue = string | number | null;

// The few SQLite calls the store needs. expo-sqlite implements it on device
// (`expo-sqlite-driver.ts`); tests implement it over node:sqlite.
export type SqlRow = Record<string, unknown>;

export interface SqliteDriver {
  exec(sql: string): void;
  run(sql: string, params?: SqlValue[]): { lastInsertRowId: number };
  all(sql: string, params?: SqlValue[]): SqlRow[];
}

const SCHEMA_VERSION = 1;

function text(row: SqlRow, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function nullableText(row: SqlRow, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function toTask(row: SqlRow): StoredTask {
  return {
    id: text(row, 'id'),
    title: text(row, 'title'),
    notes: nullableText(row, 'notes'),
    status: text(row, 'status') === 'completed' ? 'completed' : 'pending',
    completedAt: nullableText(row, 'completed_at'),
    priority: 'none',
    startAt: nullableText(row, 'start_at'),
    dueAt: nullableText(row, 'due_at'),
    location: nullableText(row, 'location'),
    listTitle: null,
    createdAt: nullableText(row, 'created_at'),
    updatedAt: nullableText(row, 'updated_at'),
    deletedAt: nullableText(row, 'deleted_at'),
  };
}

// Reads the fields an op carries, keeping only values of the right type.
function readFields(value: object): Partial<ServerTaskFields> {
  const fields: Partial<ServerTaskFields> = {};
  const title: unknown = Reflect.get(value, 'title');
  if (typeof title === 'string') {
    fields.title = title;
  }
  const nullable = [
    'description',
    'dueAt',
    'scheduledStartAt',
    'scheduledEndAt',
    'location',
  ] as const;
  for (const key of nullable) {
    const field: unknown = Reflect.get(value, key);
    if (typeof field === 'string' || field === null) {
      fields[key] = field;
    }
  }
  return fields;
}

// The payload column is written only by `enqueue`, so a parse failure or an
// unknown kind means the row is corrupt; skip it rather than guess.
function parsePayload(raw: string): OutboxPayload | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const kind: unknown = Reflect.get(value, 'kind');
    const fieldsValue: unknown = Reflect.get(value, 'fields');
    const fields =
      typeof fieldsValue === 'object' && fieldsValue !== null ? readFields(fieldsValue) : null;
    if (kind === 'update' && fields) {
      return { kind, fields };
    }
    if (kind === 'create' && fields && typeof fields.title === 'string') {
      return {
        kind,
        fields: {
          title: fields.title,
          description: fields.description ?? null,
          dueAt: fields.dueAt ?? null,
          scheduledStartAt: fields.scheduledStartAt ?? null,
          scheduledEndAt: fields.scheduledEndAt ?? null,
          location: fields.location ?? null,
        },
      };
    }
    const completed: unknown = Reflect.get(value, 'completed');
    if (kind === 'complete' && typeof completed === 'boolean') {
      return { kind, completed };
    }
    return kind === 'delete' ? { kind } : null;
  } catch {
    return null;
  }
}

function toOp(row: SqlRow): OutboxOp | null {
  const payload = parsePayload(text(row, 'payload'));
  const id = row['id'];
  if (!payload || typeof id !== 'number') {
    return null;
  }
  return {
    id,
    taskId: text(row, 'task_id'),
    payload,
    createdAt: text(row, 'created_at'),
    status: text(row, 'status') === 'failed' ? 'failed' : 'pending',
    failedReason: nullableText(row, 'failed_reason'),
  };
}

function migrate(db: SqliteDriver) {
  const [versionRow] = db.all('PRAGMA user_version');
  const version = versionRow?.['user_version'];
  if (typeof version === 'number' && version >= SCHEMA_VERSION) {
    return;
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL,
      completed_at TEXT,
      start_at TEXT,
      due_at TEXT,
      location TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks (due_at);
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      failed_reason TEXT
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export function createSqliteTaskStore(db: SqliteDriver): TaskStore {
  migrate(db);

  return {
    listTasks: () =>
      db
        .all(
          'SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY COALESCE(start_at, due_at) IS NULL, COALESCE(start_at, due_at), created_at',
        )
        .map(toTask),
    getTask: (id) => {
      const [row] = db.all('SELECT * FROM tasks WHERE id = ?', [id]);
      return row ? toTask(row) : null;
    },
    putTask: (task) => {
      db.run(
        `INSERT OR REPLACE INTO tasks
          (id, title, notes, status, completed_at, start_at, due_at, location, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.title,
          task.notes,
          task.status,
          task.completedAt,
          task.startAt,
          task.dueAt,
          task.location,
          task.createdAt,
          task.updatedAt,
          task.deletedAt,
        ],
      );
    },
    removeTask: (id) => {
      db.run('DELETE FROM tasks WHERE id = ?', [id]);
    },

    getCursor: () => {
      const [row] = db.all("SELECT value FROM meta WHERE key = 'cursor'");
      return row ? nullableText(row, 'value') : null;
    },
    setCursor: (cursor) => {
      db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cursor', ?)", [cursor]);
    },

    enqueue: (taskId, payload) => {
      const createdAt = new Date().toISOString();
      const { lastInsertRowId } = db.run(
        'INSERT INTO outbox (task_id, payload, created_at) VALUES (?, ?, ?)',
        [taskId, JSON.stringify(payload), createdAt],
      );
      return {
        id: lastInsertRowId,
        taskId,
        payload,
        createdAt,
        status: 'pending',
        failedReason: null,
      };
    },
    listOps: () => db.all('SELECT * FROM outbox ORDER BY id ASC').flatMap((row) => toOp(row) ?? []),
    removeOp: (id) => {
      db.run('DELETE FROM outbox WHERE id = ?', [id]);
    },
    failOp: (id, reason) => {
      db.run("UPDATE outbox SET status = 'failed', failed_reason = ? WHERE id = ?", [reason, id]);
    },

    clear: () => {
      db.exec('DELETE FROM tasks; DELETE FROM outbox; DELETE FROM meta;');
    },
  };
}
