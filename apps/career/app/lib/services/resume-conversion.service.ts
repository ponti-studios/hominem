import { runInTransaction, SocialLinksRepository, sql, type DbHandle } from '@hominem/db';

import type { ConvertedResumeData } from '../../types/resume';
import { normalizePortfolioSlug } from '../../types/resume';

export interface SaveResumeResult {
  portfolioId: string;
  portfolioSlug: string;
}

export interface SaveResumeOptions {
  replacePortfolioId?: string;
}

function serializeJsonColumn(value: unknown): string {
  return JSON.stringify(value);
}

export async function saveResumeToDatabase(
  ownerUserid: string,
  data: ConvertedResumeData,
  options: SaveResumeOptions = {},
): Promise<SaveResumeResult> {
  return runInTransaction(async (tx) => {
    // The root loader creates an empty portfolio for signed-in users. Resolve
    // that row here as well so a concurrent loader/action cannot turn an
    // otherwise valid import into a one-portfolio uniqueness violation.
    const portfolioToReplaceId =
      options.replacePortfolioId ??
      (
        await tx
          .selectFrom('app.portfolios')
          .select('id')
          .where('ownerUserid', '=', ownerUserid)
          .executeTakeFirst()
      )?.id;

    if (portfolioToReplaceId) {
      await tx
        .deleteFrom('app.portfolios')
        .where('id', '=', portfolioToReplaceId)
        .where('ownerUserid', '=', ownerUserid)
        .execute();
    }

    const slug = await generateUniqueSlug(tx, data.portfolio.slug, data.portfolio.name);

    const createdPortfolio = await tx
      .insertInto('app.portfolios')
      .values({
        ownerUserid: ownerUserid,
        slug,
        title: data.portfolio.title,
        isPublic: data.portfolio.is_public,
        isActive: data.portfolio.is_active,
        name: data.portfolio.name,
        initials: data.portfolio.initials ?? null,
        jobTitle: data.portfolio.job_title,
        bio: data.portfolio.bio,
        tagline: data.portfolio.tagline,
        currentLocation: data.portfolio.current_location,
        availabilityStatus: data.portfolio.availability_status,
        openToRemote: data.portfolio.open_to_remote ?? false,
        email: data.portfolio.email,
        phone: data.portfolio.phone ?? null,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    const portfolioId = createdPortfolio.id;

    if (data.social_links) {
      const existingSocialLinks = await SocialLinksRepository.get(tx, ownerUserid);
      await SocialLinksRepository.save(tx, ownerUserid, {
        github: data.social_links.github ?? existingSocialLinks?.github ?? null,
        linkedin: data.social_links.linkedin ?? existingSocialLinks?.linkedin ?? null,
        twitter: data.social_links.twitter ?? existingSocialLinks?.twitter ?? null,
        website: data.social_links.website ?? existingSocialLinks?.website ?? null,
      });
    }

    for (const [index, workExperience] of data.workExperience.entries()) {
      await tx
        .insertInto('app.workExperiences')
        .values({
          portfolioId: portfolioId,
          company: workExperience.company,
          description: workExperience.description,
          role: workExperience.role,
          startDate: workExperience.start_date ? new Date(workExperience.start_date) : null,
          endDate: workExperience.end_date ? new Date(workExperience.end_date) : null,
          sortOrder: index,
        })
        .execute();
    }

    for (const [index, skill] of data.skills.entries()) {
      await tx
        .insertInto('app.skills')
        .values({
          portfolioId: portfolioId,
          name: skill.name,
          level: skill.level,
          category: skill.category ?? null,
          description: skill.description ?? null,
          yearsOfExperience: skill.years_of_experience ?? null,
          sortOrder: index,
        })
        .execute();
    }

    for (const [index, project] of data.projects.entries()) {
      await tx
        .insertInto('app.projects')
        .values({
          portfolioId: portfolioId,
          workExperienceId: null,
          title: project.title,
          description: project.description,
          shortDescription: project.short_description ?? null,
          liveUrl: project.live_url ?? null,
          githubUrl: project.github_url ?? null,
          imageUrl: null,
          videoUrl: null,
          technologies: serializeJsonColumn(project.technologies),
          status: project.status,
          isVisible: true,
          sortOrder: index,
          isFeatured: false,
        })
        .execute();
    }

    return { portfolioId, portfolioSlug: slug };
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
