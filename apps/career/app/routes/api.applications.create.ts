import { CareerRepository, getDb } from '@hominem/db'
import type { ActionFunction } from 'react-router'
import { getAuthenticatedUser } from '~/lib/auth.server'
import type { JobPosting } from '~/types/applications'

export const action: ActionFunction = async ({ request }) => {
  try {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const { jobPosting } = body as { jobPosting: JobPosting }

    if (!jobPosting) {
      return new Response(JSON.stringify({ error: 'Job posting data is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const websiteOrigin = jobPosting.url
      ? (() => {
          try {
            return new URL(jobPosting.url).origin
          } catch {
            return null
          }
        })()
      : null

    const company = await CareerRepository.findOrCreateCompany(getDb(), user.id, {
      name: jobPosting.companyName,
      website: websiteOrigin,
      description: jobPosting.companyDescription || null,
    })

    const application = await CareerRepository.createJobApplication(getDb(), user.id, {
      companyId: company.id,
      position: jobPosting.jobTitle,
      status: 'APPLIED',
      startDate: new Date(),
      jobPosting: JSON.stringify(jobPosting),
      location: jobPosting.location || null,
      source: 'scraped',
      applicationDate: new Date(),
      link: jobPosting.url || null,
    })

    return new Response(
      JSON.stringify({
        success: true,
        application,
        message: 'Application saved successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Application creation error:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
