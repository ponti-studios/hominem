import { eq } from 'drizzle-orm'
import type { ConvertedResumeData } from '../../types/resume'
import { db } from '../db'
import {
  portfolios,
  portfolioStats,
  projects as projectsTable,
  skills as skillsTable,
  socialLinks,
  workExperiences,
} from '../db/schema'

export interface SaveResumeResult {
  portfolioId: string
}

export async function saveResumeToDatabase(
  userId: string,
  data: ConvertedResumeData
): Promise<SaveResumeResult> {
  // Use a transaction to ensure data integrity during overwrite
  return await db.transaction(async (tx) => {
    // First, delete any existing portfolio for this user
    await tx.delete(portfolios).where(eq(portfolios.userId, userId))

    const slug = await generateUniqueSlug(data.portfolio.slug)

    const [createdPortfolio] = await tx
      .insert(portfolios)
      .values({
        userId,
        slug,
        title: data.portfolio.title,
        isPublic: data.portfolio.isPublic,
        isActive: data.portfolio.isActive,
        name: data.portfolio.name,
        initials: data.portfolio.initials ?? undefined,
        jobTitle: data.portfolio.jobTitle,
        bio: data.portfolio.bio,
        tagline: data.portfolio.tagline,
        currentLocation: data.portfolio.currentLocation,
        locationTagline: data.portfolio.locationTagline ?? undefined,
        availabilityStatus: data.portfolio.availabilityStatus,
        availabilityMessage: data.portfolio.availabilityMessage ?? undefined,
        email: data.portfolio.email,
        phone: data.portfolio.phone ?? undefined,
      })
      .returning()

    const portfolioId = createdPortfolio.id

    if (data.socialLinks) {
      await tx.insert(socialLinks).values({
        portfolioId,
        github: data.socialLinks.github ?? undefined,
        linkedin: data.socialLinks.linkedin ?? undefined,
        twitter: data.socialLinks.twitter ?? undefined,
        website: data.socialLinks.website ?? undefined,
      })
    }

    // Insert statistics
    await Promise.all(
      data.stats.map((stat) =>
        tx.insert(portfolioStats).values({
          portfolioId,
          label: stat.label,
          value: stat.value,
        })
      )
    )

    // Insert work experiences
    await Promise.all(
      data.workExperience.map((we) =>
        tx.insert(workExperiences).values({
          portfolioId,
          company: we.company,
          description: we.description,
          role: we.role,
          startDate: we.startDate ? new Date(we.startDate) : undefined,
          endDate: we.endDate ? new Date(we.endDate) : undefined,
        })
      )
    )

    // Insert skills
    await Promise.all(
      data.skills.map((skill) =>
        tx.insert(skillsTable).values({
          portfolioId,
          name: skill.name,
          level: skill.level,
          category: skill.category ?? undefined,
          description: skill.description ?? undefined,
          yearsOfExperience: skill.yearsOfExperience ?? undefined,
        })
      )
    )

    // Insert projects
    await Promise.all(
      data.projects.map((proj) =>
        tx.insert(projectsTable).values({
          portfolioId,
          workExperienceId: null, // Resume projects are standalone, not linked to specific jobs
          title: proj.title,
          description: proj.description,
          shortDescription: proj.shortDescription ?? undefined,
          liveUrl: proj.liveUrl ?? undefined,
          githubUrl: proj.githubUrl ?? undefined,
          imageUrl: undefined,
          videoUrl: undefined,
          technologies: proj.technologies,
          status: proj.status,
          isVisible: true,
          sortOrder: 0,
          isFeatured: false,
        })
      )
    )

    return { portfolioId }
  })
}

export async function generateUniqueSlug(base: string): Promise<string> {
  return base
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}
