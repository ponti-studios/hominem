import { db } from '@hominem/db/core';
import { ContainerRepository, PossessionRepository } from '@hominem/db/possessions';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import {
  containerCreateSchema,
  containerUpdateSchema,
  possessionCreateSchema,
  possessionListQuerySchema,
  possessionUpdateSchema,
} from '../../schemas/possessions.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';

// Zod's optional fields are `T | undefined`; the repository treats undefined as "leave alone".
export const possessionsRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', zValidator('query', possessionListQuerySchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { status, archived, containerId, limit } = c.req.valid('query');
    const possessions = await PossessionRepository.list(db, {
      userId,
      ...(status.length ? { statuses: status } : {}),
      ...(archived ? { archived: archived === 'true' } : {}),
      ...(containerId ? { containerId } : {}),
      ...(limit ? { limit } : {}),
    });
    return c.json({ possessions });
  })
  .post('/', zValidator('json', possessionCreateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json(
      { possession: await PossessionRepository.create(db, userId, c.req.valid('json')) },
      201,
    );
  })
  .get('/containers', async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({ containers: await ContainerRepository.list(db, userId) });
  })
  .post('/containers', zValidator('json', containerCreateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json(
      { container: await ContainerRepository.create(db, userId, c.req.valid('json')) },
      201,
    );
  })
  .patch('/containers/:id', zValidator('json', containerUpdateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({
      container: await ContainerRepository.update(
        db,
        userId,
        c.req.param('id'),
        c.req.valid('json'),
      ),
    });
  })
  .delete('/containers/:id', async (c) => {
    const userId = c.get('auth')!.userId;
    await ContainerRepository.remove(db, userId, c.req.param('id'));
    return c.json({ removed: true });
  })
  .patch('/:id', zValidator('json', possessionUpdateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({
      possession: await PossessionRepository.update(
        db,
        userId,
        c.req.param('id'),
        c.req.valid('json'),
      ),
    });
  })
  .delete('/:id', async (c) => {
    const userId = c.get('auth')!.userId;
    await PossessionRepository.remove(db, userId, c.req.param('id'));
    return c.json({ removed: true });
  });
