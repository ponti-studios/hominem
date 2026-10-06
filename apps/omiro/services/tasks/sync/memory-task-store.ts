import type { StoredTask } from './task-mapping';
import type { OutboxOp, OutboxPayload, TaskStore } from './task-store';

// In-memory store for tests and as the reference behavior the SQLite store
// must match.
export function createMemoryTaskStore(): TaskStore {
  const tasks = new Map<string, StoredTask>();
  let ops: OutboxOp[] = [];
  let cursor: string | null = null;
  let nextOpId = 1;

  return {
    // Dated tasks by when they happen, then undated ones by when they were added.
    listTasks: () =>
      [...tasks.values()]
        .filter((task) => task.deletedAt === null)
        .sort((a, b) => {
          const aWhen = a.startAt ?? a.dueAt;
          const bWhen = b.startAt ?? b.dueAt;
          if (aWhen && bWhen) {
            return aWhen.localeCompare(bWhen);
          }
          if (aWhen || bWhen) {
            return aWhen ? -1 : 1;
          }
          return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
        }),
    getTask: (id) => tasks.get(id) ?? null,
    putTask: (task) => {
      tasks.set(task.id, task);
    },
    removeTask: (id) => {
      tasks.delete(id);
    },
    getCursor: () => cursor,
    setCursor: (next) => {
      cursor = next;
    },
    enqueue: (taskId: string, payload: OutboxPayload) => {
      const op: OutboxOp = {
        id: nextOpId++,
        taskId,
        payload,
        createdAt: new Date().toISOString(),
        status: 'pending',
        failedReason: null,
      };
      ops.push(op);
      return op;
    },
    listOps: () => [...ops],
    removeOp: (id) => {
      ops = ops.filter((op) => op.id !== id);
    },
    failOp: (id, reason) => {
      ops = ops.map((op) =>
        op.id === id ? { ...op, status: 'failed', failedReason: reason } : op,
      );
    },
    clear: () => {
      tasks.clear();
      ops = [];
      cursor = null;
    },
  };
}
