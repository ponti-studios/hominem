import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import {
  createContainer,
  createPossession,
  listContainers,
  listPossessions,
  removeContainer,
  removePossession,
  updateContainer,
  updatePossession,
} from '../../application/possessions.service';
import {
  containerCreateSchema,
  containerUpdateSchema,
  possessionCreateSchema,
  possessionIdParamSchema,
  possessionListQuerySchema,
  possessionUpdateSchema,
} from '../../schemas/possessions.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';

// Thin adapter: validate, call the application service, return its DTOs.
export const possessionsRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', zValidator('query', possessionListQuerySchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({ possessions: await listPossessions(userId, c.req.valid('query')) });
  })
  .post('/', zValidator('json', possessionCreateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({ possession: await createPossession(userId, c.req.valid('json')) }, 201);
  })
  .get('/containers', async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({ containers: await listContainers(userId) });
  })
  .post('/containers', zValidator('json', containerCreateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({ container: await createContainer(userId, c.req.valid('json')) }, 201);
  })
  .patch(
    '/containers/:id',
    zValidator('param', possessionIdParamSchema),
    zValidator('json', containerUpdateSchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const { id } = c.req.valid('param');
      return c.json({ container: await updateContainer(userId, id, c.req.valid('json')) });
    },
  )
  .delete('/containers/:id', zValidator('param', possessionIdParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    await removeContainer(userId, c.req.valid('param').id);
    return c.json({ removed: true });
  })
  .patch(
    '/:id',
    zValidator('param', possessionIdParamSchema),
    zValidator('json', possessionUpdateSchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const { id } = c.req.valid('param');
      return c.json({ possession: await updatePossession(userId, id, c.req.valid('json')) });
    },
  )
  .delete('/:id', zValidator('param', possessionIdParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    await removePossession(userId, c.req.valid('param').id);
    return c.json({ removed: true });
  });
