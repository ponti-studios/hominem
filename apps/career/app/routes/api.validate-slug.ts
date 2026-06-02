import { and, eq, ne } from 'drizzle-orm'
import type { LoaderFunctionArgs } from 'react-router'
import { db } from '../lib/db'
import { portfolios } from '../lib/db/schema'
import { createErrorResponse, createSuccessResponse, withAuthLoader } from '../lib/route-utils'

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user, request }) => {
    const url = new URL(request.url)
    const slug = url.searchParams.get('slug')
    const currentPortfolioId = url.searchParams.get('currentId')

    if (!slug) {
      return createErrorResponse('Slug parameter is required')
    }

    // Basic slug validation
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return createErrorResponse('Slug can only contain lowercase letters, numbers, and hyphens')
    }

    if (slug.length < 3) {
      return createErrorResponse('Slug must be at least 3 characters long')
    }

    if (slug.length > 50) {
      return createErrorResponse('Slug must be less than 50 characters long')
    }

    // Check if slug already exists (excluding current portfolio if editing)
    try {
      const existingPortfolio = await db
        .select({ id: portfolios.id })
        .from(portfolios)
        .where(
          currentPortfolioId
            ? and(eq(portfolios.slug, slug), ne(portfolios.id, currentPortfolioId))
            : eq(portfolios.slug, slug)
        )
        .limit(1)

      const isAvailable = existingPortfolio.length === 0

      return createSuccessResponse({
        slug,
        isAvailable,
        message: isAvailable ? 'Slug is available' : 'Slug is already taken',
      })
    } catch (error) {
      console.error('Error checking slug availability:', error)
      return createErrorResponse('Failed to check slug availability')
    }
  })
}
