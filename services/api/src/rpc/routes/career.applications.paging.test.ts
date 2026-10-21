import { pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { careerApplicationsSchema } from '../../schemas/career.schema';
import { createRpcTestApp } from '../../testkit/rpc-test-app';
import type { RpcUser } from '../middleware/auth';
import { careerApplicationsRoutes } from './career.applications';

const userId = 'a2000003-0000-4000-8000-000000000001';
const otherId = 'a2000003-0000-4000-8000-000000000002';
const emptyId = 'a2000003-0000-4000-8000-000000000003';

const makeUser = (id: string): RpcUser => ({
  id,
  email: `${id}@test.dev`,
  name: 'Career Applications Paging Test User',
  emailVerified: true,
  image: null,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const app = createRpcTestApp(careerApplicationsRoutes, {
  path: '/career/applications',
  user: makeUser(userId),
});
const emptyApp = createRpcTestApp(careerApplicationsRoutes, {
  path: '/career/applications',
  user: makeUser(emptyId),
});

// `applied_at` is a DATE, so three applications made on the same day tie on the declared sort
// column; their order comes from the id tiebreaker. Two have no applied date, which sort last.
const seeded = [
  {
    id: 'a2000004-0000-4000-8000-000000000010',
    company: 'newest',
    appliedAt: '2026-03-01',
    status: 'REJECTED',
  },
  {
    id: 'a2000004-0000-4000-8000-000000000001',
    company: 'tie-a',
    appliedAt: '2026-02-01',
    status: 'REJECTED',
  },
  {
    id: 'a2000004-0000-4000-8000-000000000002',
    company: 'tie-b',
    appliedAt: '2026-02-01',
    status: 'REJECTED',
  },
  {
    id: 'a2000004-0000-4000-8000-000000000003',
    company: 'tie-c',
    appliedAt: '2026-02-01',
    status: 'REJECTED',
  },
  {
    id: 'a2000004-0000-4000-8000-000000000020',
    company: 'oldest',
    appliedAt: '2026-01-01',
    status: 'REJECTED',
  },
  {
    id: 'a2000004-0000-4000-8000-000000000031',
    company: 'no-date-a',
    appliedAt: null,
    status: 'REJECTED',
  },
  {
    id: 'a2000004-0000-4000-8000-000000000032',
    company: 'no-date-b',
    appliedAt: null,
    status: 'REJECTED',
  },
] as const;

async function insertApplication(row: {
  id: string;
  owner: string;
  company: string;
  appliedAt: string | null;
  status?: string;
}) {
  await pool.query(
    `INSERT INTO app.career_applications (id, owner_userid, company, title, status, applied_at)
     VALUES ($1, $2, $3, $3, $4, $5)`,
    [row.id, row.owner, row.company, row.status ?? 'REJECTED', row.appliedAt],
  );
}

async function readPage(url: string) {
  const res = await app.request(url);
  expect(res.status).toBe(200);
  return careerApplicationsSchema.parse(await res.json());
}

async function walk(limit: number, status?: string): Promise<{ ids: string[]; nexts: string[] }> {
  const ids: string[] = [];
  const nexts: string[] = [];
  let before: string | null = null;
  for (let guard = 0; guard < 20; guard++) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.set('status', status);
    if (before) params.set('before', before);
    const page = await readPage(`/career/applications?${params.toString()}`);
    ids.push(...page.applications.map((a) => a.id));
    nexts.push(page.next ?? '');
    if (!page.next) return { ids, nexts };
    before = page.next;
  }
  throw new Error('paging did not finish');
}

beforeAll(async () => {
  for (const id of [userId, otherId, emptyId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, 'Career Applications Paging Test User', `${id}@test.dev`, true],
    );
  }
  await pool.query('DELETE FROM app.career_applications WHERE owner_userid = ANY($1)', [
    [userId, otherId, emptyId],
  ]);
  for (const row of seeded) await insertApplication({ ...row, owner: userId });
  // Another person's application must never appear.
  await insertApplication({
    id: 'a2000004-0000-4000-8000-000000000099',
    owner: otherId,
    company: 'not mine',
    appliedAt: '2026-03-15',
  });
});

afterAll(async () => {
  await pool.query('DELETE FROM app.career_applications WHERE owner_userid = ANY($1)', [
    [userId, otherId, emptyId],
  ]);
  await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [[userId, otherId, emptyId]]);
});

describe('GET /career/applications paging', () => {
  it('returns everything newest first, ties by id, undated rows last, and no cursor at the end', async () => {
    const page = await readPage('/career/applications');
    expect(page.applications.map((a) => a.company)).toEqual([
      'newest',
      'tie-c',
      'tie-b',
      'tie-a',
      'oldest',
      'no-date-b',
      'no-date-a',
    ]);
    expect(page.next).toBeNull();
  });

  it.each([1, 2, 3, 4])(
    'walks the same list with pages of %i, none skipped or repeated',
    async (size) => {
      const whole = await readPage('/career/applications');
      const { ids, nexts } = await walk(size);
      expect(ids).toEqual(whole.applications.map((a) => a.id));
      // The cursor is only sent while another page exists.
      expect(nexts.slice(0, -1).every((next) => next !== '')).toBe(true);
    },
  );

  it('returns an empty page for someone with no applications', async () => {
    const res = await emptyApp.request('/career/applications?limit=5');
    expect(res.status).toBe(200);
    const page = careerApplicationsSchema.parse(await res.json());
    expect(page.applications).toEqual([]);
    expect(page.next).toBeNull();
  });

  it('does not repeat or skip rows when one is inserted between pages', async () => {
    const first = await readPage('/career/applications?limit=2');
    expect(first.applications.map((a) => a.company)).toEqual(['newest', 'tie-c']);
    expect(first.next).not.toBeNull();

    // Sorts before the cursor: the walk must not see it, because it is newer than the page the
    // client already has.
    await insertApplication({
      id: 'a2000004-0000-4000-8000-000000000040',
      owner: userId,
      company: 'inserted-newer',
      appliedAt: '2026-04-01',
    });
    // Sorts after the cursor (same day, lower id): it must appear exactly once on a later page.
    await insertApplication({
      id: 'a2000004-0000-4000-8000-000000000000',
      owner: userId,
      company: 'inserted-older',
      appliedAt: '2026-02-01',
    });

    const second = await readPage(`/career/applications?limit=2&before=${first.next}`);
    const third = await readPage(`/career/applications?limit=50&before=${second.next}`);
    const companies = [
      ...first.applications.map((a) => a.company),
      ...second.applications.map((a) => a.company),
      ...third.applications.map((a) => a.company),
    ];

    expect(companies).not.toContain('inserted-newer');
    expect(companies.filter((company) => company === 'inserted-older')).toHaveLength(1);
    expect(new Set(companies).size).toBe(companies.length);

    await pool.query('DELETE FROM app.career_applications WHERE id = ANY($1)', [
      ['a2000004-0000-4000-8000-000000000040', 'a2000004-0000-4000-8000-000000000000'],
    ]);
  });

  it('pages within a status filter', async () => {
    await insertApplication({
      id: 'a2000004-0000-4000-8000-000000000050',
      owner: userId,
      company: 'withdrawn-one',
      appliedAt: '2026-03-10',
      status: 'WITHDRAWN',
    });
    await insertApplication({
      id: 'a2000004-0000-4000-8000-000000000051',
      owner: userId,
      company: 'withdrawn-two',
      appliedAt: '2026-03-09',
      status: 'WITHDRAWN',
    });

    const page = await readPage('/career/applications?status=WITHDRAWN&limit=1');
    expect(page.applications.map((a) => a.company)).toEqual(['withdrawn-one']);
    expect(page.next).not.toBeNull();

    const { ids } = await walk(1, 'WITHDRAWN');
    expect(ids).toEqual([
      'a2000004-0000-4000-8000-000000000050',
      'a2000004-0000-4000-8000-000000000051',
    ]);

    await pool.query('DELETE FROM app.career_applications WHERE id = ANY($1)', [
      ['a2000004-0000-4000-8000-000000000050', 'a2000004-0000-4000-8000-000000000051'],
    ]);
  });

  it('rejects a limit over 50, a limit of 0, and a cursor it did not make', async () => {
    expect((await app.request('/career/applications?limit=51')).status).toBe(400);
    expect((await app.request('/career/applications?limit=0')).status).toBe(400);
    expect((await app.request('/career/applications?limit=abc')).status).toBe(400);
    expect((await app.request('/career/applications?before=not-a-cursor')).status).toBe(400);

    const cursor = (fields: object) => Buffer.from(JSON.stringify(fields)).toString('base64url');
    expect(
      (
        await app.request(
          `/career/applications?before=${cursor({ appliedAt: '2026-02-01', id: 'x' })}`,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          `/career/applications?before=${cursor({ appliedAt: 'yesterday', id: seeded[1].id })}`,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          `/career/applications?before=${cursor({ appliedAt: '2026-02-01', id: seeded[1].id })}`,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(
          `/career/applications?before=${cursor({ appliedAt: null, id: seeded[5].id })}`,
        )
      ).status,
    ).toBe(200);
  });

  it('accepts up to 50 per page', async () => {
    expect((await app.request('/career/applications?limit=50')).status).toBe(200);
  });
});
