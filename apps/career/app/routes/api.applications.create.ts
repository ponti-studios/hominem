import { data, type ActionFunction } from 'react-router';

import { getAuthenticatedUser } from '~/lib/auth.server';
import { logger } from '~/lib/logger';
import { JobApplicationsService } from '~/lib/services/job-applications.service';
import type { JobPosting } from '~/types/applications';

export const action: ActionFunction = async ({ request }) => {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return data({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { job_posting } = body as { job_posting: JobPosting };

    if (!job_posting) {
      return data({ error: 'Job posting data is required' }, { status: 400 });
    }

    const websiteOrigin = job_posting.url
      ? (() => {
          try {
            return new URL(job_posting.url).origin;
          } catch {
            return null;
          }
        })()
      : null;

    const application = await JobApplicationsService.createApplication(user.id, {
      companyName: job_posting.companyName,
      companyWebsite: websiteOrigin,
      companyDescription: job_posting.companyDescription || null,
      position: job_posting.job_title,
      job_posting: JSON.stringify(job_posting),
      location: job_posting.location || null,
      requirements: job_posting.requirements || [],
      skills: job_posting.skills || [],
      job_posting_url: job_posting.url || null,
      job_posting_word_count: job_posting.wordCount || null,
      source: 'scraped',
      link: job_posting.url || null,
    });

    return { application, message: 'Application saved successfully' };
  } catch (error) {
    logger.error(
      'Application creation error',
      error instanceof Error ? error : undefined,
      error instanceof Error ? undefined : { error },
    );

    return data({ error: 'Unable to create application' }, { status: 500 });
  }
};
