import { ValidationError } from '@hominem/db/errors';
import { Hono } from 'hono';

import { uploadCareerProfileImage } from '../../application/career-profile-image.service';
import {
  deleteCareerProfile,
  getCareerProfile,
  getCareerProfileDetail,
  isCareerSlugAvailable,
  updateCareerProfileDetail,
} from '../../application/career.service';
import {
  careerProfileDetailOutputSchema,
  careerProfileWriteSchema,
  careerSlugAvailabilityOutputSchema,
  careerSlugAvailabilityQuerySchema,
} from '../../schemas/career.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { zValidator } from '../validator';

export const careerProfileRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    const userId = c.get('auth')!.userId;
    const profile = await getCareerProfile(userId);
    return c.json({ profile });
  })
  // Full profile for the browser editor (email, phone, slug, visibility, portfolio copy).
  .get('/detail', async (c) => {
    const userId = c.get('auth')!.userId;
    const profile = await getCareerProfileDetail(userId);
    return c.json(careerProfileDetailOutputSchema.parse({ profile }));
  })
  .patch('/', zValidator('json', careerProfileWriteSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const profile = await updateCareerProfileDetail(userId, c.req.valid('json'));
    return c.json(careerProfileDetailOutputSchema.parse({ profile }));
  })
  .get('/slug-available', zValidator('query', careerSlugAvailabilityQuerySchema), async (c) => {
    const { slug, currentProfileId } = c.req.valid('query');
    const isAvailable = await isCareerSlugAvailable(slug, currentProfileId);
    return c.json(careerSlugAvailabilityOutputSchema.parse({ slug, isAvailable }));
  })
  .delete('/', async (c) => {
    const deleted = await deleteCareerProfile(c.get('auth')!.userId);
    return c.json({ deleted });
  })
  .post('/image', async (c) => {
    const formData = await c.req.formData();
    const image = formData.get('image');
    if (!(image instanceof File)) {
      throw new ValidationError('Choose an image to upload.');
    }
    return c.json(await uploadCareerProfileImage(c.get('auth')!.userId, image));
  });
