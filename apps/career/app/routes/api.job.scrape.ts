import type { ActionFunction } from 'react-router'
import { jobScrapingService } from '~/lib/services/job-scraping.service'
import { createClient } from '~/lib/supabase/server'

export const action: ActionFunction = async ({ request }) => {
  try {
    const { supabase } = createClient(request)

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { url: jobUrl } = (await request.json()) as { url: string }

    if (!jobUrl) {
      return new Response(JSON.stringify({ error: 'Job posting URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Validate URL format
    try {
      new URL(jobUrl)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Scrape job posting using Cloudflare Browser Rendering API
    const result = await jobScrapingService.scrapeAndValidateJobPosting(jobUrl)

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: result.error || 'Job posting scraping failed',
          success: false,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobPosting: result.jobPosting,
        message: 'Job posting scraped successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Job scraping API error:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
