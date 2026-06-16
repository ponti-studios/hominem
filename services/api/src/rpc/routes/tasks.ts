import { db, TaskRepository } from '@hominem/db';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { CreateTaskSchema } from '../../schemas/tasks.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';

export const tasksRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .post('/', zValidator('json', CreateTaskSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');
    const task = await TaskRepository.create(db, {
      artifactType: input.artifactType,
      description: input.description ?? null,
      title: input.title,
      userId,
    });

    return c.json(task, 201);
  });
