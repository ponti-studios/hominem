import { eq, sql } from 'drizzle-orm'
import { db } from './db'
import {
  portfolios,
  portfolioStats,
  projects,
  skills,
  socialLinks,
  testimonials,
  workExperiences,
  type Portfolio,
  type PortfolioStats,
  type Project,
  type Skill,
  type SocialLinks,
  type Testimonial,
  type WorkExperience,
} from './db/schema'

export interface FullPortfolio extends Portfolio {
  socialLinks: SocialLinks | null
  portfolioStats: PortfolioStats[]
  workExperiences: WorkExperience[]
  skills: Skill[]
  projects: Project[]
  testimonials: Testimonial[]
}

export async function getFullUserPortfolio(userId: string): Promise<FullPortfolio | null> {
  // Get the main portfolio
  const portfolio = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .limit(1)
    .then((rows) => rows[0] || null)

  if (!portfolio) {
    return null
  }

  // Get all related data in parallel
  const [
    socialLinksData,
    portfolioStatsData,
    workExperiencesData,
    skillsData,
    projectsData,
    testimonialsData,
  ] = await Promise.all([
    db.select().from(socialLinks).where(eq(socialLinks.portfolioId, portfolio.id)),
    db.select().from(portfolioStats).where(eq(portfolioStats.portfolioId, portfolio.id)),
    db
      .select()
      .from(workExperiences)
      .where(eq(workExperiences.portfolioId, portfolio.id))
      .orderBy(sql`${workExperiences.endDate} DESC NULLS FIRST`),
    db.select().from(skills).where(eq(skills.portfolioId, portfolio.id)),
    db.select().from(projects).where(eq(projects.portfolioId, portfolio.id)),
    db.select().from(testimonials).where(eq(testimonials.portfolioId, portfolio.id)),
  ])

  return {
    ...portfolio,
    socialLinks: socialLinksData[0] ?? null,
    portfolioStats: portfolioStatsData,
    workExperiences: workExperiencesData,
    skills: skillsData,
    projects: projectsData,
    testimonials: testimonialsData,
  }
}

export async function getFullPortfolioBySlug(slug: string): Promise<FullPortfolio | null> {
  // Get the main portfolio by slug
  const portfolio = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.slug, slug))
    .limit(1)
    .then((rows) => rows[0] || null)

  if (!portfolio) {
    return null
  }

  // Only return public and active portfolios
  if (!portfolio.isPublic || !portfolio.isActive) {
    return null
  }

  // Get all related data in parallel
  const [
    socialLinksData,
    portfolioStatsData,
    workExperiencesData,
    skillsData,
    projectsData,
    testimonialsData,
  ] = await Promise.all([
    db.select().from(socialLinks).where(eq(socialLinks.portfolioId, portfolio.id)),
    db.select().from(portfolioStats).where(eq(portfolioStats.portfolioId, portfolio.id)),
    db
      .select()
      .from(workExperiences)
      .where(eq(workExperiences.portfolioId, portfolio.id))
      .orderBy(sql`${workExperiences.endDate} DESC NULLS FIRST`),
    db.select().from(skills).where(eq(skills.portfolioId, portfolio.id)),
    db.select().from(projects).where(eq(projects.portfolioId, portfolio.id)),
    db.select().from(testimonials).where(eq(testimonials.portfolioId, portfolio.id)),
  ])

  return {
    ...portfolio,
    socialLinks: socialLinksData[0] ?? null,
    portfolioStats: portfolioStatsData,
    workExperiences: workExperiencesData,
    skills: skillsData,
    projects: projectsData,
    testimonials: testimonialsData,
  }
}

/**
 * Deletes a user's portfolio and all associated data
 * Due to CASCADE DELETE constraints, this will automatically remove:
 * - socialLinks
 * - portfolioStats
 * - workExperiences
 * - skills
 * - projects
 * - testimonials
 * - analytics
 */
export async function deleteUserPortfolio(userId: string): Promise<void> {
  await db.delete(portfolios).where(eq(portfolios.userId, userId))
}
