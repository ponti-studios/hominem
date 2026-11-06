import { randomUUID } from 'node:crypto';

import { db, pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { patchJson } from '../../testkit/rpc-test-app';
import { createRpcTestApp } from '../../testkit/rpc-test-app';
import type { RpcUser } from '../middleware/auth';
import { careerRoutes } from './career';

const ownerId = 'a1000004-0000-4000-8000-000000000001';
const otherId = 'a1000004-0000-4000-8000-000000000002';
const ownerSlug = `ada-${randomUUID().slice(0, 8)}`;

function makeUser(id: string): RpcUser {
  return {
    id,
    email: `${id}@test.dev`,
    name: 'Career Profile Test',
    emailVerified: true,
    image: null,
    isAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const authed = (id: string) =>
  createRpcTestApp(careerRoutes, { path: '/career', user: makeUser(id) });
const publicApp = () =>
  createRpcTestApp(careerRoutes, {
    path: '/career',
    user: makeUser(ownerId),
    authenticated: false,
  });

beforeAll(async () => {
  for (const id of [ownerId, otherId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, 'Career Profile Test', `${id}@test.dev`, true],
    );
  }

  await db
    .insertInto('app.careerProfile')
    .values([
      {
        ownerUserid: ownerId,
        slug: ownerSlug,
        firstName: 'Ada',
        lastName: 'Lovelace',
        headline: 'Engineer',
        summary: 'Builds things.',
        location: 'London',
        copyright: '© Ada',
        isPublic: true,
      },
      {
        ownerUserid: otherId,
        slug: 'taken-slug',
        firstName: 'Grace',
        lastName: 'Hopper',
        isPublic: true,
      },
    ])
    .onConflict((oc) => oc.column('ownerUserid').doNothing())
    .execute();

  await db
    .insertInto('app.careerEngagements')
    .values({
      ownerUserid: ownerId,
      company: 'Analytical Engines',
      title: 'Engineer',
      salaryLow: 120000,
      salaryHigh: 160000,
      contactName: 'Private Referee',
      contactPhone: '+44 7700 900000',
      reasonForLeaving: 'Private reason',
    })
    .execute();
  await db
    .insertInto('app.careerProjects')
    .values([
      { ownerUserid: ownerId, title: 'Difference Engine', isVisible: true },
      { ownerUserid: ownerId, title: 'Hidden Project', isVisible: false },
    ])
    .execute();
  await db
    .insertInto('app.careerSkills')
    .values([
      { ownerUserid: ownerId, name: 'Mathematics', isVisible: true },
      { ownerUserid: ownerId, name: 'Hidden Skill', isVisible: false },
    ])
    .execute();
});

afterAll(async () => {
  for (const table of [
    'app.careerSkills',
    'app.careerProjects',
    'app.careerEngagements',
    'app.careerProfile',
  ] as const) {
    await db.deleteFrom(table).where('ownerUserid', 'in', [ownerId, otherId]).execute();
  }
  await pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [[ownerId, otherId]]);
  await pool.end();
});

describe('career profile and portfolio', () => {
  it('returns the full profile for the owner', async () => {
    const response = await authed(ownerId).request('/career/profile/detail');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      profile: { firstName: 'Ada', slug: ownerSlug, isPublic: true },
    });
  });

  it('updates profile fields and rejects a taken slug', async () => {
    const app = authed(ownerId);
    const updated = await patchJson(app, '/career/profile', { headline: 'Staff Engineer' });
    expect(updated.status).toBe(200);
    await expect(updated.json()).resolves.toMatchObject({
      profile: { headline: 'Staff Engineer' },
    });

    const conflict = await patchJson(app, '/career/profile', { slug: 'taken-slug' });
    expect(conflict.status).toBe(400);
  });

  it('reports slug availability, excluding the current profile', async () => {
    const app = authed(ownerId);
    await expect(
      (await app.request('/career/profile/slug-available?slug=taken-slug')).json(),
    ).resolves.toEqual({ slug: 'taken-slug', isAvailable: false });
    await expect(
      (await app.request(`/career/profile/slug-available?slug=${ownerSlug}`)).json(),
    ).resolves.toEqual({ slug: ownerSlug, isAvailable: false });
  });

  it('serves a public portfolio by slug without a session', async () => {
    const response = await publicApp().request(`/career/portfolio/${ownerSlug}`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile).toMatchObject({ firstName: 'Ada', slug: ownerSlug });
    expect(body.positions).toHaveLength(1);
    expect(body.projects).toHaveLength(1);
    expect(body.skills).toHaveLength(1);
  });

  it('never exposes compensation, contacts, or private reasons publicly', async () => {
    const response = await publicApp().request(`/career/portfolio/${ownerSlug}`);
    const body = await response.json();

    expect(body.positions[0]).not.toHaveProperty('salaryLow');
    expect(body.positions[0]).not.toHaveProperty('salaryHigh');
    expect(body.positions[0]).not.toHaveProperty('contactName');
    expect(body.positions[0]).not.toHaveProperty('contactPhone');
    expect(body.positions[0]).not.toHaveProperty('reasonForLeaving');
  });

  it('omits projects and skills flagged as hidden', async () => {
    const response = await publicApp().request(`/career/portfolio/${ownerSlug}`);
    const body = await response.json();

    expect(body.projects.map((project: { title: string }) => project.title)).toEqual([
      'Difference Engine',
    ]);
    expect(body.skills.map((skill: { name: string }) => skill.name)).toEqual(['Mathematics']);
  });

  it('404s a portfolio that is not public or does not exist', async () => {
    const response = await publicApp().request('/career/portfolio/does-not-exist');
    expect(response.status).toBe(404);
  });
});
