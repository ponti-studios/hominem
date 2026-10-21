import { affordabilityCheckInputSchema, calculateAffordability } from '@hominem/finance-services';
import { Hono } from 'hono';

import { authMiddleware } from '../middleware/auth';
import type { AppContext } from '../middleware/auth';
import { zValidator } from '../validator';

const affordabilityInputSchema = affordabilityCheckInputSchema;

export const affordabilityRoutes = new Hono<AppContext>().post(
  '/check',
  authMiddleware,
  zValidator('json', affordabilityInputSchema),
  async (c) => {
    const input = c.req.valid('json');
    const parsed = affordabilityCheckInputSchema.parse(input);
    return c.json(calculateAffordability(parsed));
  },
);
