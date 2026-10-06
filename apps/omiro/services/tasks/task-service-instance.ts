import { randomUUID } from 'expo-crypto';

import { openTasksDatabase } from './sync/expo-sqlite-driver';
import { createSqliteTaskStore } from './sync/sqlite-task-store';
import { createTaskService, type TaskService } from './sync/task-service';
import type { TaskSyncApi } from './sync/task-sync';

// One service for the whole app. The database opens on first use, not at
// import, so tests and the signed-out screens never touch it.
let service: TaskService | null = null;
let api: TaskSyncApi | null = null;
let clearStore: (() => void) | null = null;
const cleanups = new Set<() => void>();

// Other per-account task state (the Reminders import) registers here so
// sign-out clears it with the tasks.
export function onTaskDataCleared(cleanup: () => void) {
  cleanups.add(cleanup);
  return () => {
    cleanups.delete(cleanup);
  };
}

export function getTaskService(): TaskService {
  if (!service) {
    const store = createSqliteTaskStore(openTasksDatabase());
    clearStore = () => store.clear();
    service = createTaskService({
      store,
      getApi: () => api,
      newId: () => randomUUID(),
    });
  }
  return service;
}

// Set while a user is signed in and the API client exists; edits made without
// it stay queued.
export function setTaskSyncApi(next: TaskSyncApi | null) {
  api = next;
}

// Sign-out: drop the tasks and the queue so the next account starts clean.
export function clearTaskData() {
  // Opens the database if this launch has not yet: the previous session's
  // rows are on disk either way.
  getTaskService();
  clearStore?.();
  cleanups.forEach((cleanup) => cleanup());
}
