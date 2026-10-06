import type { ServerTaskFields, StoredTask } from './task-mapping';

export type OutboxPayload =
  | { kind: 'create'; fields: ServerTaskFields }
  | { kind: 'update'; fields: Partial<ServerTaskFields> }
  | { kind: 'complete'; completed: boolean }
  | { kind: 'delete' };

export type OutboxKind = OutboxPayload['kind'];

export interface OutboxOp {
  id: number;
  taskId: string;
  payload: OutboxPayload;
  createdAt: string;
  // A pending op is retried on every sync; a failed one was refused by the
  // server for good (for example a task with no date) and waits for the user.
  status: 'pending' | 'failed';
  failedReason: string | null;
}

// The device's copy of the user's tasks plus the queue of changes the server
// has not accepted yet. Synchronous because every implementation is local.
export interface TaskStore {
  listTasks(): StoredTask[];
  getTask(id: string): StoredTask | null;
  putTask(task: StoredTask): void;
  removeTask(id: string): void;

  getCursor(): string | null;
  setCursor(cursor: string | null): void;

  enqueue(taskId: string, payload: OutboxPayload): OutboxOp;
  listOps(): OutboxOp[];
  removeOp(id: number): void;
  failOp(id: number, reason: string): void;

  clear(): void;
}
