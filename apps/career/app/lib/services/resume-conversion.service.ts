import { CareerRepository, runInTransaction, sql, type DbHandle } from '@hominem/db';

import type { ConvertedResumeData } from '../../types/resume';
import { normalizePortfolioSlug } from '../../types/resume';

export interface SaveResumeResult {
  portfolio_id: string;
  portfolioSlug: string;
}

export interface SaveResumeOptions {
  replacePortfolioId?: string;
}

function serializeJsonColumn(value: unknown): string {
  return JSON.stringify(value);
}

export async function saveResumeToDatabase(
  owner_userid: string,
  data: ConvertedResumeData,
  options: SaveResumeOptions = {},
): Promise<SaveResumeResult> {
  return runInTransaction(async (tx) => {
    if (options.replacePortfolioId) {
      await tx
        .deleteFrom('app.portfolios')
        .where('id', '=', options.replacePortfolioId)
        .where('owner_userid', '=', owner_userid)
        .execute();
    }

    const slug = await generateUniqueSlug(tx, data.portfolio.slug, data.portfolio.name);

    const createdPortfolio = await tx
      .insertInto('app.portfolios')
      .values({
        owner_userid: owner_userid,
        slug,
        title: data.portfolio.title,
        is_public: data.portfolio.is_public,
        is_active: data.portfolio.is_active,
        name: data.portfolio.name,
        initials: data.portfolio.initials ?? null,
        job_title: data.portfolio.job_title,
        bio: data.portfolio.bio,
        tagline: data.portfolio.tagline,
        current_location: data.portfolio.current_location,
        location_tagline: data.portfolio.location_tagline ?? null,
        availability_status: data.portfolio.availability_status,
        availability_message: data.portfolio.availability_message ?? null,
        email: data.portfolio.email,
        phone: data.portfolio.phone ?? null,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    const portfolio_id = createdPortfolio.id;
    await CareerRepository.setCurrentPortfolioByUserId(tx, owner_userid, portfolio_id);

    if (data.social_links) {
      await tx
        .insertInto('app.social_links')
        .values({
          portfolio_id: portfolio_id,
          github: data.social_links.github ?? null,
          linkedin: data.social_links.linkedin ?? null,
          twitter: data.social_links.twitter ?? null,
          website: data.social_links.website ?? null,
        })
        .execute();
    }

    for (const [index, stat] of data.stats.entries()) {
      await tx
        .insertInto('app.portfolio_stats')
        .values({
          portfolio_id: portfolio_id,
          label: stat.label,
          value: stat.value,
          sort_order: index,
        })
        .execute();
    }

    for (const [index, workExperience] of data.workExperience.entries()) {
      await tx
        .insertInto('app.work_experiences')
        .values({
          portfolio_id: portfolio_id,
          company: workExperience.company,
          description: workExperience.description,
          role: workExperience.role,
          start_date: workExperience.start_date ? new Date(workExperience.start_date) : null,
          end_date: workExperience.end_date ? new Date(workExperience.end_date) : null,
          sort_order: index,
        })
        .execute();
    }

    for (const [index, skill] of data.skills.entries()) {
      await tx
        .insertInto('app.skills')
        .values({
          portfolio_id: portfolio_id,
          name: skill.name,
          level: skill.level,
          category: skill.category ?? null,
          description: skill.description ?? null,
          years_of_experience: skill.years_of_experience ?? null,
          sort_order: index,
        })
        .execute();
    }

    for (const [index, project] of data.projects.entries()) {
      await tx
        .insertInto('app.projects')
        .values({
          portfolio_id: portfolio_id,
          work_experience_id: null,
          title: project.title,
          description: project.description,
          short_description: project.short_description ?? null,
          live_url: project.live_url ?? null,
          github_url: project.github_url ?? null,
          image_url: null,
          video_url: null,
          technologies: serializeJsonColumn(project.technologies),
          status: project.status,
          is_visible: true,
          sort_order: index,
          is_featured: false,
        })
        .execute();
    }

    return { portfolio_id, portfolioSlug: slug };
  });
}

function truncateSlugBase(slug: string, suffix = ''): string {
  const maxBaseLength = 50 - suffix.length;
  return slug.slice(0, maxBaseLength).replace(/-$/g, '') || 'portfolio';
}

export async function generateUniqueSlug(
  handle: DbHandle,
  base: string,
  fallbackBase = 'portfolio',
): Promise<string> {
  const normalizedBase =
    normalizePortfolioSlug(base) || normalizePortfolioSlug(fallbackBase) || 'portfolio';
  const root = truncateSlugBase(normalizedBase);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const candidate = `${truncateSlugBase(root, suffix)}${suffix}`;
    const existing = await handle
      .selectFrom('app.portfolios')
      .select('id')
      .where(sql<string>`lower(slug)`, '=', candidate.toLowerCase())
      .executeTakeFirst();

    if (!existing) return candidate;
  }

  throw new Error('Could not generate a unique portfolio slug.');
}
