import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '../index'
import { projects } from '../schema'

/**
 * Project query functions
 */

// Get all projects for a portfolio
export async function getProjectsByPortfolio(portfolioId: string) {
  return db
    .select()
    .from(projects)
    .where(eq(projects.portfolioId, portfolioId))
    .orderBy(desc(projects.createdAt))
}

// Get projects for a specific work experience
export async function getProjectsByWorkExperience(portfolioId: string, workExperienceId: string) {
  return db
    .select()
    .from(projects)
    .where(
      and(eq(projects.portfolioId, portfolioId), eq(projects.workExperienceId, workExperienceId))
    )
    .orderBy(desc(projects.createdAt))
}

// Get standalone projects (not tied to work experience)
export async function getStandaloneProjects(portfolioId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.portfolioId, portfolioId), isNull(projects.workExperienceId)))
    .orderBy(desc(projects.createdAt))
}

// Get a specific project by ID
export async function getProjectById(projectId: string) {
  const result = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)

  return result[0] || null
}

// Create a new project
export async function createProject(projectData: {
  portfolioId: string
  workExperienceId?: string | null
  title: string
  description: string
  shortDescription?: string | null
  status: string
  technologies?: string[]
  isVisible: boolean
  isFeatured: boolean
  sortOrder: number
}) {
  const result = await db
    .insert(projects)
    .values({
      ...projectData,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  return result[0]
}

// Update a project
export async function updateProject(
  projectId: string,
  updates: {
    title?: string
    description?: string
    shortDescription?: string | null
    status?: string
    technologies?: string[]
    isVisible?: boolean
    isFeatured?: boolean
    sortOrder?: number
  }
) {
  const result = await db
    .update(projects)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning()

  return result[0]
}

// Delete a project
export async function deleteProject(projectId: string) {
  const result = await db.delete(projects).where(eq(projects.id, projectId)).returning()

  return result[0]
}

// Get visible projects for a portfolio (for public display)
export async function getVisibleProjects(portfolioId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.portfolioId, portfolioId), eq(projects.isVisible, true)))
    .orderBy(desc(projects.sortOrder), desc(projects.createdAt))
}

// Get featured projects for a portfolio
export async function getFeaturedProjects(portfolioId: string) {
  return db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.portfolioId, portfolioId),
        eq(projects.isFeatured, true),
        eq(projects.isVisible, true)
      )
    )
    .orderBy(desc(projects.sortOrder), desc(projects.createdAt))
}
