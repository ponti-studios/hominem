import type { LoaderFunctionArgs, MetaFunction } from 'react-router';

import { jsonArray } from '../lib/db-json';
import { getFullPortfolioBySlug } from '../lib/portfolio.server';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: 'Portfolio Not Found | Craftd' },
      { name: 'description', content: 'The requested portfolio could not be found.' },
    ];
  }

  return [
    { title: `${data.portfolio.name} - ${data.portfolio.job_title}` },
    { name: 'description', content: data.portfolio.bio },
    {
      property: 'og:title',
      content: `${data.portfolio.name} - ${data.portfolio.job_title}`,
    },
    { property: 'og:description', content: data.portfolio.bio },
    { property: 'og:type', content: 'profile' },
    { name: 'twitter:card', content: 'summary_large_image' },
    {
      name: 'twitter:title',
      content: `${data.portfolio.name} - ${data.portfolio.job_title}`,
    },
    { name: 'twitter:description', content: data.portfolio.bio },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Response('Portfolio not found', { status: 404 });
  }

  const portfolio = await getFullPortfolioBySlug(slug);
  if (!portfolio) {
    throw new Response('Portfolio not found', { status: 404 });
  }
  return { portfolio };
}

export default function Portfolio({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const { portfolio } = loaderData;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="mb-16">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-sans text-4xl font-light text-foreground mb-2">{portfolio.name}</h1>
            {/* Contact */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>{portfolio.current_location}</span>
              {portfolio.location_tagline && (
                <>
                  <span>•</span>
                  <span>{portfolio.location_tagline}</span>
                </>
              )}
              <span>•</span>
              <span>{portfolio.email}</span>
              {portfolio.availability_status && portfolio.availability_message && (
                <>
                  <span>•</span>
                  <span className="text-success font-medium">{portfolio.availability_message}</span>
                </>
              )}
            </div>
            <p className="text-xl text-muted-foreground my-4">{portfolio.job_title}</p>
          </div>
        </div>

        {/* Bio */}
        <section className="mb-16">
          <h2 className="font-sans text-2xl font-light text-foreground">About</h2>
          <p className="text-muted-foreground leading-relaxed">{portfolio.bio}</p>
        </section>

        {/* Stats */}
        {portfolio.portfolio_stats && portfolio.portfolio_stats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {portfolio.portfolio_stats.map((stat) => (
              <div key={stat.id} className="text-center">
                <div className="text-xl font-sans font-light text-foreground mb-1">
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Work Experience */}
      {portfolio.work_experiences && portfolio.work_experiences.length > 0 && (
        <section className="mb-16">
          <h2 className="font-sans text-2xl font-light text-foreground mb-4">Experience</h2>
          <div className="space-y-12">
            {portfolio.work_experiences.map((job) => (
              <div key={job.id} className="border-l-2 border-border pl-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-foreground">{job.role}</h3>
                    <p className="text-muted-foreground">{job.company}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {job.start_date ? new Date(job.start_date).getFullYear() : 'Unknown'} -{' '}
                    {job.end_date ? new Date(job.end_date).getFullYear() : 'Present'}
                  </div>
                </div>
                <p className="text-muted-foreground mb-3 whitespace-pre-line leading-relaxed">
                  {job.description}
                </p>
                {job.metrics && (
                  <p className="text-sm text-muted-foreground mb-4 italic">{job.metrics}</p>
                )}
                {jsonArray<string>(job.tags).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {jsonArray<string>(job.tags).map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full"
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
          <h2 className="font-sans text-2xl font-light text-foreground mb-8">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {portfolio.skills.map((skill) => (
              <span
                key={skill.id}
                className="px-3 py-1 bg-muted text-muted-foreground text-sm rounded-full"
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
          <h2 className="font-sans text-2xl font-light text-foreground mb-8">Featured Projects</h2>
          <div className="space-y-8">
            {portfolio.projects
              // .filter((project) => project.is_featured)
              .map((project) => (
                <div key={project.id} className="border border-border rounded-lg p-6">
                  <h3 className="font-medium text-foreground mb-2">{project.title}</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    {project.description}
                  </p>
                  {jsonArray<string>(project.technologies).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {jsonArray<string>(project.technologies).map((tech) => (
                        <span
                          key={tech}
                          className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full"
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
  );
}
