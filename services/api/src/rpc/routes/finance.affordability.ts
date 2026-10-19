import { affordabilityCheckInputSchema, calculateAffordability } from '@hominem/finance-services';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { authMiddleware } from '../middleware/auth';
import type { AppContext } from '../middleware/auth';

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
