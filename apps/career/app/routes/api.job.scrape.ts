import type { ActionFunction } from 'react-router';

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
        JSON.stringify({ error: result.error || 'Job posting scraping failed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ jobPosting: result.jobPosting }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error(
      'Job scraping API error',
      error instanceof Error ? error : undefined,
      error instanceof Error ? undefined : { error },
    );

    return new Response(JSON.stringify({ error: 'Unable to scrape job posting' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
