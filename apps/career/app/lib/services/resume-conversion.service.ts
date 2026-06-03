import { getDb, runInTransaction } from '@hominem/db';

import type { ConvertedResumeData } from '../../types/resume';

export interface SaveResumeResult {
  portfolioId: string;
  portfolioSlug: string;
}

export async function saveResumeToDatabase(
  userId: string,
  data: ConvertedResumeData,
): Promise<SaveResumeResult> {
  return runInTransaction(async (tx) => {
    await tx.deleteFrom('app.portfolios').where('owner_userid', '=', userId).execute();

    const slug = await generateUniqueSlug(data.portfolio.slug);

    const createdPortfolio = await tx
      .insertInto('app.portfolios')
      .values({
        owner_userid: userId,
        slug,
        title: data.portfolio.title,
        is_public: data.portfolio.isPublic,
        is_active: data.portfolio.isActive,
        name: data.portfolio.name,
        initials: data.portfolio.initials ?? null,
        job_title: data.portfolio.jobTitle,
        bio: data.portfolio.bio,
        tagline: data.portfolio.tagline,
        current_location: data.portfolio.currentLocation,
        location_tagline: data.portfolio.locationTagline ?? null,
        availability_status: data.portfolio.availabilityStatus,
        availability_message: data.portfolio.availabilityMessage ?? null,
        email: data.portfolio.email,
        phone: data.portfolio.phone ?? null,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    const portfolioId = createdPortfolio.id;

    if (data.socialLinks) {
      await tx
        .insertInto('app.social_links')
        .values({
          portfolio_id: portfolioId,
          github: data.socialLinks.github ?? null,
          linkedin: data.socialLinks.linkedin ?? null,
          twitter: data.socialLinks.twitter ?? null,
          website: data.socialLinks.website ?? null,
        })
        .execute();
    }

    for (const [index, stat] of data.stats.entries()) {
      await tx
        .insertInto('app.portfolio_stats')
        .values({
          portfolio_id: portfolioId,
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
          portfolio_id: portfolioId,
          company: workExperience.company,
          description: workExperience.description,
          role: workExperience.role,
          start_date: workExperience.startDate ? new Date(workExperience.startDate) : null,
          end_date: workExperience.endDate ? new Date(workExperience.endDate) : null,
          sort_order: index,
        })
        .execute();
    }

    for (const [index, skill] of data.skills.entries()) {
      await tx
        .insertInto('app.skills')
        .values({
          portfolio_id: portfolioId,
          name: skill.name,
          level: skill.level,
          category: skill.category ?? null,
          description: skill.description ?? null,
          years_of_experience: skill.yearsOfExperience ?? null,
          sort_order: index,
        })
        .execute();
    }

    for (const [index, project] of data.projects.entries()) {
      await tx
        .insertInto('app.projects')
        .values({
          portfolio_id: portfolioId,
          work_experience_id: null,
          title: project.title,
          description: project.description,
          short_description: project.shortDescription ?? null,
          live_url: project.liveUrl ?? null,
          github_url: project.githubUrl ?? null,
          image_url: null,
          video_url: null,
          technologies: project.technologies,
          status: project.status,
          is_visible: true,
          sort_order: index,
          is_featured: false,
        })
        .execute();
    }

    return { portfolioId, portfolioSlug: slug };
  });
}

export async function generateUniqueSlug(base: string): Promise<string> {
  const slug = base
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const existing = await getDb()
    .selectFrom('app.portfolios')
    .select('id')
    .where('slug', '=', slug)
    .executeTakeFirst();

  return existing ? `${slug}-${Math.random().toString(36).slice(2, 8)}` : slug;
}
