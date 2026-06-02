import type { LoaderFunctionArgs, MetaFunction } from 'react-router'
import { getMockPortfolioData } from '../lib/auth.server'
import { getFullPortfolioBySlug } from '../lib/portfolio.server'
import { withMockDataFallback } from '../lib/route-utils'

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: 'Portfolio Not Found | Craftd' },
      { name: 'description', content: 'The requested portfolio could not be found.' },
    ]
  }

  return [
    { title: `${data.portfolio.name} - ${data.portfolio.jobTitle}` },
    { name: 'description', content: data.portfolio.bio },
    {
      property: 'og:title',
      content: `${data.portfolio.name} - ${data.portfolio.jobTitle}`,
    },
    { property: 'og:description', content: data.portfolio.bio },
    { property: 'og:type', content: 'profile' },
    { name: 'twitter:card', content: 'summary_large_image' },
    {
      name: 'twitter:title',
      content: `${data.portfolio.name} - ${data.portfolio.jobTitle}`,
    },
    { name: 'twitter:description', content: data.portfolio.bio },
  ]
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params

  if (!slug) {
    throw new Response('Portfolio not found', { status: 404 })
  }

  return withMockDataFallback(
    request,
    async (request) => {
      // Return mock data for testing
      const mockData = getMockPortfolioData(request)
      if (mockData) {
        return { portfolio: mockData.portfolio }
      }
      throw new Response('Portfolio not found', { status: 404 })
    },
    async () => {
      // Fetch real portfolio data
      const portfolio = await getFullPortfolioBySlug(slug)
      if (!portfolio) {
        throw new Response('Portfolio not found', { status: 404 })
      }
      return { portfolio }
    }
  )
}

export default function Portfolio({
  loaderData,
}: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const { portfolio } = loaderData

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="mb-16">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-serif text-4xl font-light text-gray-900 mb-2">{portfolio.name}</h1>
            {/* Contact */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span>{portfolio.currentLocation}</span>
              {portfolio.locationTagline && (
                <>
                  <span>•</span>
                  <span>{portfolio.locationTagline}</span>
                </>
              )}
              <span>•</span>
              <span>{portfolio.email}</span>
              {portfolio.availabilityStatus && portfolio.availabilityMessage && (
                <>
                  <span>•</span>
                  <span className="text-green-600 font-medium">
                    {portfolio.availabilityMessage}
                  </span>
                </>
              )}
            </div>
            <p className="text-xl text-gray-600 my-4">{portfolio.jobTitle}</p>
          </div>
        </div>

        {/* Bio */}
        <section className="mb-16">
          <h2 className="font-serif text-2xl font-light text-gray-900">About</h2>
          <p className="text-gray-700 leading-relaxed">{portfolio.bio}</p>
        </section>

        {/* Stats */}
        {portfolio.portfolioStats && portfolio.portfolioStats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {portfolio.portfolioStats.map((stat) => (
              <div key={stat.id} className="text-center">
                <div className="text-xl font-serif font-light text-gray-900 mb-1">{stat.value}</div>
                <div className="text-xs text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Work Experience */}
      {portfolio.workExperiences && portfolio.workExperiences.length > 0 && (
        <section className="mb-16">
          <h2 className="font-serif text-2xl font-light text-gray-900 mb-4">Experience</h2>
          <div className="space-y-12">
            {portfolio.workExperiences.map((job) => (
              <div key={job.id} className="border-l-2 border-gray-100 pl-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{job.role}</h3>
                    <p className="text-gray-700">{job.company}</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {job.startDate ? new Date(job.startDate).getFullYear() : 'Unknown'} -{' '}
                    {job.endDate ? new Date(job.endDate).getFullYear() : 'Present'}
                  </div>
                </div>
                <p className="text-gray-700 mb-3 leading-relaxed">{job.description}</p>
                {job.metrics && <p className="text-sm text-gray-600 mb-4 italic">{job.metrics}</p>}
                {job.tags && job.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {job.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {portfolio.skills && portfolio.skills.length > 0 && (
        <section className="mb-16">
          <h2 className="font-serif text-2xl font-light text-gray-900 mb-8">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {portfolio.skills.map((skill) => (
              <span
                key={skill.id}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
              >
                {skill.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Featured Projects */}
      {portfolio.projects && portfolio.projects.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl font-light text-gray-900 mb-8">Featured Projects</h2>
          <div className="space-y-8">
            {portfolio.projects
              // .filter((project) => project.isFeatured)
              .map((project) => (
                <div key={project.id} className="border border-gray-200 rounded-lg p-6">
                  <h3 className="font-medium text-gray-900 mb-2">{project.title}</h3>
                  <p className="text-gray-700 mb-4 leading-relaxed">{project.description}</p>
                  {project.technologies && project.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {project.technologies.map((tech) => (
                        <span
                          key={tech}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}
