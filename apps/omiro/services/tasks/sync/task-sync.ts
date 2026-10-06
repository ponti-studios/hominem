import type { TaskChange } from '@hominem/rpc/types';

import { fromServerTask, type ServerTaskFields } from './task-mapping';
import type { OutboxOp, TaskStore } from './task-store';

// Thrown by a TaskSyncApi when the server answered. Anything else thrown (a
// failed fetch, a timeout) is treated as "offline: try again later".
export class TaskSyncHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'TaskSyncHttpError';
  }
}

export interface TaskChangesPage {
  tasks: TaskChange[];
  cursor: string | null;
  hasMore: boolean;
}

export interface TaskSyncApi {
  changes(since: string | null): Promise<TaskChangesPage>;
  create(id: string, fields: ServerTaskFields): Promise<void>;
  update(id: string, fields: Partial<ServerTaskFields>): Promise<void>;
  complete(id: string, completed: boolean): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface SyncResult {
  // False when a request failed without a server answer; the outbox is intact.
  online: boolean;
  pushed: number;
  // Ops the server refused for good and that now wait for the user.
  failed: number;
  pulled: number;
}

async function sendOp(api: TaskSyncApi, op: OutboxOp) {
  switch (op.payload.kind) {
    case 'create':
      return api.create(op.taskId, op.payload.fields);
    case 'update':
      return api.update(op.taskId, op.payload.fields);
    case 'complete':
      return api.complete(op.taskId, op.payload.completed);
    case 'delete':
      return api.remove(op.taskId);
  }
}

// A 404 on anything but a create means the task is already gone on the
// server, which is the outcome the op wanted (or makes it moot).
function isSatisfiedByNotFound(op: OutboxOp, error: TaskSyncHttpError) {
  return error.status === 404 && op.payload.kind !== 'create';
}

async function push(api: TaskSyncApi, store: TaskStore) {
  let pushed = 0;
  const failedCount = () => store.listOps().filter((op) => op.status === 'failed').length;
  // A task whose op failed for good blocks its later ops: replaying an edit
  // onto a create the server refused would only fail again.
  const blocked = new Set<string>();

  for (const op of store.listOps()) {
    if (op.status === 'failed') {
      blocked.add(op.taskId);
      continue;
    }
    if (blocked.has(op.taskId)) {
      continue;
    }
    try {
      await sendOp(api, op);
      store.removeOp(op.id);
      pushed += 1;
    } catch (error) {
      if (!(error instanceof TaskSyncHttpError)) {
        return { online: false, pushed, failed: failedCount() };
      }
      if (isSatisfiedByNotFound(op, error)) {
        store.removeOp(op.id);
        continue;
      }
      if (error.status >= 500 || error.status === 429) {
        return { online: false, pushed, failed: failedCount() };
      }
      store.failOp(op.id, error.message);
      blocked.add(op.taskId);
    }
  }
  return { online: true, pushed, failed: failedCount() };
}

async function pull(api: TaskSyncApi, store: TaskStore) {
  let pulled = 0;
  for (;;) {
    const page = await api.changes(store.getCursor());
    // Local edits that have not reached the server win until they have: the
    // server row is re-pulled once the push bumps its updatedAt.
    const pendingTaskIds = new Set(store.listOps().map((op) => op.taskId));
    for (const record of page.tasks) {
      pulled += 1;
      if (pendingTaskIds.has(record.id)) {
        continue;
      }
      if (record.deletedAt) {
        store.removeTask(record.id);
      } else {
        store.putTask(fromServerTask(record));
      }
    }
    if (page.cursor) {
      store.setCursor(page.cursor);
    }
    if (!page.hasMore) {
      return pulled;
    }
  }
}

// Pushes the outbox, then pulls everything that changed. Never throws: a
// network failure just reports `online: false` and leaves the outbox alone.
export async function syncTasks(api: TaskSyncApi, store: TaskStore): Promise<SyncResult> {
  const pushResult = await push(api, store);
  if (!pushResult.online) {
    return { ...pushResult, pulled: 0 };
  }
  try {
    return { ...pushResult, pulled: await pull(api, store) };
  } catch {
    return { ...pushResult, online: false, pulled: 0 };
  }
}
