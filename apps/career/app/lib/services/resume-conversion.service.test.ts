import { CareerRepository, getDb } from '@hominem/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createCareerTestDb } from '~/test/db/career';
import { makeConvertedResumeData } from '~/test/factories/resume';

import { generateUniqueSlug, saveResumeToDatabase } from './resume-conversion.service';

const testDb = createCareerTestDb();
const slugTestValues = ['charles-ponti', 'charles-ponti-2', 'charles-ponti-3'];

async function cleanupSlugTestRows() {
  await getDb().deleteFrom('app.portfolios').where('slug', 'in', slugTestValues).execute();
}

describe('resume conversion slug generation', () => {
  beforeEach(cleanupSlugTestRows);
  afterEach(async () => {
    await testDb.cleanup();
    await cleanupSlugTestRows();
  });

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

  it('creates a new portfolio without deleting the existing one', async () => {
    const user = await testDb.createUser({ name: 'Replace User' });
    await testDb.createPortfolio({
      user,
      slug: 'old-portfolio',
      title: 'Old Portfolio',
      job_title: 'Old Role',
    });

    const data = makeConvertedResumeData({
      portfolio: {
        slug: 'new-portfolio',
        title: 'New Portfolio',
        name: user.name,
        initials: 'RU',
        job_title: 'Staff Engineer',
        email: user.email,
      },
      social_links: {
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
          start_date: '2020-01-01',
          end_date: null,
        },
      ],
      skills: [
        {
          name: 'TypeScript',
          level: 90,
          category: 'Programming',
          description: null,
          years_of_experience: 5,
          certifications: [],
        },
      ],
      projects: [
        {
          title: 'Project',
          description: 'Shipped a project',
          short_description: null,
          technologies: ['TypeScript', 'React'],
          live_url: null,
          github_url: null,
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
    expect(portfolios).toHaveLength(2);
    expect(portfolios.map((portfolio) => portfolio.slug).sort()).toEqual([
      'new-portfolio',
      'old-portfolio',
    ]);

    const portfolio_id = portfolios.find((portfolio) => portfolio.slug === 'new-portfolio')!.id;
    const [workCount, skillCount, projectCount, statCount, social_links] = await Promise.all([
      getDb()
        .selectFrom('app.work_experiences')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('portfolio_id', '=', portfolio_id)
        .executeTakeFirstOrThrow(),
      getDb()
        .selectFrom('app.skills')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('portfolio_id', '=', portfolio_id)
        .executeTakeFirstOrThrow(),
      getDb()
        .selectFrom('app.projects')
        .select(['technologies'])
        .where('portfolio_id', '=', portfolio_id)
        .executeTakeFirstOrThrow(),
      getDb()
        .selectFrom('app.portfolio_stats')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('portfolio_id', '=', portfolio_id)
        .executeTakeFirstOrThrow(),
      getDb()
        .selectFrom('app.social_links')
        .select(['github'])
        .where('portfolio_id', '=', portfolio_id)
        .executeTakeFirstOrThrow(),
    ]);

    expect(Number(workCount.count)).toBe(1);
    expect(Number(skillCount.count)).toBe(1);
    expect(projectCount.technologies).toEqual(['TypeScript', 'React']);
    expect(Number(statCount.count)).toBe(1);
    expect(social_links.github).toBe('https://github.com/example');

    const preference = await getDb()
      .selectFrom('app.user_portfolio_preferences')
      .select(['current_portfolio_id'])
      .where('user_id', '=', user.id)
      .executeTakeFirstOrThrow();

    expect(preference.current_portfolio_id).toBe(portfolio_id);
  });

  it('replaces only the selected portfolio when requested', async () => {
    const user = await testDb.createUser({ name: 'Replace User' });
    const { portfolio: replacedPortfolio } = await testDb.createPortfolio({
      user,
      slug: 'replace-me',
      title: 'Replace Me',
      job_title: 'Old Role',
    });
    await testDb.createPortfolio({
      user,
      slug: 'keep-me',
      title: 'Keep Me',
      job_title: 'Existing Role',
    });

    const data = makeConvertedResumeData({
      portfolio: {
        slug: 'replacement-portfolio',
        title: 'Replacement Portfolio',
        name: user.name,
        initials: 'RU',
        job_title: 'Staff Engineer',
        email: user.email,
      },
      workExperience: [],
      skills: [],
      projects: [],
      stats: [],
    });

    const result = await saveResumeToDatabase(user.id, data, {
      replacePortfolioId: replacedPortfolio.id,
    });

    expect(result.portfolioSlug).toBe('replacement-portfolio');

    const portfolios = await getDb()
      .selectFrom('app.portfolios')
      .select(['slug'])
      .where('owner_userid', '=', user.id)
      .execute();

    expect(portfolios.map((portfolio) => portfolio.slug).sort()).toEqual([
      'keep-me',
      'replacement-portfolio',
    ]);
  });

  it('loads the explicitly selected current portfolio instead of the newest one', async () => {
    const { user, portfolio: olderPortfolio } = await testDb.createPortfolio({
      slug: 'older-portfolio',
      title: 'Older Portfolio',
    });
    await testDb.createPortfolio({
      user,
      slug: 'newer-portfolio',
      title: 'Newer Portfolio',
    });

    await CareerRepository.setCurrentPortfolioByUserId(getDb(), user.id, olderPortfolio.id);

    const currentPortfolio = await CareerRepository.getPortfolioByUserId(getDb(), user.id);

    expect(currentPortfolio?.id).toBe(olderPortfolio.id);
  });
});
