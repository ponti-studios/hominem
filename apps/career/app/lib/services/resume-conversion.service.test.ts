import { getDb } from '@hominem/db';
import { afterEach, describe, expect, it } from 'vitest';

import { createCareerTestDb } from '~/test/db/career';
import { makeConvertedResumeData } from '~/test/factories/resume';

import { generateUniqueSlug, saveResumeToDatabase } from './resume-conversion.service';

const testDb = createCareerTestDb();

describe('resume conversion slug generation', () => {
  afterEach(() => testDb.cleanup());

  it('normalizes mixed-case and invalid slug input', async () => {
    await expect(generateUniqueSlug(getDb(), ' Charles Ponti!! ', 'Fallback')).resolves.toBe(
      'charles-ponti',
    );
  });

  it('uses fallback input when the requested slug normalizes to empty', async () => {
    await expect(generateUniqueSlug(getDb(), '!!!', 'Jane Doe')).resolves.toBe('jane-doe');
  });

  it('uses portfolio when requested and fallback slugs normalize to empty', async () => {
    await expect(generateUniqueSlug(getDb(), '!!!', '???')).resolves.toBe('portfolio');
  });

  it('adds deterministic suffixes for duplicate slugs', async () => {
    await testDb.createPortfolio({ slug: 'charles-ponti' });
    await testDb.createPortfolio({ slug: 'charles-ponti-2' });

    await expect(generateUniqueSlug(getDb(), 'Charles Ponti')).resolves.toBe('charles-ponti-3');
  });

  it('keeps generated slugs within database length constraints', async () => {
    const slug = await generateUniqueSlug(getDb(), 'a'.repeat(80), 'Fallback');

    expect(slug).toHaveLength(50);
  });

  it('replaces the existing portfolio and inserts converted resume sections', async () => {
    const user = await testDb.createUser({ name: 'Replace User' });
    await testDb.createPortfolio({
      user,
      slug: 'old-portfolio',
      title: 'Old Portfolio',
      jobTitle: 'Old Role',
    });

    const data = makeConvertedResumeData({
      portfolio: {
        slug: 'new-portfolio',
        title: 'New Portfolio',
        name: user.name,
        initials: 'RU',
        jobTitle: 'Staff Engineer',
        email: user.email,
      },
      socialLinks: {
        github: 'https://github.com/example',
        linkedin: null,
        twitter: null,
        website: null,
      },
      workExperience: [
        {
          company: 'Company',
          role: 'Engineer',
          description: 'Built products',
          startDate: '2020-01-01',
          endDate: null,
        },
      ],
      skills: [
        {
          name: 'TypeScript',
          level: 90,
          category: 'Programming',
          description: null,
          yearsOfExperience: 5,
          certifications: [],
        },
      ],
      projects: [
        {
          title: 'Project',
          description: 'Shipped a project',
          shortDescription: null,
          technologies: ['TypeScript', 'React'],
          liveUrl: null,
          githubUrl: null,
          status: 'completed',
        },
      ],
      stats: [{ label: 'Years', value: '5+' }],
    });

    const result = await saveResumeToDatabase(user.id, data);

    expect(result.portfolioSlug).toBe('new-portfolio');

    const portfolios = await getDb()
      .selectFrom('app.portfolios')
      .select(['id', 'slug', 'title'])
      .where('owner_userid', '=', user.id)
      .execute();
    expect(portfolios).toHaveLength(1);
    expect(portfolios[0]).toMatchObject({ slug: 'new-portfolio', title: 'New Portfolio' });

    const portfolioId = portfolios[0]?.id;
    const [workCount, skillCount, projectCount, statCount, socialLinks] = await Promise.all([
      getDb()
        .selectFrom('app.work_experiences')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('portfolio_id', '=', portfolioId)
        .executeTakeFirstOrThrow(),
      getDb()
        .selectFrom('app.skills')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('portfolio_id', '=', portfolioId)
        .executeTakeFirstOrThrow(),
      getDb()
        .selectFrom('app.projects')
        .select(['technologies'])
        .where('portfolio_id', '=', portfolioId)
        .executeTakeFirstOrThrow(),
      getDb()
        .selectFrom('app.portfolio_stats')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('portfolio_id', '=', portfolioId)
        .executeTakeFirstOrThrow(),
      getDb()
        .selectFrom('app.social_links')
        .select(['github'])
        .where('portfolio_id', '=', portfolioId)
        .executeTakeFirstOrThrow(),
    ]);

    expect(Number(workCount.count)).toBe(1);
    expect(Number(skillCount.count)).toBe(1);
    expect(projectCount.technologies).toEqual(['TypeScript', 'React']);
    expect(Number(statCount.count)).toBe(1);
    expect(socialLinks.github).toBe('https://github.com/example');
  });
});
