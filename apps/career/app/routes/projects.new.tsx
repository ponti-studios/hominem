import { ArrowLeftIcon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';

import { ProjectEditorForm } from '~/components/career/ProjectEditorForm';
import { handleProjectMutationAction } from '~/lib/career/project-actions';
import { getUserWorkExperiencesDesc } from '~/lib/career/queries/base';
import { portfolioContext, userContext } from '~/lib/middleware';

import { Route } from './+types/projects.new';

export const meta: Route.MetaFunction = () => [{ title: 'New Project | Craftd' }];

export async function loader({ context, request }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const portfolio = context.get(portfolioContext)!;
  const initialWorkExperienceId = new URL(request.url).searchParams.get('client');
  const workExperiences = await getUserWorkExperiencesDesc(user.id);

  return {
    portfolioId: portfolio.id,
    workExperiences,
    initialWorkExperienceId,
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    return { success: false, error: 'Sign in again before saving your projects.' };
  }

  return handleProjectMutationAction(request, user.id);
}

export default function NewProject({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentSearch = searchParams.toString();
  const backHref = currentSearch ? `/projects?${currentSearch}` : '/projects';

  return (
    <section className="container flex flex-col gap-4 mx-auto">
      <button
        type="button"
        onClick={() => navigate(backHref)}
        data-testid="back-button"
        className="body-3 inline-flex items-center gap-2 self-start text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to projects
      </button>

      <div className="space-y-1">
        <h1 className="heading-2 text-foreground">New Project</h1>
        <p className="body-3 text-muted-foreground">
          Create a project and optionally link it to one of your work experiences.
        </p>
      </div>

      <ProjectEditorForm
        action="/projects/new"
        portfolioId={loaderData.portfolioId}
        workExperiences={loaderData.workExperiences}
        initialWorkExperienceId={loaderData.initialWorkExperienceId}
        onSuccess={(result) => {
          if (!result.data) {
            return;
          }

          navigate(
            currentSearch
              ? `/projects/${result.data.id}?${currentSearch}`
              : `/projects/${result.data.id}`,
          );
        }}
      />
    </section>
  );
}
