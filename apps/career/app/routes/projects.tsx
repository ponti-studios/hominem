import type { CareerProjectRecord as Project } from '@hominem/db';
import { CareerRepository, db } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { FolderOpen, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useFetcher } from 'react-router';

import { EditorFormActions } from '../components/EditorFormActions';
import { FormErrorAlert } from '../components/FormErrorAlert';
import { useCareerEditorSubmission } from '../hooks/useCareerEditorSubmission';
import { portfolioContext, userContext } from '../lib/middleware';
import { parseFormData } from '../lib/route-utils';
import { formatDateForInput, nullArrayToUndefined, stringToDate } from '../lib/utils';
import { Route } from './+types/projects';

export const meta: Route.MetaFunction = () => [{ title: 'Projects | Craftd' }];

interface ProjectFormValues {
  id?: string;
  title: string;
  description: string;
  short_description?: string;
  live_url?: string;
  github_url?: string;
  image_url?: string;
  video_url?: string;
  technologies?: string[];
  status?: string;
  start_date?: string;
  end_date?: string;
  is_featured?: boolean;
  is_visible?: boolean;
  sort_order?: number;
  portfolio_id: string;
}

interface ProjectsEditorSectionProps {
  projects?: Project[] | null;
  portfolio_id: string;
}

function ProjectForm({
  project,
  portfolio_id,
  onDelete,
}: {
  project?: Project;
  portfolio_id: string;
  onDelete?: () => void;
}) {
  const fetcher = useFetcher();
  const isNew = !project?.id;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<ProjectFormValues>({
    defaultValues: {
      id: project?.id,
      title: project?.title || '',
      description: project?.description || '',
      short_description: project?.short_description || '',
      live_url: project?.live_url || '',
      github_url: project?.github_url || '',
      image_url: project?.image_url || '',
      video_url: project?.video_url || '',
      technologies: nullArrayToUndefined(project?.technologies) || [],
      status: project?.status || 'completed',
      start_date: formatDateForInput(project?.start_date),
      end_date: formatDateForInput(project?.end_date),
      is_featured: project?.is_featured || false,
      is_visible: project?.is_visible !== false,
      sort_order: project?.sort_order || 0,
      portfolio_id,
    },
    mode: 'onChange',
  });

  const { submissionError, clearSubmissionError } = useCareerEditorSubmission<Project>({
    fetcher,
    errorMessage: 'We couldn’t save this project. Try again.',
    onSuccess: (result) => {
      if (result.operation === 'delete') {
        onDelete?.();
        return;
      }

      if (!isNew || !result.data) {
        return;
      }

      const savedProject = result.data;
      reset({
        id: savedProject.id,
        title: savedProject.title || '',
        description: savedProject.description || '',
        short_description: savedProject.short_description || '',
        live_url: savedProject.live_url || '',
        github_url: savedProject.github_url || '',
        image_url: savedProject.image_url || '',
        video_url: savedProject.video_url || '',
        technologies: nullArrayToUndefined(savedProject.technologies) || [],
        status: savedProject.status || 'completed',
        start_date: formatDateForInput(savedProject.start_date),
        end_date: formatDateForInput(savedProject.end_date),
        is_featured: savedProject.is_featured || false,
        is_visible: savedProject.is_visible !== false,
        sort_order: savedProject.sort_order || 0,
        portfolio_id: savedProject.portfolio_id,
      });
    },
  });

  const onSubmit: SubmitHandler<ProjectFormValues> = (formData) => {
    if (!isDirty && !isNew) {
      return;
    }

    const formDataToSubmit = new FormData();
    formDataToSubmit.append('operation', isNew ? 'create' : 'update');
    formDataToSubmit.append('projectData', JSON.stringify(formData));

    clearSubmissionError();
    fetcher.submit(formDataToSubmit, {
      method: 'POST',
      action: '/projects',
    });
  };

  const handleDelete = () => {
    if (!project?.id) return;

    if (confirm('Are you sure you want to delete this project?')) {
      const formData = new FormData();
      formData.append('operation', 'delete');
      formData.append('id', project.id);
      formData.append('portfolio_id', portfolio_id);

      clearSubmissionError();
      fetcher.submit(formData, {
        method: 'POST',
        action: '/projects',
      });
    }
  };

  const isSaving = fetcher.state === 'submitting';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-md border border-border bg-card p-4 bg-muted/50 space-y-4"
    >
      <FormErrorAlert title="Project wasn’t saved" message={submissionError} />
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">{isNew ? 'New Project' : 'Project'}</h3>
        <EditorFormActions
          isSaving={isSaving}
          isNew={isNew}
          isDirty={isDirty}
          isValid={isValid}
          submitLabel={isNew ? 'Add Project' : 'Save Changes'}
          onDelete={!isNew ? handleDelete : undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`title-${project?.id || 'new'}`} className="label">
          Project Title *
        </label>
        <input
          id={`title-${project?.id || 'new'}`}
          type="text"
          {...register('title', { required: 'Add a project title.' })}
          aria-describedby={errors.title ? `title-${project?.id || 'new'}-error` : undefined}
          aria-invalid={errors.title ? true : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
          placeholder="e.g., E-commerce Platform"
        />
        {errors.title ? (
          <p
            id={`title-${project?.id || 'new'}-error`}
            role="alert"
            className="text-xs text-destructive"
          >
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`short_description-${project?.id || 'new'}`} className="label">
          Short Description
        </label>
        <input
          id={`short_description-${project?.id || 'new'}`}
          type="text"
          {...register('short_description')}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
          placeholder="Brief one-line description"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`description-${project?.id || 'new'}`} className="label">
          Full Description *
        </label>
        <textarea
          id={`description-${project?.id || 'new'}`}
          {...register('description', { required: 'Add a project description.' })}
          aria-describedby={
            errors.description ? `description-${project?.id || 'new'}-error` : undefined
          }
          aria-invalid={errors.description ? true : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 min-h-28"
          rows={4}
          placeholder="Detailed project description, features, and technologies used..."
        />
        {errors.description ? (
          <p
            id={`description-${project?.id || 'new'}-error`}
            role="alert"
            className="text-xs text-destructive"
          >
            {errors.description.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`live_url-${project?.id || 'new'}`} className="label">
            Live URL
          </label>
          <input
            id={`live_url-${project?.id || 'new'}`}
            type="url"
            {...register('live_url')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="https://example.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`github_url-${project?.id || 'new'}`} className="label">
            GitHub URL
          </label>
          <input
            id={`github_url-${project?.id || 'new'}`}
            type="url"
            {...register('github_url')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="https://github.com/user/repo"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`image_url-${project?.id || 'new'}`} className="label">
            Image URL
          </label>
          <input
            id={`image_url-${project?.id || 'new'}`}
            type="url"
            {...register('image_url')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="Project screenshot or image"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`video_url-${project?.id || 'new'}`} className="label">
            Video URL
          </label>
          <input
            id={`video_url-${project?.id || 'new'}`}
            type="url"
            {...register('video_url')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="Demo video URL"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`technologies-${project?.id || 'new'}`} className="label">
          Technologies
        </label>
        <input
          id={`technologies-${project?.id || 'new'}`}
          type="text"
          {...register('technologies')}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
          placeholder="React, TypeScript, Node.js (comma-separated)"
        />
        <p className="text-xs text-muted-foreground mt-xs">
          Enter technologies separated by commas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`status-${project?.id || 'new'}`} className="label">
            Status
          </label>
          <select id={`status-${project?.id || 'new'}`} {...register('status')} className="select">
            <option value="completed">Completed</option>
            <option value="in-progress">In Progress</option>
            <option value="planned">Planned</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`start_date-${project?.id || 'new'}`} className="label">
            Start Date
          </label>
          <input
            id={`start_date-${project?.id || 'new'}`}
            type="date"
            {...register('start_date')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`end_date-${project?.id || 'new'}`} className="label">
            End Date
          </label>
          <input
            id={`end_date-${project?.id || 'new'}`}
            type="date"
            {...register('end_date')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('is_featured')} className="checkbox" />
            <span className="label">Featured Project</span>
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('is_visible')} className="checkbox" />
            <span className="label">Visible</span>
          </label>
        </div>
      </div>
    </form>
  );
}

function ProjectsEditorSection({
  projects: initialProjects,
  portfolio_id,
}: ProjectsEditorSectionProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [projects, setProjects] = useState(initialProjects || []);

  // Update projects when initialProjects changes
  useEffect(() => {
    setProjects(initialProjects || []);
  }, [initialProjects]);

  const handleAddNew = () => {
    setShowNewForm(true);
  };

  const handleDelete = (projectId: string) => {
    setProjects((prev) => prev.filter((project) => project.id !== projectId));
  };

  return (
    <section className="container flex flex-col gap-8 mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Projects</h2>
        </div>

        {!showNewForm && (
          <Button
            type="button"
            onClick={handleAddNew}
            variant="outline"
            className="inline-flex items-center gap-2 border-dashed"
          >
            <PlusIcon className="size-4" />
            <span className="hidden sm:block">Add New Project</span>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {/* Show new project form if requested */}
        {showNewForm && (
          <ProjectForm portfolio_id={portfolio_id} onDelete={() => setShowNewForm(false)} />
        )}

        {/* Existing projects */}
        {projects.map((project) => (
          <ProjectForm
            key={project.id}
            project={project}
            portfolio_id={portfolio_id}
            onDelete={() => handleDelete(project.id)}
          />
        ))}

        {projects.length === 0 && !showNewForm && (
          <div className="text-center py-2xl text-muted-foreground">
            No projects added yet. Click "Add New Project" to get started.
          </div>
        )}
      </div>
    </section>
  );
}

export async function loader({ context }: Route.LoaderArgs) {
  const portfolio = context.get(portfolioContext)!;
  const projects = await CareerRepository.listProjectsByPortfolio(db, portfolio.id);
  return { projects, portfolio_id: portfolio.id };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    return { success: false, error: 'Sign in again before saving your projects.' };
  }
  const formData = await request.formData();
  const operation = formData.get('operation') as string;

  switch (operation) {
    case 'create':
    case 'update': {
      const projectDataResult = parseFormData<ProjectFormValues>(formData, 'projectData');

      if ('success' in projectDataResult && !projectDataResult.success) {
        return { success: false, operation, error: 'Your project changes couldn’t be read.' };
      }

      const projectData = projectDataResult as ProjectFormValues;

      if (!projectData.portfolio_id) {
        return {
          success: false,
          operation,
          error: 'Choose a portfolio before saving this project.',
        };
      }

      try {
        // Convert technologies string to array if needed
        const technologiesArray = Array.isArray(projectData.technologies)
          ? projectData.technologies
          : [];

        if (operation === 'create') {
          // Insert new project
          const { id: _id, ...insertData } = projectData;

          // Convert date strings to Date objects for database
          const dbData = {
            ...insertData,
            technologies: technologiesArray,
            start_date: stringToDate(insertData.start_date),
            end_date: stringToDate(insertData.end_date),
          };

          const newProject = await CareerRepository.createProject(db, user.id, {
            portfolio_id: dbData.portfolio_id,
            title: dbData.title,
            description: dbData.description,
            short_description: dbData.short_description,
            live_url: dbData.live_url,
            github_url: dbData.github_url,
            image_url: dbData.image_url,
            video_url: dbData.video_url,
            technologies: dbData.technologies,
            status: dbData.status,
            start_date: dbData.start_date,
            end_date: dbData.end_date,
            is_featured: dbData.is_featured,
            is_visible: dbData.is_visible,
            sort_order: dbData.sort_order,
          });

          return {
            success: true,
            operation,
            message: 'Project created successfully',
            data: newProject,
          };
        }

        // Update existing project
        const { id, ...updateData } = projectData;
        if (!id) {
          return {
            success: false,
            operation,
            error: 'Choose a project before saving your changes.',
          };
        }

        // Convert date strings to Date objects for database
        const dbData = {
          ...updateData,
          technologies: technologiesArray,
          start_date: stringToDate(updateData.start_date),
          end_date: stringToDate(updateData.end_date),
        };

        await CareerRepository.updateProject(db, user.id, id, projectData.portfolio_id, {
          title: dbData.title,
          description: dbData.description,
          short_description: dbData.short_description,
          live_url: dbData.live_url,
          github_url: dbData.github_url,
          image_url: dbData.image_url,
          video_url: dbData.video_url,
          technologies: dbData.technologies,
          status: dbData.status,
          start_date: dbData.start_date,
          end_date: dbData.end_date,
          is_featured: dbData.is_featured,
          is_visible: dbData.is_visible,
          sort_order: dbData.sort_order,
        });

        return { success: true, operation, message: 'Project updated successfully' };
      } catch (error) {
        console.error(`Failed to ${operation} project:`, error);
        return {
          success: false,
          operation,
          error:
            operation === 'create'
              ? 'We couldn’t create this project. Try again.'
              : 'We couldn’t save this project. Try again.',
        };
      }
    }

    case 'delete': {
      const id = formData.get('id') as string;
      const portfolio_id = formData.get('portfolio_id') as string;

      if (!id || !portfolio_id) {
        return { success: false, operation, error: 'Choose a project before deleting it.' };
      }

      try {
        await CareerRepository.deleteProject(db, user.id, id, portfolio_id);
        return { success: true, operation, message: 'Project deleted successfully' };
      } catch (error) {
        console.error('Failed to delete project:', error);
        return { success: false, operation, error: 'We couldn’t delete this project. Try again.' };
      }
    }

    default:
      throw new Response('Invalid operation', { status: 400 });
  }
}

export default function Projects({ loaderData }: Route.ComponentProps) {
  return (
    <ProjectsEditorSection projects={loaderData.projects} portfolio_id={loaderData.portfolio_id} />
  );
}
