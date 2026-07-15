import { ArrowLeftIcon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';

import { ProjectEditorForm } from '~/components/career/ProjectEditorForm';
import { handleProjectMutationAction } from '~/lib/career/project-actions';
import { getUserWorkExperiencesDesc } from '~/lib/career/queries/base';
import { getProjectById } from '~/lib/career/queries/projects';
import { userContext } from '~/lib/middleware';

import { Route } from './+types/projects.$id';

export const meta: Route.MetaFunction = () => [{ title: 'Edit Project | career' }];

export async function loader({ context, params }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const { id } = params;
  if (!id) {
    throw new Response('Project ID is required', { status: 400 });
  }

  const [project, workExperiences] = await Promise.all([
    getProjectById(user.id, id),
    getUserWorkExperiencesDesc(user.id),
  ]);

  if (!project) {
    throw new Response('Project not found', { status: 404 });
  }

  return {
    project,
    workExperiences,
    portfolioId: project.portfolioId,
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    return { success: false, error: 'Sign in again before saving your projects.' };
  }

  return handleProjectMutationAction(request, user.id);
}

export default function EditProject({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentSearch = searchParams.toString();
  const backHref = currentSearch ? `/projects?${currentSearch}` : '/projects';

  return (
    <section className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => navigate(backHref)}
        data-testid="back-button"
        className="body-3 inline-flex items-center gap-2 self-start text-muted-foreground transition-colors"
      >
        <ArrowLeftIcon className="size-4" />
        Back to projects
      </button>

      <div className="space-y-1">
        <h1 className="heading-2 text-foreground">
          {loaderData.project.title?.trim() || 'Untitled project'}
        </h1>
        <p className="body-3 text-muted-foreground">
          Update the project details, visibility, and linked work experience.
        </p>
      </div>

      <ProjectEditorForm
        action={`/projects/${loaderData.project.id}`}
        project={loaderData.project}
        portfolioId={loaderData.portfolioId}
        workExperiences={loaderData.workExperiences}
        onDeleteSuccess={() => navigate(backHref)}
      />
    </section>
  );
}
