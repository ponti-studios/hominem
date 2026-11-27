import { Hono } from 'hono';

import {
  attachPossessionImage,
  bulkUpsertPossessions,
  createContainer,
  createPossession,
  getPossessionHistory,
  imagesByPossession,
  listContainers,
  listPossessionImages,
  listPossessions,
  removeContainer,
  removePossession,
  removePossessionImage,
  reorderPossessionImages,
  updateContainer,
  updatePossession,
  upsertContainer,
  upsertPossession,
  validatePossessions,
  vesselWeightReport,
} from '../../application/possessions.service';
import {
  containerCreateSchema,
  containerUpdateSchema,
  containerUpsertSchema,
  possessionBulkUpsertSchema,
  possessionCreateSchema,
  possessionHistoryQuerySchema,
  possessionIdParamSchema,
  possessionImageAttachSchema,
  possessionImageOrderSchema,
  possessionImageParamSchema,
  possessionListQuerySchema,
  possessionUpdateSchema,
  possessionUpsertSchema,
  possessionValidateQuerySchema,
} from '../../schemas/possessions.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { zValidator } from '../validator';

// Thin adapter: validate, call the application service, return its DTOs.
export const possessionsRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', zValidator('query', possessionListQuerySchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const possessions = await listPossessions(userId, c.req.valid('query'));
    // Photos ride along as an additive top-level map so old clients keep working.
    const images = await imagesByPossession(
      userId,
      possessions.map((p) => p.id),
    );
    return c.json({ possessions, images });
  })
  .post('/', zValidator('json', possessionCreateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({ possession: await createPossession(userId, c.req.valid('json')) }, 201);
  })
  .post('/upsert', zValidator('json', possessionUpsertSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json(await upsertPossession(userId, c.req.valid('json')));
  })
  .post('/bulk-upsert', zValidator('json', possessionBulkUpsertSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({ results: await bulkUpsertPossessions(userId, c.req.valid('json').items) });
  })
  .get('/weight-report', async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({ report: await vesselWeightReport(userId) });
  })
  .get('/validate', zValidator('query', possessionValidateQuerySchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json(await validatePossessions(userId, c.req.valid('query')));
  })
  .get('/containers', async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({ containers: await listContainers(userId) });
  })
  .post('/containers', zValidator('json', containerCreateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({ container: await createContainer(userId, c.req.valid('json')) }, 201);
  })
  .post('/containers/upsert', zValidator('json', containerUpsertSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json(await upsertContainer(userId, c.req.valid('json')));
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
  .get(
    '/:id/history',
    zValidator('param', possessionIdParamSchema),
    zValidator('query', possessionHistoryQuerySchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const { id } = c.req.valid('param');
      return c.json({
        events: await getPossessionHistory(userId, id, c.req.valid('query').limit),
      });
    },
  )
  .get('/:id/images', zValidator('param', possessionIdParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json({ images: await listPossessionImages(userId, c.req.valid('param').id) });
  })
  .post(
    '/:id/images',
    zValidator('param', possessionIdParamSchema),
    zValidator('json', possessionImageAttachSchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const image = await attachPossessionImage(
        userId,
        c.req.valid('param').id,
        c.req.valid('json'),
      );
      return c.json({ image }, 201);
    },
  )
  .put(
    '/:id/images/order',
    zValidator('param', possessionIdParamSchema),
    zValidator('json', possessionImageOrderSchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const { id } = c.req.valid('param');
      await reorderPossessionImages(userId, id, c.req.valid('json').imageIds);
      return c.json({ images: await listPossessionImages(userId, id) });
    },
  )
  .delete('/:id/images/:imageId', zValidator('param', possessionImageParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { id, imageId } = c.req.valid('param');
    await removePossessionImage(userId, id, imageId);
    return c.json({ removed: true });
  })
  .delete('/:id', zValidator('param', possessionIdParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    await removePossession(userId, c.req.valid('param').id);
    return c.json({ removed: true });
  });
