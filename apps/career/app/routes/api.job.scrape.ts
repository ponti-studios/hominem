import type { ActionFunction } from 'react-router';

import type { JobScrapeApiRequest, JobScrapeApiResponse } from '~/lib/api-contracts';
import { getAuthenticatedUser } from '~/lib/auth.server';
import { logger } from '~/lib/logger';
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

    const { url: jobUrl } = (await request.json()) as JobScrapeApiRequest;

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
        } satisfies JobScrapeApiResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ job_posting: result.job_posting } satisfies JobScrapeApiResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger.error(
      'Job scraping API error',
      error instanceof Error ? error : undefined,
      error instanceof Error ? undefined : { error },
    );

    return new Response(
      JSON.stringify({ error: 'Unable to scrape job posting' } satisfies JobScrapeApiResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
