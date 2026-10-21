import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import './career';
import {
  careerWishlistAddOutputSchema,
  careerWishlistCompaniesSchema,
  careerWishlistUpdateOutputSchema,
} from '../../schemas/career.schema';
import { removedResultSchema } from '../../schemas/common.schema';
import { toolOutput } from '../../testkit/tool-result';
import { callTool, listTools } from '../tool-registry';

const userId = 'a2000001-0000-4000-8000-000000000001';

beforeAll(async () => {
  await pool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  await pool.query(
    'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)',
    [userId, 'Wishlist Test User', `${userId}@test.hominem.dev`, true],
  );
});

describe('career wishlist MCP tools', () => {
  it('creates, lists, updates, and removes a wishlist company', async () => {
    const created = toolOutput(
      await callTool(userId, 'career_wishlist_add', { company: 'OpenAI' }),
      careerWishlistAddOutputSchema,
    );
    expect(created.company.company).toBe('OpenAI');

    const duplicate = toolOutput(
      await callTool(userId, 'career_wishlist_add', { company: 'openai' }),
      careerWishlistAddOutputSchema,
    );
    expect(duplicate.company.id).toBe(created.company.id);

    const listed = toolOutput(
      await callTool(userId, 'career_wishlist_companies', {}),
      careerWishlistCompaniesSchema,
    );
    expect(listed.companies.map((company) => company.id)).toContain(created.company.id);

    const updated = toolOutput(
      await callTool(userId, 'career_wishlist_update', {
        id: created.company.id,
        company: 'OpenAI Research',
      }),
      careerWishlistUpdateOutputSchema,
    );
    expect(updated.company?.company).toBe('OpenAI Research');

    const removed = toolOutput(
      await callTool(userId, 'career_wishlist_remove', { id: created.company.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(true);
  });

  it('does not expose another user’s wishlist entry', async () => {
    const otherUserId = 'a2000001-0000-4000-8000-000000000002';
    await pool.query(
      'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
      [otherUserId, 'Other Wishlist User', `${otherUserId}@test.hominem.dev`, true],
    );
    const entry = await db
      .insertInto('app.careerApplications')
      .values({ ownerUserid: userId, company: 'Secret Co', title: 'Secret Co', status: 'WISHLIST' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const result = toolOutput(
      await callTool(otherUserId, 'career_wishlist_remove', { id: entry.id }),
      removedResultSchema,
    );
    expect(result.removed).toBe(false);

    await db.deleteFrom('app.careerApplications').where('id', '=', entry.id).execute();
  });

  it('previews a company past the first 20 wishlist rows', async () => {
    const filler = await db
      .insertInto('app.careerApplications')
      .values(
        Array.from({ length: 25 }, (_, index) => ({
          ownerUserid: userId,
          company: `Filler ${index}`,
          title: `Filler ${index}`,
          status: 'WISHLIST' as const,
          appliedAt: '2026-05-01',
        })),
      )
      .returning('id')
      .execute();

    const target = await db
      .insertInto('app.careerApplications')
      .values({
        ownerUserid: userId,
        company: 'Late Wishlist Co',
        title: 'Late Wishlist Co',
        status: 'WISHLIST',
        appliedAt: '2026-01-01',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const tool = listTools().find((candidate) => candidate.name === 'career_wishlist_remove');
    expect(await tool?.preview?.(userId, { id: target.id })).toEqual({
      company: 'Late Wishlist Co',
    });

    await db
      .deleteFrom('app.careerApplications')
      .where('id', 'in', [target.id, ...filler.map((row) => row.id)])
      .execute();
  });
});
