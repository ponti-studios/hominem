import { getDb, TaskRepository } from '@hakumi/db';
import { TasksCreateInputSchema, type TasksCreateOutput } from '@hakumi/rpc/types';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { authMiddleware, type AppContext } from '../middleware/auth';

const createTaskSchema = TasksCreateInputSchema;

export const tasksRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .post('/', zValidator('json', createTaskSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');
    const task = await TaskRepository.create(getDb(), {
      artifactType: input.artifactType,
      description: input.description ?? null,
      title: input.title,
      userId,
    });

    return c.json<TasksCreateOutput>(task, 201);
  });
