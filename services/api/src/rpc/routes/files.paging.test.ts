import { pool } from '@hominem/db/core';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listFilesOutputSchema } from '../../schemas/files.schema';
import { requestIdMiddleware, type AppContext, type RpcUser } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { validationErrorMiddleware } from '../middleware/validation';
import { collectionsRoutes } from './collections';
import { filesRoutes } from './files';

const userId = 'b6000001-0000-4000-8000-000000000001';
const otherId = 'b6000001-0000-4000-8000-000000000002';
const emptyId = 'b6000001-0000-4000-8000-000000000003';
const bulkId = 'b6000001-0000-4000-8000-000000000004';

const owns = [userId, otherId, emptyId, bulkId];

const rowId = (n: number) => `b6000004-0000-4000-8000-${String(n).padStart(12, '0')}`;
const bulkFileId = (n: number) => `b6000005-0000-4000-8000-${String(n).padStart(12, '0')}`;

function makeUser(id: string): RpcUser {
  return {
    id,
    email: `${id}@test.dev`,
    name: 'Files Paging Test User',
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
  const page = listFilesOutputSchema.parse(body);
  return {
    ids: page.files.map((file) => file.id),
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
    const page = await readPage(`/files?${params.toString()}`, requestApp);
    ids.push(...page.ids);
    if (!page.nextCursor) return ids;
    cursor = page.nextCursor;
  }
  throw new Error('paging did not finish for /files');
}

const cursorOf = (value: unknown) =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

// Files are listed by upload time, newest first; `id` descending breaks ties. rowId(11) and
// rowId(10) share a timestamp, so the tiebreaker decides their order.
const tiedAt = '2026-03-01 10:00:00+00';

beforeAll(async () => {
  for (const id of owns) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, 'Files Paging Test User', `${id}@test.dev`, true],
    );
  }

  await pool.query('DELETE FROM app.files WHERE owner_userid = ANY($1)', [owns]);

  await pool.query(
    `INSERT INTO app.files
       (id, owner_userid, storage_key, original_name, mimetype, size, url, createdat, updatedat)
     VALUES
       ($1, $5, 'key-a', 'a.png', 'image/png', 100, 'https://files.test/a.png', $7, $7),
       ($2, $5, 'key-b', 'b.pdf', 'application/pdf', 200, 'https://files.test/b.pdf', $7, $7),
       ($3, $5, 'key-c', 'c.txt', 'text/plain', 300, 'https://files.test/c.txt', '2026-02-01 10:00:00+00', '2026-02-01 10:00:00+00'),
       ($4, $6, 'key-d', 'stranger.pdf', 'application/pdf', 400, 'https://files.test/d.pdf', '2026-04-01 10:00:00+00', '2026-04-01 10:00:00+00')`,
    [rowId(10), rowId(11), rowId(5), rowId(12), userId, otherId, tiedAt],
  );

  // Enough files for the bulk user to exceed one page at the default and maximum limits.
  await pool.query(
    `INSERT INTO app.files
       (id, owner_userid, storage_key, original_name, mimetype, size, url, createdat, updatedat)
     SELECT
       ('b6000005-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       $1,
       'bulk-key-' || n,
       'bulk-' || n || '.txt',
       'text/plain',
       n,
       'https://files.test/bulk-' || n || '.txt',
       '2026-03-01 00:00:00+00'::timestamptz + (n || ' seconds')::interval,
       '2026-03-01 00:00:00+00'::timestamptz + (n || ' seconds')::interval
     FROM generate_series(1, 55) AS n`,
    [bulkId],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM app.files WHERE owner_userid = ANY($1)', [owns]);
  await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [owns]);
});

describe('GET /files paging', () => {
  it('keeps the established order, preserves response fields, and returns no cursor on one page', async () => {
    const page = await readPage('/files');
    expect(page.ids).toEqual([rowId(11), rowId(10), rowId(5)]);
    expect(page.nextCursor).toBeNull();
    expect(page.count).toBe(3);

    const image = page.page.files.find((file) => file.id === rowId(10));
    expect(image).toMatchObject({
      id: rowId(10),
      originalName: 'a.png',
      type: 'image',
      mimetype: 'image/png',
      size: 100,
      url: 'https://files.test/a.png',
      vectorIds: [],
    });
    expect(typeof image?.uploadedAt).toBe('string');
    expect(page.page.files.find((file) => file.id === rowId(11))?.type).toBe('document');
  });

  it('never returns another owner’s files', async () => {
    const page = await readPage('/files');
    expect(page.ids).not.toContain(rowId(12));
  });

  it.each([1, 2, 3])('walks in pages of %i with no repeats or gaps', async (size) => {
    const whole = await readPage('/files');
    const walked = await walk(size);
    expect(walked).toEqual(whole.ids);
    expect(new Set(walked).size).toBe(walked.length);
  });

  it('does not repeat or skip rows when one is inserted between pages', async () => {
    const first = await readPage('/files?limit=1');
    expect(first.ids).toEqual([rowId(11)]);
    const cursor = first.nextCursor;
    if (!cursor) throw new Error('expected a cursor');

    await pool.query(
      `INSERT INTO app.files
         (id, owner_userid, storage_key, original_name, mimetype, size, url, createdat, updatedat)
       VALUES ($1, $2, 'key-new', 'inserted-newer.txt', 'text/plain', 1, 'https://files.test/new.txt', '2026-04-01 10:00:00+00', '2026-04-01 10:00:00+00')`,
      [rowId(80), userId],
    );
    await pool.query(
      `INSERT INTO app.files
         (id, owner_userid, storage_key, original_name, mimetype, size, url, createdat, updatedat)
       VALUES ($1, $2, 'key-old', 'inserted-older.txt', 'text/plain', 1, 'https://files.test/old.txt', '2026-01-15 10:00:00+00', '2026-01-15 10:00:00+00')`,
      [rowId(4), userId],
    );

    const rest: string[] = [];
    let next: string | null = cursor;
    for (let guard = 0; next && guard < 20; guard++) {
      const page = await readPage(`/files?limit=1&cursor=${next}`);
      rest.push(...page.ids);
      next = page.nextCursor;
    }
    expect(rest).not.toContain(rowId(80));
    expect(rest.filter((id) => id === rowId(4))).toHaveLength(1);
    expect(new Set(rest).size).toBe(rest.length);

    await pool.query('DELETE FROM app.files WHERE id = ANY($1)', [[rowId(80), rowId(4)]]);
  });

  it('returns an empty first page with no cursor', async () => {
    const page = await readPage('/files', emptyApp);
    expect(page.ids).toEqual([]);
    expect(page.count).toBe(0);
    expect(page.nextCursor).toBeNull();
  });

  it('rejects malformed cursors and cursors from another endpoint', async () => {
    const badCursors = [
      'not-a-cursor',
      cursorOf(null),
      cursorOf([]),
      cursorOf({ r: 'files', f: 'x', k: [tiedAt, rowId(10)] }),
      cursorOf({ r: 'collections', f: '', k: [tiedAt, rowId(10)] }),
      cursorOf({ r: 'files', f: '', k: ['2026-02-31 10:00:00+00', rowId(10)] }),
      cursorOf({ r: 'files', f: '', k: [tiedAt, 'not-a-uuid'] }),
      cursorOf({ r: 'files', f: '', k: [tiedAt] }),
    ];
    for (const cursor of badCursors) {
      const res = await app.request(`/files?cursor=${cursor}`);
      expect(res.status).toBe(400);
    }
  });

  it('rejects limits outside 1-50 and accepts 50', async () => {
    for (const limit of ['0', '51', 'abc']) {
      expect((await app.request(`/files?limit=${limit}`)).status).toBe(400);
    }
    expect((await app.request('/files?limit=50')).status).toBe(200);
  });

  it('defaults to 20 rows and caps a page at 50', async () => {
    const defaults = await readPage('/files', bulkApp);
    expect(defaults.ids).toHaveLength(20);
    expect(defaults.ids[0]).toBe(bulkFileId(55));
    expect(defaults.ids[19]).toBe(bulkFileId(36));
    expect(defaults.nextCursor).not.toBeNull();

    const capped = await readPage('/files?limit=50', bulkApp);
    expect(capped.ids).toHaveLength(50);
    expect(capped.ids[0]).toBe(bulkFileId(55));
    expect(capped.nextCursor).not.toBeNull();

    const final = await readPage(`/files?limit=50&cursor=${capped.nextCursor}`, bulkApp);
    expect(final.ids).toEqual([
      bulkFileId(5),
      bulkFileId(4),
      bulkFileId(3),
      bulkFileId(2),
      bulkFileId(1),
    ]);
    expect(final.nextCursor).toBeNull();

    const walked = await walk(7, bulkApp);
    expect(walked).toHaveLength(55);
    expect(new Set(walked).size).toBe(55);
    expect(walked).toEqual(Array.from({ length: 55 }, (_, index) => bulkFileId(55 - index)));
  });
});
