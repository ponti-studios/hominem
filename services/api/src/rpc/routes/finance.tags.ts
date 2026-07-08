import { db } from '@hominem/db';
import type { CategoriesListOutput } from '@hominem/rpc/finance';
import { Hono } from 'hono';

import { authMiddleware, type AppContext } from '../middleware/auth';

export const tagsRoutes = new Hono<AppContext>().get(
  '/list',
  authMiddleware,
  async (c) => {
    const userId = c.get('userId')!;
    const tags = await db
      .selectFrom('app.tags')
      .select(['id', 'ownerUserid', 'name', 'color'])
      .where('ownerUserid', '=', userId)
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
      .execute();

    return c.json<CategoriesListOutput>(
      tags.map((tag) => ({
        id: tag.id,
        userId: tag.ownerUserid,
        name: tag.name,
        color: tag.color ?? null,
      })),
      200,
    );
  },
);
