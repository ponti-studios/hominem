import type { HonoClient } from '@hominem/rpc';

import { parseApiError } from '~/services/api/parse-api-error';

import { TaskSyncHttpError, type TaskSyncApi } from './task-sync';

interface ApiResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

// Turns a non-2xx answer into a TaskSyncHttpError. A thrown fetch (no
// answer at all) is left alone: the engine reads that as "offline".
async function assertOk(response: ApiResponseLike) {
  if (response.ok) {
    return;
  }
  const body = await parseApiError(response);
  const message =
    typeof body.error === 'string'
      ? body.error
      : typeof body.message === 'string'
        ? body.message
        : `Request failed (${response.status})`;
  throw new TaskSyncHttpError(response.status, message);
}

export function createRpcTaskSyncApi(client: HonoClient): TaskSyncApi {
  return {
    changes: async (since) => {
      const response = await client.api.tasks.changes.$get({
        query: since ? { since } : {},
      });
      await assertOk(response);
      return response.json();
    },
    create: async (id, fields) => {
      await assertOk(
        await client.api.tasks.$post({ json: { id, artifactType: 'task', ...fields } }),
      );
    },
    update: async (id, fields) => {
      await assertOk(await client.api.tasks[':id'].$patch({ param: { id }, json: fields }));
    },
    complete: async (id, completed) => {
      await assertOk(
        await client.api.tasks[':id'].complete.$patch({ param: { id }, json: { completed } }),
      );
    },
    remove: async (id) => {
      await assertOk(await client.api.tasks[':id'].$delete({ param: { id } }));
    },
  };
}
