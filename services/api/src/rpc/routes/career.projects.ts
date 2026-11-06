import { Hono } from 'hono';

import {
  getCareerProject,
  createCareerProject,
  listCareerProjects,
  removeCareerProject,
  updateCareerProject,
} from '../../application/career.service';
import {
  careerProjectCreateSchema,
  careerProjectDeleteSchema,
  careerProjectsQuerySchema,
  careerProjectUpdateSchema,
} from '../../schemas/career.schema';
import { NotFoundError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { zValidator } from '../validator';

export const careerProjectsRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', zValidator('query', careerProjectsQuerySchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json(await listCareerProjects(userId, c.req.valid('query')));
  })
  .get('/:id', async (c) => {
    const item = await getCareerProject(c.get('auth')!.userId, c.req.param('id'));
    if (!item) throw new NotFoundError('Project not found');
    return c.json(item);
  })
  .post('/create', zValidator('json', careerProjectCreateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const created = await createCareerProject(userId, c.req.valid('json'));
    return c.json(created, 201);
  })
  .post('/update', zValidator('json', careerProjectUpdateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { id, data } = c.req.valid('json');
    const updated = await updateCareerProject(userId, id, data);
    if (!updated) throw new NotFoundError('Project not found');
    return c.json(updated);
  })
  .post('/delete', zValidator('json', careerProjectDeleteSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const removed = await removeCareerProject(userId, c.req.valid('json').id);
    if (!removed) throw new NotFoundError('Project not found');
    return c.json({ removed });
  });
