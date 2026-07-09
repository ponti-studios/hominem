import { jsonArray } from '../lib/db-json';
import { getFullPortfolioBySlug } from '../lib/portfolio.server';
import { Route } from './+types/p.$slug';

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) {
    return [
      { title: 'Portfolio Not Found | Craftd' },
      { name: 'description', content: 'The requested portfolio could not be found.' },
    ];
  }

  return [
    { title: `${loaderData.portfolio.name} - ${loaderData.portfolio.jobTitle}` },
    { name: 'description', content: loaderData.portfolio.bio },
    {
      property: 'og:title',
      content: `${loaderData.portfolio.name} - ${loaderData.portfolio.jobTitle}`,
    },
    { property: 'og:description', content: loaderData.portfolio.bio },
    { property: 'og:type', content: 'profile' },
    { name: 'twitter:card', content: 'summary_large_image' },
    {
      name: 'twitter:title',
      content: `${loaderData.portfolio.name} - ${loaderData.portfolio.jobTitle}`,
    },
    { name: 'twitter:description', content: loaderData.portfolio.bio },
  ];
};

export async function loader({ params }: Route.LoaderArgs) {
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
    <div className="mx-auto w-full max-w-2xl flex flex-col gap-6">
      {/* Header */}
      <header className="mb-16">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-sans text-4xl font-light text-foreground mb-2">{portfolio.name}</h1>
            {/* Contact */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>{portfolio.currentLocation}</span>
              {portfolio.openToRemote ? (
                <>
                  <span>•</span>
                  <span className="text-success font-medium">Open to remote</span>
                </>
              ) : null}
              {portfolio.availabilityStatus ? (
                <>
                  <span>•</span>
                  <span className="text-success font-medium">Open to opportunities</span>
                </>
              ) : null}
              <span>•</span>
              <span>{portfolio.email}</span>
            </div>
            <p className="text-xl text-muted-foreground my-4">{portfolio.jobTitle}</p>
          </div>
        </div>

        {/* Bio */}
        <section className="mb-16">
          <h2 className="font-sans text-2xl font-light text-foreground">About</h2>
          <p className="text-muted-foreground leading-relaxed">{portfolio.bio}</p>
        </section>
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
                    {job.startDate ? new Date(job.startDate).getFullYear() : 'Unknown'} -{' '}
                    {job.endDate ? new Date(job.endDate).getFullYear() : 'Present'}
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
              // .filter((project) => project.isFeatured)
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
