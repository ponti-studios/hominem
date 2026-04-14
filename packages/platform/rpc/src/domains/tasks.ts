import type { RawHonoClient } from '../core/raw-client';
import type { TasksCreateInput, TasksCreateOutput } from '../types/tasks.types';

export interface TasksClient {
  create(input: TasksCreateInput): Promise<TasksCreateOutput>;
}

export function createTasksClient(rawClient: RawHonoClient): TasksClient {
  return {
    async create(input) {
      const res = await rawClient.post('/api/tasks', { json: input });
      return res.json() as Promise<TasksCreateOutput>;
    },
  };
}
