import { toServerFields, type StoredTask } from './task-mapping';
import type { OutboxOp, TaskStore } from './task-store';
import { syncTasks, type SyncResult, type TaskSyncApi } from './task-sync';

export interface NewTaskInput {
  title: string;
  notes?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
  location?: string | null;
}

export type TaskPatch = Partial<
  Pick<NewTaskInput, 'title' | 'notes' | 'startAt' | 'dueAt' | 'location'>
>;

interface TaskServiceOptions {
  store: TaskStore;
  // Absent while signed out; edits still queue and sync later.
  getApi: () => TaskSyncApi | null;
  newId: () => string;
  now?: () => Date;
}

export interface TaskService {
  list(): StoredTask[];
  get(id: string): StoredTask | null;
  create(input: NewTaskInput): StoredTask;
  update(id: string, patch: TaskPatch): StoredTask;
  complete(id: string, completed: boolean): StoredTask;
  remove(id: string): void;
  sync(): Promise<SyncResult | null>;
  failedCount(): number;
  // Changes for this task the server has not accepted; empty once it is settled.
  outboxFor(id: string): OutboxOp[];
  subscribe(listener: () => void): () => void;
}

// The only door to tasks for the UI. Reads come from the local store, writes
// land there first and queue for the server, so every call works offline.
export function createTaskService({
  store,
  getApi,
  newId,
  now = () => new Date(),
}: TaskServiceOptions): TaskService {
  const listeners = new Set<() => void>();
  let inFlight: Promise<SyncResult | null> | null = null;
  let resync = false;

  const notify = () => listeners.forEach((listener) => listener());

  function sync(): Promise<SyncResult | null> {
    const api = getApi();
    if (!api) {
      return Promise.resolve(null);
    }
    if (inFlight) {
      // A change landed mid-sync; run once more afterwards to pick it up.
      resync = true;
      return inFlight;
    }
    inFlight = (async () => {
      try {
        let result = await syncTasks(api, store);
        // `resync` is set only by an explicit request made mid-sync (a change or a
        // reconnect), so rerunning even after an offline result cannot loop.
        while (resync) {
          resync = false;
          result = await syncTasks(api, store);
        }
        return result;
      } finally {
        inFlight = null;
        resync = false;
        notify();
      }
    })();
    return inFlight;
  }

  function requireTask(id: string) {
    const task = store.getTask(id);
    if (!task || task.deletedAt) {
      throw new Error(`Task ${id} not found`);
    }
    return task;
  }

  function changed() {
    notify();
    void sync();
  }

  return {
    list: () => store.listTasks(),
    get: (id) => {
      const task = store.getTask(id);
      return task && !task.deletedAt ? task : null;
    },
    create: (input) => {
      // No date is fine: an undated task waits in the inbox until it is triaged.
      const startAt = input.startAt ?? null;
      const dueAt = input.dueAt ?? null;
      const task: StoredTask = {
        id: newId(),
        title: input.title.trim(),
        notes: input.notes ?? null,
        status: 'pending',
        completedAt: null,
        priority: 'none',
        startAt,
        dueAt,
        location: input.location ?? null,
        listTitle: null,
        createdAt: now().toISOString(),
        updatedAt: null,
        deletedAt: null,
      };
      store.putTask(task);
      store.enqueue(task.id, { kind: 'create', fields: toServerFields(task) });
      changed();
      return task;
    },
    update: (id, patch) => {
      const current = requireTask(id);
      const next: StoredTask = { ...current, ...patch };
      store.putTask(next);
      store.enqueue(id, { kind: 'update', fields: toServerFields(next) });
      changed();
      return next;
    },
    complete: (id, completed) => {
      const current = requireTask(id);
      const next: StoredTask = {
        ...current,
        status: completed ? 'completed' : 'pending',
        completedAt: completed ? now().toISOString() : null,
      };
      store.putTask(next);
      store.enqueue(id, { kind: 'complete', completed });
      changed();
      return next;
    },
    remove: (id) => {
      requireTask(id);
      store.removeTask(id);
      store.enqueue(id, { kind: 'delete' });
      changed();
    },
    sync,
    outboxFor: (id) => store.listOps().filter((op) => op.taskId === id),
    failedCount: () => store.listOps().filter((op) => op.status === 'failed').length,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
