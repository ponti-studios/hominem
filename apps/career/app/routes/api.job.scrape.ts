import type { ActionFunction } from 'react-router';

import { getAuthenticatedUser } from '~/lib/auth.server';
import { jobScrapingService } from '~/lib/services/job-scraping.service';

export const action: ActionFunction = async ({ request }) => {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { url: jobUrl } = (await request.json()) as { url: string };

    if (!jobUrl) {
      return new Response(JSON.stringify({ error: 'Job posting URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      new URL(jobUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await jobScrapingService.scrapeAndValidateJobPosting(jobUrl);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: result.error || 'Job posting scraping failed',
          success: false,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobPosting: result.jobPosting,
        message: 'Job posting scraped successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Job scraping API error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
