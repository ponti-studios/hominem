import { getDb, TaskRepository } from '@hominem/db';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { authMiddleware, type AppContext } from '../middleware/auth';

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().optional().nullable(),
  artifactType: z.enum(['task', 'task_list']),
});

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

    return c.json(task, 201);
  });
