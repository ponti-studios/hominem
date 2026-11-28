import { Hono } from 'hono';

import { runBrief } from '../../application/finance.wealth.brief.service';
import { runClose } from '../../application/finance.wealth.close.service';
import { runCheck } from '../../application/finance.wealth.integrity.service';
import { runLook } from '../../application/finance.wealth.look.service';
import {
  financeWealthBriefInputSchema,
  financeWealthBriefOutputSchema,
  financeWealthCloseInputSchema,
  financeWealthCloseOutputSchema,
  financeWealthIntegrityInputSchema,
  financeWealthIntegrityOutputSchema,
  financeWealthLookInputSchema,
  financeWealthLookOutputSchema,
} from '../../schemas/finance.wealth.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { zValidator } from '../validator';

export const wealthRoutes = new Hono<AppContext>()
  .post('/brief', authMiddleware, zValidator('json', financeWealthBriefInputSchema), async (c) =>
    c.json(
      financeWealthBriefOutputSchema.parse(
        await runBrief(c.get('auth')!.userId, c.req.valid('json')),
      ),
    ),
  )
  .post('/look', authMiddleware, zValidator('json', financeWealthLookInputSchema), async (c) =>
    c.json(
      financeWealthLookOutputSchema.parse(
        await runLook(c.get('auth')!.userId, c.req.valid('json')),
      ),
    ),
  )
  .post('/close', authMiddleware, zValidator('json', financeWealthCloseInputSchema), async (c) =>
    c.json(
      financeWealthCloseOutputSchema.parse(
        await runClose(c.get('auth')!.userId, c.req.valid('json')),
      ),
    ),
  )
  .post(
    '/integrity',
    authMiddleware,
    zValidator('json', financeWealthIntegrityInputSchema),
    async (c) =>
      c.json(
        financeWealthIntegrityOutputSchema.parse(
          await runCheck(c.get('auth')!.userId, c.req.valid('json')),
        ),
      ),
  );
