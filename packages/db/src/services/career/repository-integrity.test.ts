import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../errors';
import { authDb, db, runInTransaction } from '../../index';
import { PortfolioRepository } from './portfolio.repository';
import { ProjectRepository } from './project.repository';

describe('career repository integrity', () => {
  const userIds: string[] = [];
  const portfolioIds: string[] = [];

  afterEach(async () => {
    for (const portfolioId of portfolioIds.splice(0)) {
      await db.deleteFrom('app.portfolios').where('id', '=', portfolioId).execute();
    }
    for (const userId of userIds.splice(0)) {
      await authDb.deleteFrom('user').where('id', '=', userId).execute();
    }
  });

  async function createUser(): Promise<string> {
    const userId = randomUUID();
    userIds.push(userId);
    await authDb
      .insertInto('user')
      .values({ id: userId, name: 'Career Repository Test User', email: `${userId}@example.com` })
      .execute();
    return userId;
  }

  async function createPortfolio(ownerUserid: string): Promise<string> {
    const portfolioId = randomUUID();
    portfolioIds.push(portfolioId);
    await db
      .insertInto('app.portfolios')
      .values({
        id: portfolioId,
        ownerUserid,
        slug: `test-${portfolioId}`,
        title: 'Test Portfolio',
        name: 'Test User',
        jobTitle: 'Engineer',
        bio: 'Bio',
        tagline: 'Tagline',
        currentLocation: 'Remote',
        email: `${ownerUserid}@example.com`,
      })
      .execute();
    return portfolioId;
  }

  it('excludes invisible projects and skills from public profiles', async () => {
    const ownerUserid = await createUser();
    const portfolioId = await createPortfolio(ownerUserid);

    await db
      .insertInto('app.projects')
      .values([
        { portfolioId, title: 'Public Project', description: 'Visible', isVisible: true },
        { portfolioId, title: 'Private Project', description: 'Hidden', isVisible: false },
      ])
      .execute();
    await db
      .insertInto('app.skills')
      .values([
        { portfolioId, name: 'Public Skill', level: 90, isVisible: true },
        { portfolioId, name: 'Private Skill', level: 10, isVisible: false },
      ])
      .execute();

    const profile = await PortfolioRepository.loadPublicProfileBySlug(db, `test-${portfolioId}`);

    expect(profile?.projects.map((project) => project.title)).toEqual(['Public Project']);
    expect(profile?.skills.map((skill) => skill.name)).toEqual(['Public Skill']);
  });

  it('rejects mutations from users who do not own the portfolio', async () => {
    const ownerUserid = await createUser();
    const otherUserid = await createUser();
    const portfolioId = await createPortfolio(ownerUserid);

    await expect(
      ProjectRepository.createProject(db, {
        ownerUserid: otherUserid,
        portfolioId,
        title: 'Unauthorized',
        description: 'Should not be created',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rolls back all writes when a transaction callback fails', async () => {
    const ownerUserid = await createUser();
    const portfolioId = randomUUID();
    portfolioIds.push(portfolioId);

    await expect(
      runInTransaction(async (trx) => {
        await trx
          .insertInto('app.portfolios')
          .values({
            id: portfolioId,
            ownerUserid,
            slug: `rollback-${portfolioId}`,
            title: 'Rollback Portfolio',
            name: 'Rollback User',
            jobTitle: 'Engineer',
            bio: 'Bio',
            tagline: 'Tagline',
            currentLocation: 'Remote',
            email: `${ownerUserid}@example.com`,
          })
          .execute();
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    await expect(
      db.selectFrom('app.portfolios').select('id').where('id', '=', portfolioId).executeTakeFirst(),
    ).resolves.toBeUndefined();
  });
});
