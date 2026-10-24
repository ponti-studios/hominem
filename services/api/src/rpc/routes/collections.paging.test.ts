import { pool } from '@hominem/db/core';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listCollectionsOutputSchema } from '../../schemas/collections.schema';
import { requestIdMiddleware, type AppContext, type RpcUser } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { validationErrorMiddleware } from '../middleware/validation';
import { collectionsRoutes } from './collections';
import { filesRoutes } from './files';

const userId = 'b5000001-0000-4000-8000-000000000001';
const otherId = 'b5000001-0000-4000-8000-000000000002';
const emptyId = 'b5000001-0000-4000-8000-000000000003';
const bulkId = 'b5000001-0000-4000-8000-000000000004';

const owns = [userId, otherId, emptyId, bulkId];

const rowId = (n: number) => `b5000004-0000-4000-8000-${String(n).padStart(12, '0')}`;
const bulkCollectionId = (n: number) => `b5000005-0000-4000-8000-${String(n).padStart(12, '0')}`;

function makeUser(id: string): RpcUser {
  return {
    id,
    email: `${id}@test.dev`,
    name: 'Collections Paging Test User',
    emailVerified: true,
    image: null,
    isAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createApp(user: RpcUser) {
  return new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware)
    .use('*', async (c, next) => {
      c.set('auth', { user, userId: user.id, credential: 'session', scopes: [] });
      await next();
    })
    .route('/collections', collectionsRoutes)
    .route('/files', filesRoutes);
}

const app = createApp(makeUser(userId));
const emptyApp = createApp(makeUser(emptyId));
const bulkApp = createApp(makeUser(bulkId));

function parsePage(body: unknown) {
  const page = listCollectionsOutputSchema.parse(body);
  return {
    ids: page.collections.map((collection) => collection.id),
    nextCursor: page.nextCursor,
    count: page.count,
    page,
  };
}

async function readPage(url: string, requestApp = app) {
  const res = await requestApp.request(url);
  expect(res.status).toBe(200);
  return parsePage(await res.json());
}

async function walk(size: number, requestApp = app): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 40; guard++) {
    const params = new URLSearchParams({ limit: String(size) });
    if (cursor) params.set('cursor', cursor);
    const page = await readPage(`/collections?${params.toString()}`, requestApp);
    ids.push(...page.ids);
    if (!page.nextCursor) return ids;
    cursor = page.nextCursor;
  }
  throw new Error('paging did not finish for /collections');
}

// Collections are ordered by creation time, newest first; `id` descending breaks ties. rowId(11)
// and rowId(10) share a timestamp, so the tiebreaker decides their order.
const tiedAt = '2026-03-01 10:00:00+00';

beforeAll(async () => {
  for (const id of owns) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, 'Collections Paging Test User', `${id}@test.dev`, true],
    );
  }

  await pool.query('DELETE FROM app.collections WHERE owner_userid = ANY($1)', [owns]);

  await pool.query(
    `INSERT INTO app.collections (id, owner_userid, name, createdat, updatedat)
     VALUES
       ($1, $5, 'owned-tie-low-id', $7, $7),
       ($2, $5, 'owned-tie-high-id', $7, $7),
       ($3, $5, 'owned-older', '2026-02-01 10:00:00+00', '2026-02-01 10:00:00+00'),
       ($4, $6, 'shared-with-me', '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00')`,
    [rowId(10), rowId(11), rowId(5), rowId(12), userId, otherId, tiedAt],
  );

  // Invited but not accepted: the viewer must not see it. The remaining two are a stranger's.
  await pool.query(
    `INSERT INTO app.collections (id, owner_userid, name, createdat, updatedat)
     VALUES
       ($1, $2, 'invite-not-accepted', '2026-01-02 10:00:00+00', '2026-01-02 10:00:00+00'),
       ($3, $2, 'other-private', '2026-01-03 10:00:00+00', '2026-01-03 10:00:00+00'),
       ($4, $2, 'third-party', '2026-01-04 10:00:00+00', '2026-01-04 10:00:00+00')`,
    [rowId(13), otherId, rowId(14), rowId(15)],
  );

  await pool.query(
    `INSERT INTO app.collection_members (owner_userid, collection_id, user_id, role, accepted_at)
     VALUES
       ($1, $2, $3, 'editor', '2026-01-01 10:00:00+00'),
       ($1, $4, $3, 'viewer', NULL)`,
    [otherId, rowId(12), userId, rowId(13)],
  );

  // One item on `owned-older` so the preserved `itemCount` field has something to report.
  await pool.query(
    `INSERT INTO app.collection_items (owner_userid, collection_id, entity_table, entity_id)
     VALUES ($1, $2, 'app.people'::regclass, $3)`,
    [userId, rowId(5), rowId(90)],
  );

  // Enough collections for the bulk user to exceed one page at the default and maximum limits.
  await pool.query(
    `INSERT INTO app.collections (id, owner_userid, name, createdat, updatedat)
     SELECT
       ('b5000005-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       $1,
       'bulk-' || n,
       '2026-03-01 00:00:00+00'::timestamptz + (n || ' seconds')::interval,
       '2026-03-01 00:00:00+00'::timestamptz + (n || ' seconds')::interval
     FROM generate_series(1, 55) AS n`,
    [bulkId],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM app.collections WHERE owner_userid = ANY($1)', [owns]);
  await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [owns]);
});

describe('GET /collections paging', () => {
  it('keeps the established order, preserves response fields, and returns no cursor on one page', async () => {
    const page = await readPage('/collections');
    expect(page.ids).toEqual([rowId(11), rowId(10), rowId(5), rowId(12)]);
    expect(page.nextCursor).toBeNull();
    expect(page.count).toBe(4);

    const older = page.page.collections.find((collection) => collection.id === rowId(5));
    expect(older).toMatchObject({
      id: rowId(5),
      name: 'owned-older',
      description: null,
      visibility: 'private',
      itemCount: 1,
    });
    expect(typeof older?.createdAt).toBe('string');
    expect(typeof older?.updatedAt).toBe('string');
  });

  it('lists owned and accepted-membership collections only', async () => {
    const page = await readPage('/collections');
    expect(page.ids).toContain(rowId(12));
    expect(page.ids).not.toContain(rowId(13));
    expect(page.ids).not.toContain(rowId(14));
    expect(page.ids).not.toContain(rowId(15));
  });

  it.each([1, 2, 3])('walks in pages of %i with no repeats or gaps', async (size) => {
    const whole = await readPage('/collections');
    const walked = await walk(size);
    expect(walked).toEqual(whole.ids);
    expect(new Set(walked).size).toBe(walked.length);
  });

  it('does not repeat or skip rows when one is inserted between pages', async () => {
    const first = await readPage('/collections?limit=1');
    expect(first.ids).toEqual([rowId(11)]);
    const cursor = first.nextCursor;
    if (!cursor) throw new Error('expected a cursor');

    // Sorts before the cursor: the in-progress walk must not see it.
    await pool.query(
      `INSERT INTO app.collections (id, owner_userid, name, createdat, updatedat)
       VALUES ($1, $2, 'inserted-newer', '2026-04-01 10:00:00+00', '2026-04-01 10:00:00+00')`,
      [rowId(80), userId],
    );
    // Sorts after the cursor: it must appear exactly once in the remainder.
    await pool.query(
      `INSERT INTO app.collections (id, owner_userid, name, createdat, updatedat)
       VALUES ($1, $2, 'inserted-older', '2026-01-15 10:00:00+00', '2026-01-15 10:00:00+00')`,
      [rowId(4), userId],
    );

    const rest: string[] = [];
    let next: string | null = cursor;
    for (let guard = 0; next && guard < 20; guard++) {
      const page = await readPage(`/collections?limit=1&cursor=${next}`);
      rest.push(...page.ids);
      next = page.nextCursor;
    }
    expect(rest).not.toContain(rowId(80));
    expect(rest.filter((id) => id === rowId(4))).toHaveLength(1);
    expect(new Set(rest).size).toBe(rest.length);

    await pool.query('DELETE FROM app.collections WHERE id = ANY($1)', [[rowId(80), rowId(4)]]);
  });

  it('returns an empty first page with no cursor', async () => {
    const page = await readPage('/collections', emptyApp);
    expect(page.ids).toEqual([]);
    expect(page.count).toBe(0);
    expect(page.nextCursor).toBeNull();
  });

  it('rejects malformed cursors and cursors from another endpoint or filter', async () => {
    const cursorOf = (value: unknown) =>
      Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
    const badCursors = [
      'not-a-cursor',
      cursorOf(null),
      cursorOf([]),
      cursorOf({ r: 'collections', f: 'x', k: [tiedAt, rowId(10)] }),
      cursorOf({ r: 'files', f: '', k: [tiedAt, rowId(10)] }),
      cursorOf({ r: 'collections', f: '', k: ['2026-02-31 10:00:00+00', rowId(10)] }),
      cursorOf({ r: 'collections', f: '', k: [tiedAt, 'not-a-uuid'] }),
      cursorOf({ r: 'collections', f: '', k: [tiedAt] }),
    ];
    for (const cursor of badCursors) {
      const res = await app.request(`/collections?cursor=${cursor}`);
      expect(res.status).toBe(400);
    }
  });

  it('rejects limits outside 1-50 and accepts 50', async () => {
    for (const limit of ['0', '51', 'abc']) {
      expect((await app.request(`/collections?limit=${limit}`)).status).toBe(400);
    }
    expect((await app.request('/collections?limit=50')).status).toBe(200);
  });

  it('defaults to 20 rows and caps a page at 50', async () => {
    const defaults = await readPage('/collections', bulkApp);
    expect(defaults.ids).toHaveLength(20);
    expect(defaults.ids[0]).toBe(bulkCollectionId(55));
    expect(defaults.ids[19]).toBe(bulkCollectionId(36));
    expect(defaults.nextCursor).not.toBeNull();

    const capped = await readPage('/collections?limit=50', bulkApp);
    expect(capped.ids).toHaveLength(50);
    expect(capped.ids[0]).toBe(bulkCollectionId(55));
    expect(capped.nextCursor).not.toBeNull();

    const final = await readPage(`/collections?limit=50&cursor=${capped.nextCursor}`, bulkApp);
    expect(final.ids).toEqual([
      bulkCollectionId(5),
      bulkCollectionId(4),
      bulkCollectionId(3),
      bulkCollectionId(2),
      bulkCollectionId(1),
    ]);
    expect(final.nextCursor).toBeNull();

    const walked = await walk(7, bulkApp);
    expect(walked).toHaveLength(55);
    expect(new Set(walked).size).toBe(55);
    expect(walked).toEqual(Array.from({ length: 55 }, (_, index) => bulkCollectionId(55 - index)));
  });
});
