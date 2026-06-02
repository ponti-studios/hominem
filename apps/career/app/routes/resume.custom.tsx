import type { LoaderFunctionArgs, MetaFunction } from 'react-router'
import { Link } from 'react-router'
import { JobScrapingResumeCustomizer } from '~/components/JobScrapingResumeCustomizer'
import { withAuthLoader } from '~/lib/route-utils'

export const meta: MetaFunction = () => {
  return [
    { title: 'Resume Customizer | Craftd' },
    {
      name: 'description',
      content: 'Create tailored resumes from job postings',
    },
  ]
}

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    return { user }
  })
}

export default function EnhancedResumeCustomizerPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-4 md:px-0">
        {/* Header */}
        <div className="mb-4">
          <Link
            to="/career/applications"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors"
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
  )
}
