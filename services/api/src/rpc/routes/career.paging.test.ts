import { pool } from '@hominem/db/core';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  careerCertificationsSchema,
  careerEducationSchema,
  careerEngagementsSchema,
  careerImportsSchema,
  careerProjectsSchema,
  careerSkillsSchema,
  careerWishlistCompaniesSchema,
} from '../../schemas/career.schema';
import { requestIdMiddleware, type AppContext, type RpcUser } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { validationErrorMiddleware } from '../middleware/validation';
import { careerCertificationsRoutes } from './career.certifications';
import { careerEducationRoutes } from './career.education';
import { careerEngagementsRoutes } from './career.engagements';
import { careerImportsRoutes } from './career.imports';
import { careerProjectsRoutes } from './career.projects';
import { careerSkillsRoutes } from './career.skills';
import { careerWishlistRoutes } from './career.wishlist';

const userId = 'a9000001-0000-4000-8000-000000000001';
const otherId = 'a9000001-0000-4000-8000-000000000002';
const emptyId = 'a9000001-0000-4000-8000-000000000003';
const bulkId = 'a9000001-0000-4000-8000-000000000004';

const owns = [userId, otherId, emptyId, bulkId];

const rowId = (n: number) => `a9000004-0000-4000-8000-${String(n).padStart(12, '0')}`;

function makeUser(id: string): RpcUser {
  return {
    id,
    email: `${id}@test.dev`,
    name: 'Career Paging Test User',
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
    .route('/career/engagements', careerEngagementsRoutes)
    .route('/career/education', careerEducationRoutes)
    .route('/career/wishlist', careerWishlistRoutes)
    .route('/career/certifications', careerCertificationsRoutes)
    .route('/career/projects', careerProjectsRoutes)
    .route('/career/skills', careerSkillsRoutes)
    .route('/career/imports', careerImportsRoutes);
}

const app = createApp(makeUser(userId));
const emptyApp = createApp(makeUser(emptyId));
const bulkApp = createApp(makeUser(bulkId));

type PageParser = (body: unknown) => { ids: string[]; nextCursor: string | null };

const engagementsPage: PageParser = (body) => {
  const page = careerEngagementsSchema.parse(body);
  return { ids: page.engagements.map((row) => row.id), nextCursor: page.nextCursor };
};
const educationPage: PageParser = (body) => {
  const page = careerEducationSchema.parse(body);
  return { ids: page.education.map((row) => row.id), nextCursor: page.nextCursor };
};
const wishlistPage: PageParser = (body) => {
  const page = careerWishlistCompaniesSchema.parse(body);
  return { ids: page.companies.map((row) => row.id), nextCursor: page.nextCursor };
};
const certificationsPage: PageParser = (body) => {
  const page = careerCertificationsSchema.parse(body);
  return { ids: page.certifications.map((row) => row.id), nextCursor: page.nextCursor };
};
const projectsPage: PageParser = (body) => {
  const page = careerProjectsSchema.parse(body);
  return { ids: page.projects.map((row) => row.id), nextCursor: page.nextCursor };
};
const skillsPage: PageParser = (body) => {
  const page = careerSkillsSchema.parse(body);
  return { ids: page.skills.map((row) => row.id), nextCursor: page.nextCursor };
};
const importsPage: PageParser = (body) => {
  const page = careerImportsSchema.parse(body);
  return { ids: page.imports.map((row) => row.id), nextCursor: page.nextCursor };
};

const routes: Array<{ url: string; parse: PageParser }> = [
  { url: '/career/engagements', parse: engagementsPage },
  { url: '/career/education', parse: educationPage },
  { url: '/career/wishlist', parse: wishlistPage },
  { url: '/career/certifications', parse: certificationsPage },
  { url: '/career/projects', parse: projectsPage },
  { url: '/career/skills', parse: skillsPage },
  { url: '/career/imports', parse: importsPage },
];

function cursorOf(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

async function readPage(
  url: string,
  parse: PageParser,
  requestApp = app,
): Promise<ReturnType<PageParser>> {
  const res = await requestApp.request(url);
  expect(res.status).toBe(200);
  return parse(await res.json());
}

/** Sends `limit` and the previous page's cursor, and returns the last cursor issued. */
async function firstCursor(
  url: string,
  parse: PageParser,
  filter?: Record<string, string>,
): Promise<string> {
  const page = await readPage(`${url}?${new URLSearchParams({ limit: '1', ...filter })}`, parse);
  if (!page.nextCursor) throw new Error(`${url} did not issue a cursor`);
  return page.nextCursor;
}

async function walk(
  url: string,
  parse: PageParser,
  size: number,
  requestApp = app,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 40; guard++) {
    const params = new URLSearchParams({ limit: String(size) });
    if (cursor) params.set('cursor', cursor);
    const page = await readPage(`${url}?${params.toString()}`, parse, requestApp);
    ids.push(...page.ids);
    if (!page.nextCursor) return ids;
    cursor = page.nextCursor;
  }
  throw new Error(`paging did not finish for ${url}`);
}

// Engagements and education are ordered by end date then start date, newest first; PostgreSQL's
// `desc` puts NULLs first, so a null end date sorts above every dated row. `id` breaks ties.
const engagementRows = [
  { id: rowId(10), company: 'dated-early', startDate: '2026-01-01', endDate: '2026-05-01' },
  { id: rowId(11), company: 'dated-late', startDate: '2026-02-01', endDate: '2026-05-01' },
  { id: rowId(12), company: 'no-end-date', startDate: '2026-03-01', endDate: null },
  { id: rowId(13), company: 'old', startDate: null, endDate: '2024-01-01' },
];

const educationRows = [
  { id: rowId(20), school: 'dated-early', startDate: '2019-09-01', endDate: '2023-06-01' },
  { id: rowId(21), school: 'dated-late', startDate: '2020-09-01', endDate: '2023-06-01' },
  { id: rowId(22), school: 'no-end-date', startDate: '2018-09-01', endDate: null },
];

// Wishlist companies are career applications with status WISHLIST, ordered by applied date
// newest first (nulls last) with `id` breaking ties.
const wishlistRows = [
  { id: rowId(30), company: 'no-date-a', appliedAt: null },
  { id: rowId(31), company: 'no-date-b', appliedAt: null },
  { id: rowId(32), company: 'dated', appliedAt: '2026-01-01' },
];

const certificationRows = [
  { id: rowId(40), name: 'cert-a', sortOrder: 1 },
  { id: rowId(41), name: 'cert-b', sortOrder: 1 },
  { id: rowId(42), name: 'cert-c', sortOrder: 2 },
];

const projectRows = [
  { id: rowId(50), title: 'project-a', sortOrder: 1 },
  { id: rowId(51), title: 'project-b', sortOrder: 1 },
  { id: rowId(52), title: 'project-c', sortOrder: 2 },
];

const skillRows = [
  { id: rowId(60), name: 'skill-a', sortOrder: 1 },
  { id: rowId(61), name: 'skill-b', sortOrder: 1 },
  { id: rowId(62), name: 'skill-c', sortOrder: 2 },
];

beforeAll(async () => {
  for (const id of owns) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, 'Career Paging Test User', `${id}@test.dev`, true],
    );
  }

  for (const table of [
    'app.career_engagements',
    'app.career_education',
    'app.career_applications',
    'app.career_certifications',
    'app.career_projects',
    'app.career_skills',
    'app.career_import_jobs',
  ]) {
    await pool.query(`DELETE FROM ${table} WHERE owner_userid = ANY($1)`, [owns]);
  }

  for (const row of engagementRows) {
    await pool.query(
      `INSERT INTO app.career_engagements (id, owner_userid, company, title, kind, start_date, end_date)
       VALUES ($1, $2, $3, $3, 'EMPLOYMENT', $4, $5)`,
      [row.id, userId, row.company, row.startDate, row.endDate],
    );
  }
  await pool.query(
    `INSERT INTO app.career_engagements (id, owner_userid, company, title, kind, start_date, end_date)
     VALUES ($1, $2, 'not mine', 'not mine', 'EMPLOYMENT', '2026-04-01', '2026-06-01')`,
    [rowId(99), otherId],
  );

  for (const row of educationRows) {
    await pool.query(
      `INSERT INTO app.career_education (id, owner_userid, school, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.id, userId, row.school, row.startDate, row.endDate],
    );
  }
  await pool.query(
    `INSERT INTO app.career_education (id, owner_userid, school, start_date, end_date)
     VALUES ($1, $2, 'not mine', '2020-09-01', '2024-06-01')`,
    [rowId(98), otherId],
  );

  for (const row of wishlistRows) {
    await pool.query(
      `INSERT INTO app.career_applications (id, owner_userid, company, title, status, applied_at)
       VALUES ($1, $2, $3, $3, 'WISHLIST', $4)`,
      [row.id, userId, row.company, row.appliedAt],
    );
  }
  await pool.query(
    `INSERT INTO app.career_applications (id, owner_userid, company, title, status, applied_at)
     VALUES ($1, $2, 'not mine', 'not mine', 'WISHLIST', NULL)`,
    [rowId(97), otherId],
  );

  for (const row of certificationRows) {
    await pool.query(
      `INSERT INTO app.career_certifications (id, owner_userid, name, issuing_organization, sort_order)
       VALUES ($1, $2, $3, 'issuer', $4)`,
      [row.id, userId, row.name, row.sortOrder],
    );
  }
  await pool.query(
    `INSERT INTO app.career_certifications (id, owner_userid, name, issuing_organization, sort_order)
     VALUES ($1, $2, 'not mine', 'issuer', 0)`,
    [rowId(96), otherId],
  );

  for (const row of projectRows) {
    await pool.query(
      `INSERT INTO app.career_projects (id, owner_userid, title, sort_order) VALUES ($1, $2, $3, $4)`,
      [row.id, userId, row.title, row.sortOrder],
    );
  }
  await pool.query(
    `INSERT INTO app.career_projects (id, owner_userid, title, sort_order) VALUES ($1, $2, 'not mine', 0)`,
    [rowId(95), otherId],
  );

  for (const row of skillRows) {
    await pool.query(
      `INSERT INTO app.career_skills (id, owner_userid, name, sort_order) VALUES ($1, $2, $3, $4)`,
      [row.id, userId, row.name, row.sortOrder],
    );
  }
  await pool.query(
    `INSERT INTO app.career_skills (id, owner_userid, name, sort_order) VALUES ($1, $2, 'not mine', 0)`,
    [rowId(94), otherId],
  );

  // Open imports are ordered by last update, newest first, with `id` breaking ties. The first two
  // share a timestamp to prove the tiebreaker (and the microsecond text the cursor carries).
  await pool.query(
    `INSERT INTO app.career_import_jobs
       (id, owner_userid, source_url, source_host, queue_job_id, status, stage, updated_at)
     VALUES
       ($1, $4, 'https://a.example/job', 'a.example', 'queue-a', 'ready', 'draft-ready', '2026-03-01T10:00:00.000001Z'),
       ($2, $4, 'https://b.example/job', 'b.example', 'queue-b', 'ready', 'draft-ready', '2026-03-01T10:00:00.000001Z'),
       ($3, $4, 'https://c.example/job', 'c.example', 'queue-c', 'queued', 'queued', '2026-02-01T00:00:00Z')`,
    [rowId(70), rowId(71), rowId(72), userId],
  );
  await pool.query(
    `INSERT INTO app.career_import_jobs
       (id, owner_userid, source_url, source_host, queue_job_id, status, stage, updated_at)
     VALUES ($1, $2, 'https://d.example/job', 'd.example', 'queue-d', 'dismissed', 'queued', '2026-04-01T00:00:00Z')`,
    [rowId(73), userId],
  );
  await pool.query(
    `INSERT INTO app.career_import_jobs
       (id, owner_userid, source_url, source_host, queue_job_id, status, stage, updated_at)
     VALUES ($1, $2, 'https://e.example/job', 'e.example', 'queue-e', 'queued', 'queued', '2026-05-01T00:00:00Z')`,
    [rowId(93), otherId],
  );

  // Enough skills for the bulk user to exceed one page at the default and maximum limits.
  await pool.query(
    `INSERT INTO app.career_skills (id, owner_userid, name, sort_order)
     SELECT ('a9000005-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, $1, 'bulk-' || n, n
     FROM generate_series(1, 55) AS n`,
    [bulkId],
  );
});

afterAll(async () => {
  for (const table of [
    'app.career_engagements',
    'app.career_education',
    'app.career_applications',
    'app.career_certifications',
    'app.career_projects',
    'app.career_skills',
    'app.career_import_jobs',
  ]) {
    await pool.query(`DELETE FROM ${table} WHERE owner_userid = ANY($1)`, [owns]);
  }
  await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [owns]);
});

describe('career list routes paging', () => {
  it('keeps each route’s established order and returns no cursor on a single page', async () => {
    const expected: Array<{ url: string; parse: PageParser; ids: string[] }> = [
      {
        url: '/career/engagements',
        parse: engagementsPage,
        ids: [rowId(12), rowId(11), rowId(10), rowId(13)],
      },
      { url: '/career/education', parse: educationPage, ids: [rowId(22), rowId(21), rowId(20)] },
      { url: '/career/wishlist', parse: wishlistPage, ids: [rowId(32), rowId(31), rowId(30)] },
      {
        url: '/career/certifications',
        parse: certificationsPage,
        ids: [rowId(40), rowId(41), rowId(42)],
      },
      { url: '/career/projects', parse: projectsPage, ids: [rowId(50), rowId(51), rowId(52)] },
      { url: '/career/skills', parse: skillsPage, ids: [rowId(60), rowId(61), rowId(62)] },
      { url: '/career/imports', parse: importsPage, ids: [rowId(71), rowId(70), rowId(72)] },
    ];
    for (const { url, parse, ids } of expected) {
      const page = await readPage(url, parse);
      expect(page.ids).toEqual(ids);
      expect(page.nextCursor).toBeNull();
    }
  });

  it('never returns another owner’s rows', async () => {
    const seen: string[] = [];
    for (const { url, parse } of routes) seen.push(...(await readPage(url, parse)).ids);
    expect(seen).not.toContain(rowId(99));
    expect(seen).not.toContain(rowId(98));
    expect(seen).not.toContain(rowId(97));
    expect(seen).not.toContain(rowId(96));
    expect(seen).not.toContain(rowId(95));
    expect(seen).not.toContain(rowId(94));
    expect(seen).not.toContain(rowId(93));
  });

  it.each([1, 2, 3])('walks every route in pages of %i with no repeats or gaps', async (size) => {
    for (const { url, parse } of routes) {
      const whole = await readPage(url, parse);
      expect(await walk(url, parse, size)).toEqual(whole.ids);
    }
  });

  it('returns the full import record, not just the fields that survive a snake_case read', async () => {
    const res = await app.request('/career/imports?limit=1');
    expect(res.status).toBe(200);
    const page = careerImportsSchema.parse(await res.json());
    expect(page.imports[0]).toMatchObject({
      id: rowId(71),
      queueJobId: 'queue-b',
      sourceUrl: 'https://b.example/job',
      updatedAt: expect.stringContaining('2026-03-01'),
    });
  });

  it('does not repeat or skip rows when one is inserted between pages', async () => {
    const first = await readPage('/career/engagements?limit=1', engagementsPage);
    expect(first.ids).toEqual([rowId(12)]);
    let cursor = first.nextCursor;
    if (!cursor) throw new Error('expected a cursor');

    // Sorts before the cursor (same null end date, later start): the ongoing walk must not see it.
    await pool.query(
      `INSERT INTO app.career_engagements (id, owner_userid, company, title, kind, start_date, end_date)
       VALUES ($1, $2, 'inserted-newer', 'inserted-newer', 'EMPLOYMENT', '2026-04-01', NULL)`,
      [rowId(80), userId],
    );
    // Sorts after the cursor (same null end date and start date, lower id): it must appear once.
    await pool.query(
      `INSERT INTO app.career_engagements (id, owner_userid, company, title, kind, start_date, end_date)
       VALUES ($1, $2, 'inserted-older', 'inserted-older', 'EMPLOYMENT', '2026-03-01', NULL)`,
      [rowId(5), userId],
    );

    const rest: string[] = [];
    for (let guard = 0; cursor && guard < 20; guard++) {
      const page = await readPage(`/career/engagements?limit=1&cursor=${cursor}`, engagementsPage);
      rest.push(...page.ids);
      cursor = page.nextCursor;
    }
    const walked = [...first.ids, ...rest];

    expect(walked).not.toContain(rowId(80));
    expect(walked.filter((id) => id === rowId(5))).toHaveLength(1);
    expect(new Set(walked).size).toBe(walked.length);

    await pool.query('DELETE FROM app.career_engagements WHERE id = ANY($1)', [
      [rowId(80), rowId(5)],
    ]);
  });

  it('pages within a filter and rejects that filter’s cursor on the unfiltered route', async () => {
    const employmentCursor = await firstCursor('/career/engagements', engagementsPage, {
      type: 'employment',
    });
    const first = await readPage(
      `/career/engagements?type=employment&limit=1&cursor=${employmentCursor}`,
      engagementsPage,
    );
    expect(first.ids).toEqual([rowId(11)]);

    expect(
      (await app.request(`/career/engagements?type=all&cursor=${employmentCursor}`)).status,
    ).toBe(400);
    expect(
      (await app.request(`/career/engagements?type=employment&cursor=${employmentCursor}`)).status,
    ).toBe(200);
  });

  it('returns an empty first page with no cursor for every route', async () => {
    for (const { url, parse } of routes) {
      const page = await readPage(url, parse, emptyApp);
      expect(page.ids).toEqual([]);
      expect(page.nextCursor).toBeNull();
    }
  });

  it('rejects malformed cursors on every route', async () => {
    const badCursors = [
      'not-a-cursor',
      cursorOf(null),
      cursorOf([]),
      cursorOf({ r: 'career.skills', f: '', k: [1] }),
      cursorOf({ r: 'career.engagements', f: 'type=all', k: ['2026-02-31', null, rowId(10)] }),
    ];
    for (const { url } of routes) {
      for (const cursor of badCursors) {
        const res = await app.request(`${url}?cursor=${cursor}`);
        expect(res.status).toBe(400);
      }
    }
  });

  it('rejects a cursor issued for another route', async () => {
    const sources = [
      {
        cursor: await firstCursor('/career/engagements', engagementsPage),
        url: '/career/engagements',
      },
      { cursor: await firstCursor('/career/imports', importsPage), url: '/career/imports' },
      { cursor: await firstCursor('/career/skills', skillsPage), url: '/career/skills' },
    ];
    for (const source of sources) {
      for (const { url } of routes) {
        const res = await app.request(`${url}?cursor=${source.cursor}`);
        // The route that issued the cursor accepts it; every other route must not.
        expect(res.status).toBe(url === source.url ? 200 : 400);
      }
    }
  });

  it('rejects the applications cursor and a wishlist cursor cannot cross to applications', async () => {
    // The wishlist list shares the applications table but its cursors are tagged, so the
    // applications route's untagged cursor is not a wishlist cursor.
    const applicationsCursor = cursorOf({ appliedAt: null, id: rowId(30) });
    expect((await app.request(`/career/wishlist?cursor=${applicationsCursor}`)).status).toBe(400);

    const wishlistCursor = await firstCursor('/career/wishlist', wishlistPage);
    expect(JSON.parse(Buffer.from(wishlistCursor, 'base64url').toString('utf8'))).toMatchObject({
      r: 'career.wishlist',
    });
  });

  it('rejects limits outside 1-50 and accepts 50 on every route', async () => {
    for (const { url } of routes) {
      for (const limit of ['0', '51', 'abc']) {
        const res = await app.request(`${url}?limit=${limit}`);
        expect(res.status).toBe(400);
      }
      expect((await app.request(`${url}?limit=50`)).status).toBe(200);
    }
  });

  it('defaults to 20 rows and caps a page at 50', async () => {
    const defaults = await readPage('/career/skills', skillsPage, bulkApp);
    expect(defaults.ids).toHaveLength(20);
    expect(defaults.ids[0]).toBe('a9000005-0000-4000-8000-000000000001');
    expect(defaults.nextCursor).not.toBeNull();

    const capped = await readPage('/career/skills?limit=50', skillsPage, bulkApp);
    expect(capped.ids).toHaveLength(50);
    expect(capped.nextCursor).not.toBeNull();

    const final = await readPage(
      `/career/skills?limit=50&cursor=${capped.nextCursor}`,
      skillsPage,
      bulkApp,
    );
    expect(final.ids).toHaveLength(5);
    expect(final.nextCursor).toBeNull();

    const walked = await walk('/career/skills', skillsPage, 7, bulkApp);
    expect(walked).toHaveLength(55);
    expect(new Set(walked).size).toBe(55);
    expect(walked).toEqual(Array.from({ length: 55 }, (_, index) => bulkSkillId(index + 1)));
  });
});

function bulkSkillId(n: number): string {
  return `a9000005-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
