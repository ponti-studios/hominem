import type { CareerProjectRecord as Project } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { Input } from '@hominem/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hominem/ui/select';
import { Textarea } from '@hominem/ui/textarea';
import { formatDateForInput } from '@hominem/utils/dates';
import { useEffect } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import { useFetcher } from 'react-router';

import type { EditorSubmissionResult } from '~/hooks/useCareerEditorSubmission';

import { useCareerEditorSubmission } from '../../hooks/useCareerEditorSubmission';
import { EditorFormActions } from '../EditorFormActions';
import { FormErrorAlert } from '../FormErrorAlert';

export interface ProjectWorkExperienceOption {
  id: string;
  company: string;
  role: string;
}

export interface ProjectFormValues {
  id?: string;
  title: string;
  description: string;
  short_description?: string;
  live_url?: string;
  github_url?: string;
  image_url?: string;
  video_url?: string;
  technologies_text: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  is_featured?: boolean;
  is_visible?: boolean;
  sort_order?: number;
  portfolio_id: string;
  work_experience_id?: string | null;
}

interface ProjectEditorFormProps {
  project?: Project | null;
  portfolioId: string;
  workExperiences: ProjectWorkExperienceOption[];
  initialWorkExperienceId?: string | null;
  action: string;
  onSuccess?: (result: EditorSubmissionResult<Project>) => void;
  onDeleteSuccess?: () => void;
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseTechnologies(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildProjectDefaults({
  project,
  portfolioId,
  initialWorkExperienceId,
}: {
  project?: Project | null;
  portfolioId: string;
  initialWorkExperienceId?: string | null;
}): ProjectFormValues {
  return {
    id: project?.id,
    title: project?.title || '',
    description: project?.description || '',
    short_description: project?.short_description || '',
    live_url: project?.live_url || '',
    github_url: project?.github_url || '',
    image_url: project?.image_url || '',
    video_url: project?.video_url || '',
    technologies_text: Array.isArray(project?.technologies) ? project.technologies.join(', ') : '',
    status: project?.status || 'completed',
    start_date: formatDateForInput(project?.start_date),
    end_date: formatDateForInput(project?.end_date),
    is_featured: project?.is_featured || false,
    is_visible: project?.is_visible !== false,
    sort_order: project?.sort_order ?? 0,
    portfolio_id: portfolioId,
    work_experience_id: project?.work_experience_id ?? initialWorkExperienceId ?? '',
  };
}

export function formatWorkExperienceOptionLabel(workExperience: ProjectWorkExperienceOption) {
  const company = workExperience.company.trim() || 'Untitled client';
  const role = workExperience.role.trim();
  return role ? `${company} · ${role}` : company;
}

export function ProjectEditorForm({
  project,
  portfolioId,
  workExperiences,
  initialWorkExperienceId,
  action,
  onSuccess,
  onDeleteSuccess,
}: ProjectEditorFormProps) {
  const fetcher = useFetcher();
  const isNew = !project?.id;
  const defaultValues = buildProjectDefaults({ project, portfolioId, initialWorkExperienceId });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<ProjectFormValues>({
    defaultValues,
    mode: 'onChange',
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const { submissionError, clearSubmissionError } = useCareerEditorSubmission<Project>({
    fetcher,
    errorMessage: 'We couldn’t save this project. Try again.',
    onSuccess: (result) => {
      if (result.operation === 'delete') {
        onDeleteSuccess?.();
        return;
      }

      onSuccess?.(result);
    },
  });

  const onSubmit: SubmitHandler<ProjectFormValues> = (values) => {
    if (!isDirty && !isNew) {
      return;
    }

    const formData = new FormData();
    formData.append('operation', isNew ? 'create' : 'update');
    formData.append(
      'projectData',
      JSON.stringify({
        ...values,
        short_description: normalizeOptionalText(values.short_description),
        live_url: normalizeOptionalText(values.live_url),
        github_url: normalizeOptionalText(values.github_url),
        image_url: normalizeOptionalText(values.image_url),
        video_url: normalizeOptionalText(values.video_url),
        technologies: parseTechnologies(values.technologies_text),
        work_experience_id: values.work_experience_id || null,
      }),
    );

    clearSubmissionError();
    fetcher.submit(formData, { method: 'POST', action });
  };

  const handleDelete = () => {
    if (!project?.id || !confirm('Are you sure you want to delete this project?')) {
      return;
    }

    const formData = new FormData();
    formData.append('operation', 'delete');
    formData.append('id', project.id);
    formData.append('portfolio_id', portfolioId);

    clearSubmissionError();
    fetcher.submit(formData, { method: 'POST', action });
  };

  const isSaving = fetcher.state === 'submitting';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-md border border-border bg-card p-4 space-y-4"
    >
      <FormErrorAlert title="Project request failed" message={submissionError} />

      <div className="flex items-center justify-between gap-3">
        <h2 className="heading-3 text-foreground">{isNew ? 'New Project' : 'Project'}</h2>
        <EditorFormActions
          isSaving={isSaving}
          isNew={isNew}
          isDirty={isDirty}
          isValid={isValid}
          submitLabel={isNew ? 'Create Project' : 'Save Changes'}
          onDelete={!isNew ? handleDelete : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`project-title-${project?.id || 'new'}`} className="label">
            Project Title *
          </label>
          <Input
            id={`project-title-${project?.id || 'new'}`}
            type="text"
            {...register('title', { required: 'Add a project title.' })}
            aria-describedby={
              errors.title ? `project-title-${project?.id || 'new'}-error` : undefined
            }
            aria-invalid={errors.title ? true : undefined}
            placeholder="e.g., E-commerce Platform"
          />
          {errors.title ? (
            <p
              id={`project-title-${project?.id || 'new'}-error`}
              role="alert"
              className="body-4 text-destructive"
            >
              {errors.title.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`project-work-experience-${project?.id || 'new'}`} className="label">
            Client / Work Experience
          </label>
          <Controller
            control={control}
            name="work_experience_id"
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onValueChange={(value) => field.onChange(value === '__unlinked' ? '' : value)}
              >
                <SelectTrigger
                  id={`project-work-experience-${project?.id || 'new'}`}
                  className="w-full"
                >
                  <SelectValue placeholder="Unlinked project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unlinked">Unlinked project</SelectItem>
                  {workExperiences.map((workExperience) => (
                    <SelectItem key={workExperience.id} value={workExperience.id}>
                      {formatWorkExperienceOptionLabel(workExperience)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`project-short-description-${project?.id || 'new'}`} className="label">
          Short Description
        </label>
        <Input
          id={`project-short-description-${project?.id || 'new'}`}
          type="text"
          {...register('short_description')}
          placeholder="Brief one-line description"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`project-description-${project?.id || 'new'}`} className="label">
          Full Description *
        </label>
        <Textarea
          id={`project-description-${project?.id || 'new'}`}
          {...register('description', { required: 'Add a project description.' })}
          aria-describedby={
            errors.description ? `project-description-${project?.id || 'new'}-error` : undefined
          }
          aria-invalid={errors.description ? true : undefined}
          className="min-h-28"
          rows={4}
          placeholder="Detailed project description, features, and technologies used..."
        />
        {errors.description ? (
          <p
            id={`project-description-${project?.id || 'new'}-error`}
            role="alert"
            className="body-4 text-destructive"
          >
            {errors.description.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`project-live-url-${project?.id || 'new'}`} className="label">
            Live URL
          </label>
          <Input
            id={`project-live-url-${project?.id || 'new'}`}
            type="url"
            {...register('live_url')}
            placeholder="https://example.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`project-github-url-${project?.id || 'new'}`} className="label">
            GitHub URL
          </label>
          <Input
            id={`project-github-url-${project?.id || 'new'}`}
            type="url"
            {...register('github_url')}
            placeholder="https://github.com/user/repo"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`project-image-url-${project?.id || 'new'}`} className="label">
            Image URL
          </label>
          <Input
            id={`project-image-url-${project?.id || 'new'}`}
            type="url"
            {...register('image_url')}
            placeholder="Project screenshot or image"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`project-video-url-${project?.id || 'new'}`} className="label">
            Video URL
          </label>
          <Input
            id={`project-video-url-${project?.id || 'new'}`}
            type="url"
            {...register('video_url')}
            placeholder="Demo video URL"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`project-technologies-${project?.id || 'new'}`} className="label">
          Technologies
        </label>
        <Input
          id={`project-technologies-${project?.id || 'new'}`}
          type="text"
          {...register('technologies_text')}
          placeholder="React, TypeScript, Node.js"
        />
        <p className="body-4 text-muted-foreground mt-xs">Enter technologies separated by commas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`project-status-${project?.id || 'new'}`} className="label">
            Status
          </label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value ?? 'completed'} onValueChange={field.onChange}>
                <SelectTrigger id={`project-status-${project?.id || 'new'}`} className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`project-start-date-${project?.id || 'new'}`} className="label">
            Start Date
          </label>
          <Input
            id={`project-start-date-${project?.id || 'new'}`}
            type="date"
            {...register('start_date')}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`project-end-date-${project?.id || 'new'}`} className="label">
            End Date
          </label>
          <Input
            id={`project-end-date-${project?.id || 'new'}`}
            type="date"
            {...register('end_date')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`project-sort-order-${project?.id || 'new'}`} className="label">
            Sort Order
          </label>
          <Input
            id={`project-sort-order-${project?.id || 'new'}`}
            type="number"
            {...register('sort_order', { valueAsNumber: true })}
            min={0}
          />
        </div>
        <label className="flex items-center gap-2 md:self-end">
          <input type="checkbox" {...register('is_featured')} className="checkbox" />
          <span className="label">Featured Project</span>
        </label>
        <label className="flex items-center gap-2 md:self-end">
          <input type="checkbox" {...register('is_visible')} className="checkbox" />
          <span className="label">Visible</span>
        </label>
      </div>

      {isNew ? null : (
        <div className="pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => reset(defaultValues)}
            disabled={isSaving || !isDirty}
          >
            Reset changes
          </Button>
        </div>
      )}
    </form>
  );
}
