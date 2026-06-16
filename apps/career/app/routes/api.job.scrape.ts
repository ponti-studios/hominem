import { data, type ActionFunction } from 'react-router';

import type { JobScrapeApiRequest, JobScrapeApiResponse } from '~/lib/api-contracts';
import { logger } from '~/lib/logger';
import { jobScrapingService } from '~/lib/services/job-scraping.service';

export const action: ActionFunction = async ({ request }) => {
  try {
    const { url: jobUrl } = (await request.json()) as JobScrapeApiRequest;

    if (!jobUrl) {
      return data({ error: 'Job posting URL is required' }, { status: 400 });
    }

    try {
      new URL(jobUrl);
    } catch {
      return data({ error: 'Invalid URL format' }, { status: 400 });
    }

    const result = await jobScrapingService.scrapeJobPosting(jobUrl);

    if (!result.success) {
      return data(
        {
          error: result.error || 'Job posting scraping failed',
        } satisfies JobScrapeApiResponse,
        { status: 400 },
      );
    }

    return { job_posting: result.job_posting } satisfies JobScrapeApiResponse;
  } catch (error) {
    logger.error(
      'Job scraping API error',
      error instanceof Error ? error : undefined,
      error instanceof Error ? undefined : { error },
    );

    return data({ error: 'Unable to scrape job posting' } satisfies JobScrapeApiResponse, {
      status: 500,
    });
  }
};
