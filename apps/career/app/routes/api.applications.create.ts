import type { ActionFunction } from 'react-router';

import { getAuthenticatedUser } from '~/lib/auth.server';
import { logger } from '~/lib/logger';
import { JobApplicationsService } from '~/lib/services/job-applications.service';
import type { JobPosting } from '~/types/applications';

export const action: ActionFunction = async ({ request }) => {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { jobPosting } = body as { jobPosting: JobPosting };

    if (!jobPosting) {
      return new Response(JSON.stringify({ error: 'Job posting data is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const websiteOrigin = jobPosting.url
      ? (() => {
          try {
            return new URL(jobPosting.url).origin;
          } catch {
            return null;
          }
        })()
      : null;

    const application = await JobApplicationsService.createApplication(user.id, {
      companyName: jobPosting.companyName,
      companyWebsite: websiteOrigin,
      companyDescription: jobPosting.companyDescription || null,
      position: jobPosting.jobTitle,
      jobPosting: JSON.stringify(jobPosting),
      location: jobPosting.location || null,
      requirements: jobPosting.requirements || [],
      skills: jobPosting.skills || [],
      jobPostingUrl: jobPosting.url || null,
      jobPostingWordCount: jobPosting.wordCount || null,
      source: 'scraped',
      link: jobPosting.url || null,
    });

    return new Response(
      JSON.stringify({ application, message: 'Application saved successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    logger.error(
      'Application creation error',
      error instanceof Error ? error : undefined,
      error instanceof Error ? undefined : { error },
    );

    return new Response(JSON.stringify({ error: 'Unable to create application' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
