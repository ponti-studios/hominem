import type { ReminderRecord, RemindersPermissionStatus } from '~/modules/reminders';

import type { NewTaskInput } from '../sync/task-service';
import type { OutboxOp } from '../sync/task-store';

// What the Tasks tab shows about the one-time import.
export type ImportState = { kind: 'done' } | { kind: 'ask'; count: number | null };

interface RemindersSource {
  getPermission: () => Promise<RemindersPermissionStatus>;
  requestPermission: () => Promise<RemindersPermissionStatus>;
  listReminders: () => Promise<ReminderRecord[]>;
  deleteReminder: (id: string) => Promise<void>;
}

interface TaskSink {
  create: (input: NewTaskInput) => { id: string };
  outboxFor: (id: string) => OutboxOp[];
}

// Small key/value store; MMKV in the app, a map in tests.
interface ImportStorage {
  get: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

interface PendingRemoval {
  reminderId: string;
  taskId: string;
}

const DECISION_KEY = 'tasks.import.decision';
const PENDING_KEY = 'tasks.import.pending';

function readPending(storage: ImportStorage): PendingRemoval[] {
  const raw = storage.get(PENDING_KEY);
  if (!raw) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) {
      return [];
    }
    return value.flatMap((entry: unknown) => {
      if (typeof entry !== 'object' || entry === null) {
        return [];
      }
      const reminderId: unknown = Reflect.get(entry, 'reminderId');
      const taskId: unknown = Reflect.get(entry, 'taskId');
      return typeof reminderId === 'string' && typeof taskId === 'string'
        ? [{ reminderId, taskId }]
        : [];
    });
  } catch {
    return [];
  }
}

// The `code` RemindersModule.swift throws; importing the module's constant would
// load the native module into this otherwise pure file.
const REMINDER_NOT_FOUND = 'REMINDER_NOT_FOUND';

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && Reflect.get(error, 'code') === REMINDER_NOT_FOUND
  );
}

// Reminders become tasks once. The user chooses to import or start fresh; an
// import removes each reminder from Reminders so a task never lives in two
// places, but only after the server has accepted its task.
export function createRemindersImporter({
  reminders,
  tasks,
  storage,
}: {
  reminders: RemindersSource;
  tasks: TaskSink;
  storage: ImportStorage;
}) {
  const writePending = (pending: PendingRemoval[]) =>
    storage.set(PENDING_KEY, JSON.stringify(pending));

  async function openReminders(): Promise<ReminderRecord[]> {
    const open = await reminders.listReminders();
    return open.filter((reminder) => reminder.status === 'pending');
  }

  return {
    // Whether to ask. Nothing is asked once the user has chosen, when access
    // was refused, or when there is nothing to import.
    async state(): Promise<ImportState> {
      if (storage.get(DECISION_KEY)) {
        return { kind: 'done' };
      }
      const permission = await reminders.getPermission();
      if (permission === 'denied') {
        return { kind: 'done' };
      }
      if (permission === 'notDetermined') {
        return { kind: 'ask', count: null };
      }
      const count = (await openReminders()).length;
      if (count === 0) {
        storage.set(DECISION_KEY, 'fresh');
        return { kind: 'done' };
      }
      return { kind: 'ask', count };
    },

    // New account: forget the choice and any removals still waiting.
    reset() {
      storage.remove(DECISION_KEY);
      storage.remove(PENDING_KEY);
    },

    // Nothing in Reminders is touched.
    startFresh() {
      storage.set(DECISION_KEY, 'fresh');
    },

    // Returns how many tasks were created. Dated reminders keep their day;
    // undated ones land in the inbox.
    async importAll(): Promise<number> {
      const permission =
        (await reminders.getPermission()) === 'authorized'
          ? 'authorized'
          : await reminders.requestPermission();
      if (permission !== 'authorized') {
        return 0;
      }
      const open = await openReminders();
      const pending = readPending(storage);
      for (const reminder of open) {
        const task = tasks.create({
          title: reminder.title,
          notes: reminder.notes,
          startAt: reminder.startAt,
          dueAt: reminder.dueAt,
          location: reminder.location,
        });
        pending.push({ reminderId: reminder.id, taskId: task.id });
        // Written per reminder so a crash never forgets what was imported.
        writePending(pending);
      }
      storage.set(DECISION_KEY, 'imported');
      return open.length;
    },

    // Removes each imported reminder whose task the server has accepted. A task
    // the server refused keeps its reminder, so nothing is lost.
    async settle(): Promise<void> {
      const pending = readPending(storage);
      if (pending.length === 0 || (await reminders.getPermission()) !== 'authorized') {
        return;
      }
      const remaining: PendingRemoval[] = [];
      for (const entry of pending) {
        const ops = tasks.outboxFor(entry.taskId);
        if (ops.some((op) => op.status === 'failed')) {
          continue;
        }
        if (ops.length > 0) {
          remaining.push(entry);
          continue;
        }
        try {
          await reminders.deleteReminder(entry.reminderId);
        } catch (error) {
          // Already gone from Reminders counts as removed; anything else retries.
          if (!isNotFound(error)) {
            remaining.push(entry);
          }
        }
      }
      writePending(remaining);
    },
  };
}
