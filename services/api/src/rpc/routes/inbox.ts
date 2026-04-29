import { getDb, sql } from '@hominem/db';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { authMiddleware, type AppContext } from '../middleware/auth';

const inboxQuerySchema = z.object({
  limit: z.string().optional(),
});

type InboxRow = {
  kind: 'note' | 'chat';
  id: string;
  entityId: string;
  title: string | null;
  preview: string | null;
  updatedAt: string;
  route: string;
};

export const inboxRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', zValidator('query', inboxQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');
    const parsedLimit = query.limit ? Number.parseInt(query.limit, 10) : 50;
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
    const db = getDb();
    const { rows: items } = await sql<InboxRow[]>`
        select
          'chat' as "kind",
          c.id as "id",
          c.id as "entityId",
          c.title as "title",
          null::text as "preview",
          c.last_message_at as "updatedAt",
          '/(protected)/(tabs)/chat/' || c.id as "route"
        from app.chats c
        where c.owner_userid = ${userId}
          and c.archived_at is null

        union all

        select
          'note' as "kind",
          n.id as "id",
          n.id as "entityId",
          n.title as "title",
          left(coalesce(n.excerpt, n.content), 240) as "preview",
          n.updatedat as "updatedAt",
          '/(protected)/(tabs)/notes/' || n.id as "route"
        from app.notes n
        where n.owner_userid = ${userId}
          and n.archived_at is null

        order by "updatedAt" desc, "id" desc
        limit ${limit}
      `.execute(db);

    return c.json({
      items,
    });
  });
