import { Hono } from 'hono';

import {
  getCareerTestimonial,
  createCareerTestimonial,
  listCareerTestimonials,
  removeCareerTestimonial,
  updateCareerTestimonial,
} from '../../application/career.service';
import {
  careerTestimonialCreateSchema,
  careerTestimonialDeleteSchema,
  careerTestimonialUpdateSchema,
} from '../../schemas/career.schema';
import { NotFoundError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { zValidator } from '../validator';

export const careerTestimonialsRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json(await listCareerTestimonials(userId));
  })
  .get('/:id', async (c) => {
    const item = await getCareerTestimonial(c.get('auth')!.userId, c.req.param('id'));
    if (!item) throw new NotFoundError('Testimonial not found');
    return c.json(item);
  })
  .post('/create', zValidator('json', careerTestimonialCreateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const created = await createCareerTestimonial(userId, c.req.valid('json'));
    return c.json(created, 201);
  })
  .post('/update', zValidator('json', careerTestimonialUpdateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { id, data } = c.req.valid('json');
    const updated = await updateCareerTestimonial(userId, id, data);
    if (!updated) throw new NotFoundError('Testimonial not found');
    return c.json(updated);
  })
  .post('/delete', zValidator('json', careerTestimonialDeleteSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    await removeCareerTestimonial(userId, c.req.valid('json').id);
    return c.json({ success: true });
  });
