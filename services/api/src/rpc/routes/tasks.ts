import { db, runInTransaction, TaskRepository } from '@hominem/db';
import { extractTasks } from '@hominem/ai';
import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import {
  CreateTaskBatchSchema,
  CreateTaskSchema,
  ExtractTasksInputSchema,
  TaskParamSchema,
  UpdateTaskStatusSchema,
} from '../../schemas/tasks.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { loadPrompt } from '../utils/load-prompt';

const TASK_EXTRACTION_SYSTEM_PROMPT = loadPrompt('task-extraction');

function buildTaskListTitle(tasks: { title: string }[]): string {
  return tasks.length === 1 ? tasks[0].title : `${tasks.length} tasks`;
}

export const tasksRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    const userId = c.get('userId')!;
    const tasks = await TaskRepository.list(db, { userId });
    return c.json({ tasks });
  })
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
  })
  .use('/extract', rateLimitMiddleware({ bucket: 'ai-task-extract', windowSec: 60, max: 20 }))
  .post('/extract', zValidator('json', ExtractTasksInputSchema), async (c) => {
    const { transcript } = c.req.valid('json');

    try {
      const { tasks } = await extractTasks({ transcript }, TASK_EXTRACTION_SYSTEM_PROMPT);
      return c.json({ tasks });
    } catch (error) {
      logger.error('[ai/tasks/extract] OpenRouter error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return c.json({ error: 'Task extraction failed' }, 500);
    }
  })
  .post('/batch', zValidator('json', CreateTaskBatchSchema), async (c) => {
    const userId = c.get('userId')!;
    const { tasks } = c.req.valid('json');

    if (tasks.length === 1) {
      const task = await TaskRepository.create(db, {
        artifactType: 'task',
        description: tasks[0].description ?? null,
        title: tasks[0].title,
        userId,
      });
      return c.json({ parent: null, tasks: [task] }, 201);
    }

    const result = await runInTransaction((trx) =>
      TaskRepository.createBatch(trx, {
        userId,
        parentTitle: buildTaskListTitle(tasks),
        tasks,
      }),
    );

    return c.json(result, 201);
  })
  .get('/:id', zValidator('param', TaskParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');

    const task = await TaskRepository.load(db, id, userId);
    const children =
      task.artifactType === 'task_list'
        ? await TaskRepository.listChildren(db, { parentId: id, userId })
        : [];

    return c.json({ task, children });
  })
  .patch(
    '/:id/complete',
    zValidator('param', TaskParamSchema),
    zValidator('json', UpdateTaskStatusSchema),
    async (c) => {
      const userId = c.get('userId')!;
      const { id } = c.req.valid('param');
      const { completed } = c.req.valid('json');

      const task = await TaskRepository.setCompleted(db, id, userId, completed);
      return c.json(task);
    },
  )
  .delete('/:id', zValidator('param', TaskParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');

    const task = await TaskRepository.remove(db, id, userId);
    return c.json(task);
  });
