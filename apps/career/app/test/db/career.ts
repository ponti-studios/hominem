import { randomUUID } from 'node:crypto';

import { db } from '@hominem/db';

type CareerTestUser = {
  id: string;
  email: string;
  name: string;
};

type CreateUserOptions = {
  name?: string;
  email?: string;
};

type CreatePortfolioOptions = {
  user?: CareerTestUser;
  slug?: string;
  title?: string;
  job_title?: string;
};

export function createCareerTestDb() {
  const userIds: string[] = [];

  async function createUser(options: CreateUserOptions = {}): Promise<CareerTestUser> {
    const id = `career-test-${randomUUID()}`;
    const user = {
      id,
      email: options.email ?? `${id}@example.com`,
      name: options.name ?? 'Test User',
    };
    userIds.push(user.id);

    await db.insertInto('user').values(user).execute();

    return user;
  }

  async function createPortfolio(options: CreatePortfolioOptions = {}) {
    const user = options.user ?? (await createUser({ name: options.slug ?? 'Portfolio User' }));
    const slug = options.slug ?? `existing-${randomUUID()}`;

    const portfolio = await db
      .insertInto('app.portfolios')
      .values({
        owner_userid: user.id,
        slug,
        title: options.title ?? `${user.name} Portfolio`,
        name: user.name,
        job_title: options.job_title ?? 'Engineer',
        bio: 'Bio',
        tagline: 'Tagline',
        current_location: 'Los Angeles',
        email: user.email,
      })
      .returning(['id', 'slug', 'title'])
      .executeTakeFirstOrThrow();

    return { portfolio, user };
  }

  async function cleanup() {
    if (userIds.length === 0) return;

    await db.deleteFrom('user').where('id', 'in', userIds).execute();
    userIds.length = 0;
  }

  return {
    cleanup,
    createPortfolio,
    createUser,
  };
}
