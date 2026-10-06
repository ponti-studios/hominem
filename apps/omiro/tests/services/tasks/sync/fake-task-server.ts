import type { TaskChange } from '@hominem/rpc/types';

import type { ServerTaskFields } from '~/services/tasks/sync/task-mapping';
import {
  TaskSyncHttpError,
  type TaskChangesPage,
  type TaskSyncApi,
} from '~/services/tasks/sync/task-sync';

// A tiny stand-in for the tasks API: idempotent creates, tombstones, and a
// cursor feed, so the sync engine is tested against the contract it relies on.
export function createFakeTaskServer() {
  const rows = new Map<string, TaskChange>();
  let clock = 0;
  const calls: string[] = [];
  let offline = false;
  let refuseCreates: { status: number; message: string } | null = null;
  let pageSize = 500;

  const tick = () => new Date(Date.UTC(2026, 9, 6, 12, 0, 0, ++clock)).toISOString();

  function row(id: string): TaskChange {
    const existing = rows.get(id);
    if (!existing || existing.deletedAt) {
      throw new TaskSyncHttpError(404, 'Task not found');
    }
    return existing;
  }

  function write(id: string, patch: Partial<TaskChange>) {
    const existing = rows.get(id);
    if (!existing) {
      throw new TaskSyncHttpError(404, 'Task not found');
    }
    const next: TaskChange = { ...existing, ...patch, updatedAt: tick() };
    rows.set(id, next);
    return next;
  }

  function guard(call: string) {
    calls.push(call);
    if (offline) {
      throw new TypeError('Network request failed');
    }
  }

  const api: TaskSyncApi = {
    changes: async (since): Promise<TaskChangesPage> => {
      guard('changes');
      const sorted = [...rows.values()].sort((a, b) =>
        `${a.updatedAt}_${a.id}`.localeCompare(`${b.updatedAt}_${b.id}`),
      );
      const after = since ? sorted.filter((r) => `${r.updatedAt}_${r.id}` > since) : sorted;
      const tasks = after.slice(0, pageSize);
      const last = tasks.at(-1);
      return {
        tasks,
        cursor: last ? `${last.updatedAt}_${last.id}` : null,
        hasMore: after.length > pageSize,
      };
    },
    create: async (id: string, fields: ServerTaskFields) => {
      guard(`create:${id}`);
      if (refuseCreates) {
        throw new TaskSyncHttpError(refuseCreates.status, refuseCreates.message);
      }
      if (rows.has(id)) {
        return;
      }
      const now = tick();
      rows.set(id, {
        id,
        ownerUserId: 'user',
        parentTaskId: null,
        status: 'pending',
        priority: 'medium',
        durationMinutes: null,
        schedulingWindowStartAt: null,
        schedulingWindowEndAt: null,
        timeZone: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        artifactType: 'task',
        title: fields.title,
        description: fields.description,
        dueAt: fields.dueAt,
        scheduledStartAt: fields.scheduledStartAt,
        scheduledEndAt: fields.scheduledEndAt,
        location: fields.location,
      });
    },
    update: async (id, fields) => {
      guard(`update:${id}`);
      row(id);
      write(id, fields);
    },
    complete: async (id, completed) => {
      guard(`complete:${id}`);
      row(id);
      write(id, {
        status: completed ? 'completed' : 'pending',
        completedAt: completed ? tick() : null,
      });
    },
    remove: async (id) => {
      guard(`remove:${id}`);
      row(id);
      write(id, { deletedAt: tick() });
    },
  };

  return {
    api,
    calls,
    rows,
    setOffline: (value: boolean) => {
      offline = value;
    },
    refuseCreates: (value: { status: number; message: string } | null) => {
      refuseCreates = value;
    },
    setPageSize: (value: number) => {
      pageSize = value;
    },
    // A change made on another device.
    editElsewhere: (id: string, patch: Partial<TaskChange>) => write(id, patch),
    deleteElsewhere: (id: string) => write(id, { deletedAt: tick() }),
  };
}
