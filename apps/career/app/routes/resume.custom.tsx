import { Route } from './+types/resume.custom';
import { Link } from 'react-router';

import { JobScrapingResumeCustomizer } from '~/components/JobScrapingResumeCustomizer';
import { userContext } from '~/lib/middleware';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Resume Customizer | Craftd' },
    {
      name: 'description',
      content: 'Create tailored resumes from job postings',
    },
  ];
};

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  return { user };
}

export default function EnhancedResumeCustomizerPage() {
  return (
    <div className="min-h-screen bg-card">
      <div className="px-4 md:px-0">
        {/* Header */}
        <div className="mb-4">
          <Link
            to="/career/applications"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-muted-foreground mb-8 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Applications
          </Link>
        </div>

        {/* Enhanced Resume Customizer Component */}
        <JobScrapingResumeCustomizer />
      </div>
    </div>
  );
}
