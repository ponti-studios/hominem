import { NotFoundError } from '@hominem/db/errors';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import {
  completeTask,
  createTask,
  deleteTask,
  getTaskDetail,
  listTaskChanges,
  listTasks,
  persistExtractedTasks,
  updateTask,
} from '../../application/task.service';
import {
  CreateTaskBatchSchema,
  CreateTaskSchema,
  TaskChangesQuerySchema,
  TaskParamSchema,
  UpdateTaskSchema,
  UpdateTaskStatusSchema,
} from '../../schemas/tasks.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { taskExtractRoutes } from './tasks.extract';
import { timeBlockRoutes } from './tasks.parse';

const taskCoreRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    const userId = c.get('auth')!.userId;
    const tasks = await listTasks(userId);
    return c.json({ tasks });
  })
  .post('/', zValidator('json', CreateTaskSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const task = await createTask(userId, c.req.valid('json'));
    return c.json(task, 201);
  })
  .post('/batch', zValidator('json', CreateTaskBatchSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { groups, tasks } = c.req.valid('json');

    const result = await persistExtractedTasks(userId, { groups, tasks });
    return c.json(result, 201);
  })
  // Registered before '/:id' so "changes" is not parsed as a task id.
  .get('/changes', zValidator('query', TaskChangesQuerySchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json(await listTaskChanges(userId, c.req.valid('query')));
  })
  .get('/:id', zValidator('param', TaskParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { id } = c.req.valid('param');

    const { task, participants, children } = await getTaskDetail(userId, id);
    if (!task) throw new NotFoundError('Task', { taskId: id });
    return c.json({ task, participants, children });
  })
  .patch(
    '/:id/complete',
    zValidator('param', TaskParamSchema),
    zValidator('json', UpdateTaskStatusSchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const { id } = c.req.valid('param');
      const { completed } = c.req.valid('json');

      const task = await completeTask(userId, id, completed);
      if (!task) throw new NotFoundError('Task', { taskId: id });
      return c.json(task);
    },
  )
  .patch(
    '/:id',
    zValidator('param', TaskParamSchema),
    zValidator('json', UpdateTaskSchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const { id } = c.req.valid('param');
      const patch = c.req.valid('json');

      const task = await updateTask(userId, id, patch);
      if (!task) throw new NotFoundError('Task', { taskId: id });
      return c.json(task);
    },
  )
  .delete('/:id', zValidator('param', TaskParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { id } = c.req.valid('param');

    const removed = await deleteTask(userId, id);
    if (!removed) throw new NotFoundError('Task', { taskId: id });
    return c.json({ removed });
  });

// Composition root for everything mounted at /tasks (see app.ts).
// AI endpoints live in their own modules; paths and behavior are unchanged.
export const tasksRoutes = new Hono<AppContext>()
  .route('/', taskCoreRoutes)
  .route('/', taskExtractRoutes)
  .route('/', timeBlockRoutes);
