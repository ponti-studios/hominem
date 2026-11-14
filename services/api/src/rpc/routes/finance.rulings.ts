import { Hono } from 'hono';

import {
  getLatestRulings,
  listRulingQueue,
  prepareRulings,
  queueRulingVerdict,
} from '../../application/finance.rulings.service';
import { rulingVerdictInputSchema } from '../../schemas/finance.rulings.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { zValidator } from '../validator';

export const rulingsRoutes = new Hono<AppContext>()
  .get('/queue', authMiddleware, async (c) =>
    c.json(await listRulingQueue(c.get('auth')!.userId, 0, Number.MAX_SAFE_INTEGER)),
  )
  .get('/current', authMiddleware, async (c) =>
    c.json(await getLatestRulings(c.get('auth')!.userId)),
  )
  .post('/prepare', authMiddleware, async (c) =>
    c.json(await prepareRulings(c.get('auth')!.userId)),
  )
  .post('/verdict', authMiddleware, zValidator('json', rulingVerdictInputSchema), async (c) => {
    const input = c.req.valid('json');
    return c.json(await queueRulingVerdict(c.get('auth')!.userId, input));
  });
