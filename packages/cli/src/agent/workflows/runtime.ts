import { randomUUID } from 'node:crypto';

import { connect, finishRun, logRun } from '../log/agent_log.ts';

type WorkflowWorker<T, R> = (item: T) => R | Promise<R>;

interface WorkflowItem<T> {
  key: string;
  value: T;
}

export interface WorkflowStatus<R = unknown> {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  done: number;
  failed: number;
  total: number;
  skipped: number;
  results: Array<{ key: string; value: R }>;
  errors: Array<{ key: string; message: string }>;
}

export interface WorkflowChoice {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
}

export interface WorkflowOptions<T, R> {
  name: string;
  items: WorkflowItem<T>[];
  worker: WorkflowWorker<T, R>;
  id?: string;
  concurrency?: number;
  path?: string;
}

interface WorkerRow {
  worker_key: string;
  status: string;
  payload: string;
  result: string | null;
  error: string | null;
}

function timestamp(): string {
  return new Date().toISOString();
}

function writeWorkers<T>(
  db: ReturnType<typeof connect>,
  runId: string,
  items: WorkflowItem<T>[],
): void {
  const insert = db.prepare(
    `INSERT INTO workflow_workers (
       run_id, worker_key, status, payload, attempts, created_at, updated_at
     ) VALUES (?, ?, 'pending', ?, 0, ?, ?)
     ON CONFLICT(run_id, worker_key) DO NOTHING`,
  );
  const now = timestamp();
  for (const item of items) {
    if (!item.key.trim()) throw new Error('workflow worker key cannot be empty');
    insert.run(runId, item.key, serialize(item.value), now, now);
  }
}

function parse<T>(raw: string): T {
  return JSON.parse(raw);
}

function serialize(value: unknown): string {
  const text = JSON.stringify(value);
  if (text === undefined) throw new Error('workflow values and results must be JSON serializable');
  return text;
}

function assertRunIdentity(
  db: ReturnType<typeof connect>,
  runId: string,
  name: string,
  items: WorkflowItem<unknown>[],
): void {
  const existing = db.prepare(`SELECT name FROM workflow_runs WHERE id = ?`).get(runId);
  if (!existing) return;
  const owner = String(existing['name']);
  if (owner !== name) {
    throw new Error(`workflow ${runId} belongs to ${owner}, not ${name}`);
  }
  const stored = db
    .prepare(`SELECT worker_key FROM workflow_workers WHERE run_id = ?`)
    .all(runId)
    .map((row) => String(row['worker_key']))
    .sort();
  const requested = items.map((item) => item.key).sort();
  if (stored.length !== requested.length || stored.some((key, index) => key !== requested[index])) {
    throw new Error(`workflow ${runId} worker keys do not match the original run`);
  }
}

function workerRows(db: ReturnType<typeof connect>, runId: string): WorkerRow[] {
  return db
    .prepare(
      `SELECT worker_key, status, payload, result, error
       FROM workflow_workers
       WHERE run_id = ?
       ORDER BY created_at, worker_key`,
    )
    .all(runId)
    .map((row) => ({
      worker_key: String(row['worker_key']),
      status: String(row['status']),
      payload: String(row['payload']),
      result: typeof row['result'] === 'string' ? row['result'] : null,
      error: typeof row['error'] === 'string' ? row['error'] : null,
    }));
}

function runStatus(value: unknown): WorkflowStatus['status'] {
  if (value === 'running' || value === 'completed' || value === 'failed') return value;
  throw new Error(`workflow has an unknown status: ${String(value)}`);
}

function statusFor<R>(runId: string, path?: string): WorkflowStatus<R> {
  const db = connect(path);
  try {
    const run = db.prepare(`SELECT id, name, status FROM workflow_runs WHERE id = ?`).get(runId);
    if (!run) throw new Error(`workflow ${runId} not found`);
    const workers = workerRows(db, runId);
    const results = workers
      .filter((worker) => worker.status === 'completed' && worker.result !== null)
      .map((worker) => ({ key: worker.worker_key, value: parse<R>(worker.result ?? 'null') }));
    const errors = workers
      .filter((worker) => worker.status === 'failed' && worker.error)
      .map((worker) => ({
        key: worker.worker_key,
        message: worker.error ?? 'unknown worker error',
      }));
    return {
      id: String(run['id']),
      name: String(run['name']),
      status: runStatus(run['status']),
      done: results.length,
      failed: errors.length,
      total: workers.length,
      skipped: 0,
      results,
      errors,
    };
  } finally {
    db.close();
  }
}

export function getWorkflowStatus<R = unknown>(runId: string, path?: string): WorkflowStatus<R> {
  return statusFor(runId, path);
}

export function listWorkflows(path?: string, limit = 20): WorkflowChoice[] {
  const db = connect(path);
  try {
    return db
      .prepare(
        `SELECT id, name, status, updated_at
         FROM workflow_runs
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(limit)
      .map((row) => ({
        id: String(row['id']),
        name: String(row['name']),
        status: String(row['status']),
        updatedAt: String(row['updated_at']),
      }));
  } finally {
    db.close();
  }
}

export async function runWorkflow<T, R>(
  options: WorkflowOptions<T, R>,
): Promise<WorkflowStatus<R>> {
  const runId = options.id ?? randomUUID();
  const concurrency = options.concurrency ?? 4;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('workflow concurrency must be a positive integer');
  }
  const keys = new Set(options.items.map((item) => item.key));
  if (keys.size !== options.items.length) {
    throw new Error('workflow item keys must be unique');
  }
  const auditId = logRun(`workflow-${options.name}`, {
    status: 'invoked',
    context: { workflow_run_id: runId, workers: options.items.length, concurrency },
    path: options.path,
  });

  try {
    const db = connect(options.path);
    try {
      assertRunIdentity(db, runId, options.name, options.items);
      const now = timestamp();
      db.prepare(
        `INSERT INTO workflow_runs (id, name, status, context, created_at, updated_at)
         VALUES (?, ?, 'running', ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = 'running', updated_at = excluded.updated_at`,
      ).run(runId, options.name, serialize({ concurrency }), now, now);
      writeWorkers(db, runId, options.items);
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishRun(auditId, {
      status: 'failed',
      exitCode: 1,
      message: message.slice(0, 500),
      path: options.path,
    });
    throw error;
  }

  try {
    const initial = dbRows(runId, options.path);
    let next = 0;
    const skipped = initial.filter((row) => row.status === 'completed').length;
    const pending = initial.filter((row) => row.status !== 'completed');
    const execute = async (): Promise<void> => {
      while (true) {
        const row = pending[next];
        next += 1;
        if (!row) return;
        await runWorker(runId, row, options.worker, options.path);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, pending.length) }, () => execute()),
    );
    const result = statusFor<R>(runId, options.path);
    result.skipped = skipped;
    const completed = result.failed === 0 && result.done === result.total;
    const db = connect(options.path);
    try {
      db.prepare(`UPDATE workflow_runs SET status = ?, updated_at = ? WHERE id = ?`).run(
        completed ? 'completed' : 'failed',
        timestamp(),
        runId,
      );
    } finally {
      db.close();
    }
    result.status = completed ? 'completed' : 'failed';
    finishRun(auditId, {
      status: result.status,
      exitCode: completed ? 0 : 1,
      message: `${result.done}/${result.total} completed, ${result.failed} failed, ${skipped} skipped`,
      path: options.path,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishRun(auditId, {
      status: 'failed',
      exitCode: 1,
      message: message.slice(0, 500),
      path: options.path,
    });
    throw error;
  }
}

function dbRows(runId: string, path?: string): WorkerRow[] {
  const db = connect(path);
  try {
    return workerRows(db, runId);
  } finally {
    db.close();
  }
}

async function runWorker<T, R>(
  runId: string,
  row: WorkerRow,
  worker: WorkflowWorker<T, R>,
  path?: string,
): Promise<void> {
  let db = connect(path);
  try {
    db.prepare(
      `UPDATE workflow_workers
       SET status = 'running', attempts = attempts + 1, started_at = ?, updated_at = ?
       WHERE run_id = ? AND worker_key = ?`,
    ).run(timestamp(), timestamp(), runId, row.worker_key);
  } finally {
    db.close();
  }
  try {
    const result = await worker(parse<T>(row.payload));
    const serialized = serialize(result);
    db = connect(path);
    try {
      db.prepare(
        `UPDATE workflow_workers
         SET status = 'completed', result = ?, error = NULL, completed_at = ?, updated_at = ?
         WHERE run_id = ? AND worker_key = ?`,
      ).run(serialized, timestamp(), timestamp(), runId, row.worker_key);
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    db = connect(path);
    try {
      db.prepare(
        `UPDATE workflow_workers
         SET status = 'failed', error = ?, completed_at = ?, updated_at = ?
         WHERE run_id = ? AND worker_key = ?`,
      ).run(message.slice(0, 1000), timestamp(), timestamp(), runId, row.worker_key);
    } finally {
      db.close();
    }
  }
}
