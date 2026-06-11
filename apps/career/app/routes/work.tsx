import type { CareerWorkExperienceRecord as WorkExperience } from '@hominem/db';
import { CareerRepository, db } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useFieldArray, useForm } from 'react-hook-form';
import { useFetcher } from 'react-router';

import type { WorkExperienceMetadata } from '~/types/career-data';

import { EditorFormActions } from '../components/EditorFormActions';
import { FormErrorAlert } from '../components/FormErrorAlert';
import { useCareerEditorSubmission } from '../hooks/useCareerEditorSubmission';
import { jsonObject } from '../lib/db-json';
import { portfolioContext, userContext } from '../lib/middleware';
import { parseFormData } from '../lib/route-utils';
import {
  formatDateForInput,
  nullArrayToUndefined,
  nullToUndefined,
  stringToDate,
} from '../lib/utils';
import { Route } from './+types/work';

interface WorkExperienceFormValues {
  id?: string;
  role: string;
  company: string;
  start_date?: string;
  end_date?: string;
  description: string;
  achievements?: { value: string }[];
  action?: string;
  tags?: string[];
  metadata?: WorkExperienceMetadata;
  sort_order?: number;
  is_visible?: boolean;
  portfolio_id: string;
}

function WorkExperienceForm({
  experience,
  portfolio_id,
  onDelete,
}: {
  experience?: WorkExperience;
  portfolio_id: string;
  onDelete?: () => void;
}) {
  const fetcher = useFetcher();
  const isNew = !experience?.id;
  const metadata = jsonObject<WorkExperienceMetadata>(experience?.metadata) ?? {};

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty, isValid },
  } = useForm<WorkExperienceFormValues>({
    defaultValues: {
      id: experience?.id,
      role: experience?.role || '',
      company: experience?.company || '',
      start_date: formatDateForInput(experience?.start_date),
      end_date: formatDateForInput(experience?.end_date),
      description: experience?.description || '',
      achievements: metadata.achievements?.map((value) => ({ value })) || [],
      action: nullToUndefined(experience?.action),
      tags: nullArrayToUndefined(experience?.tags) || [],
      metadata,
      sort_order: experience?.sort_order || 0,
      is_visible: experience?.is_visible !== false,
      portfolio_id,
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'achievements',
  });

  const { submissionError, clearSubmissionError } = useCareerEditorSubmission<WorkExperience>({
    fetcher,
    errorMessage: 'We couldn’t save this work experience. Try again.',
    onSuccess: (result) => {
      if (result.operation === 'delete') {
        onDelete?.();
        return;
      }

      if (!isNew || !result.data) {
        return;
      }

      const savedExperience = result.data;
      const savedMetadata = jsonObject<WorkExperienceMetadata>(savedExperience.metadata) ?? {};

      reset({
        ...savedExperience,
        start_date: formatDateForInput(savedExperience.start_date),
        end_date: formatDateForInput(savedExperience.end_date),
        achievements: savedMetadata.achievements?.map((value) => ({ value })) || [],
        action: nullToUndefined(savedExperience.action),
        tags: nullArrayToUndefined(savedExperience.tags) || [],
        metadata: savedMetadata,
      });
    },
  });

  const onSubmit: SubmitHandler<WorkExperienceFormValues> = (formData) => {
    if (!isDirty && !isNew) {
      return;
    }

    // Convert achievements array to metadata format
    const achievements =
      formData.achievements?.map((item) => item.value).filter((value) => value.trim() !== '') || [];

    const submissionData = {
      ...formData,
      metadata: {
        ...formData.metadata,
        achievements,
      },
    };

    // Remove the achievements field from the top level since it's now in metadata
    const { achievements: _, ...finalData } = submissionData;

    const formDataToSubmit = new FormData();
    formDataToSubmit.append('operation', isNew ? 'create' : 'update');
    formDataToSubmit.append('workExperienceData', JSON.stringify(finalData));

    clearSubmissionError();
    fetcher.submit(formDataToSubmit, {
      method: 'POST',
      action: '/work',
    });
  };

  const handleDelete = () => {
    if (!experience?.id) return;

    if (confirm('Are you sure you want to delete this work experience?')) {
      const formData = new FormData();
      formData.append('operation', 'delete');
      formData.append('id', experience.id);
      formData.append('portfolio_id', portfolio_id);

      clearSubmissionError();
      fetcher.submit(formData, {
        method: 'POST',
        action: '/work',
      });
    }
  };

  const isSaving = fetcher.state === 'submitting';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-md border border-border bg-card p-4 bg-muted/50 space-y-4"
    >
      <FormErrorAlert title="Work experience wasn’t saved" message={submissionError} />
      <div className="flex items-center justify-between">
        <h3 className="text-2xl tracking-normal font-medium text-foreground font-sans">
          {isNew ? 'New Experience' : experience?.company || 'Work Experience'}
        </h3>
        <EditorFormActions
          isSaving={isSaving}
          isNew={isNew}
          isDirty={isDirty}
          isValid={isValid}
          submitLabel={isNew ? 'Add Experience' : 'Save Changes'}
          onDelete={!isNew ? handleDelete : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`role-${experience?.id || 'new'}`} className="label">
            Job Title *
          </label>
          <input
            id={`role-${experience?.id || 'new'}`}
            type="text"
            {...register('role', { required: 'Add a job title.' })}
            aria-describedby={errors.role ? `role-${experience?.id || 'new'}-error` : undefined}
            aria-invalid={errors.role ? true : undefined}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="e.g., Senior Software Engineer"
          />
          {errors.role ? (
            <p id={`role-${experience?.id || 'new'}-error`} role="alert" className="text-xs text-destructive">
              {errors.role.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`company-${experience?.id || 'new'}`} className="label">
            Company *
          </label>
          <input
            id={`company-${experience?.id || 'new'}`}
            type="text"
            {...register('company', { required: 'Add a company name.' })}
            aria-describedby={errors.company ? `company-${experience?.id || 'new'}-error` : undefined}
            aria-invalid={errors.company ? true : undefined}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="e.g., Google"
          />
          {errors.company ? (
            <p
              id={`company-${experience?.id || 'new'}-error`}
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.company.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`start_date-${experience?.id || 'new'}`} className="label">
            Start Date *
          </label>
          <input
            id={`start_date-${experience?.id || 'new'}`}
            type="date"
            {...register('start_date', { required: 'Add a start date.' })}
            aria-describedby={
              errors.start_date ? `start-date-${experience?.id || 'new'}-error` : undefined
            }
            aria-invalid={errors.start_date ? true : undefined}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          {errors.start_date ? (
            <p
              id={`start-date-${experience?.id || 'new'}-error`}
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.start_date.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`end_date-${experience?.id || 'new'}`} className="label">
            End Date
          </label>
          <input
            id={`end_date-${experience?.id || 'new'}`}
            type="date"
            {...register('end_date')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="Leave empty if current position"
          />
          <p className="text-xs text-muted-foreground mt-xs">
            Leave empty if this is your current position
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`description-${experience?.id || 'new'}`} className="label">
          Job Description *
        </label>
        <textarea
          id={`description-${experience?.id || 'new'}`}
          {...register('description', { required: 'Add a job description.' })}
          aria-describedby={
            errors.description ? `description-${experience?.id || 'new'}-error` : undefined
          }
          aria-invalid={errors.description ? true : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 min-h-28"
          rows={4}
          placeholder="Describe your role, responsibilities, and key achievements..."
        />
        {errors.description ? (
          <p
            id={`description-${experience?.id || 'new'}-error`}
            role="alert"
            className="text-xs text-destructive"
          >
            {errors.description.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <fieldset>
          <legend className="label">Key Achievements</legend>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <input
                  {...register(`achievements.${index}.value` as const)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 flex-1"
                  placeholder="e.g., Increased team productivity by 40%"
                />
                <Button
                  type="button"
                  onClick={() => remove(index)}
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              onClick={() => append({ value: '' })}
              variant="outline"
              size="sm"
              className="w-full border-dashed"
            >
              Add Achievement
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-xs">
            Add quantifiable achievements and key accomplishments from this role
          </p>
        </fieldset>
      </div>
    </form>
  );
}

export default function Work({ loaderData }: Route.ComponentProps) {
  const { work_experiences, portfolio_id } = loaderData;
  const [showNewForm, setShowNewForm] = useState(false);
  const [experiences, setExperiences] = useState(work_experiences || []);

  const handleAddNew = () => {
    setShowNewForm(true);
  };

  const handleDelete = (experienceId: string) => {
    setExperiences((prev) => prev.filter((exp) => exp.id !== experienceId));
  };

  return (
    <section className="container flex flex-col gap-4 mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h2 className="text-xl font-semibold text-foreground">
            Work Experience
          </h2>
        </div>
        {!showNewForm && (
          <Button
            type="button"
            onClick={handleAddNew}
            variant="outline"
            className="inline-flex items-center gap-2 border-dashed"
          >
            <PlusIcon className="size-4" />
            <span className="hidden sm:block">Add New Experience</span>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {/* Show new experience form if requested */}
        {showNewForm && (
          <WorkExperienceForm portfolio_id={portfolio_id} onDelete={() => setShowNewForm(false)} />
        )}

        {/* Existing experiences */}
        {experiences.map((experience) => (
          <WorkExperienceForm
            key={experience.id}
            experience={experience}
            portfolio_id={portfolio_id}
            onDelete={() => handleDelete(experience.id)}
          />
        ))}

        {experiences.length === 0 && !showNewForm && (
          <div className="text-center py-2xl text-muted-foreground">
            No work experiences added yet. Click "Add New Experience" to get started.
          </div>
        )}
      </div>
    </section>
  );
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const portfolio = context.get(portfolioContext)!;
  const work_experiences = await CareerRepository.listUserWorkExperiences(db, user.id);
  return { work_experiences, portfolio_id: portfolio.id };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    return { success: false, error: 'Sign in again before saving your work experience.' };
  }
  const formData = await request.formData();
  const operation = formData.get('operation') as string;

  switch (operation) {
    case 'create':
    case 'update': {
      const workExperienceDataResult = parseFormData<WorkExperienceFormValues>(
        formData,
        'workExperienceData',
      );

      if ('success' in workExperienceDataResult && !workExperienceDataResult.success) {
        return { success: false, operation, error: 'Your work experience changes couldn’t be read.' };
      }

      const workExperienceData = workExperienceDataResult as WorkExperienceFormValues;

      if (!workExperienceData.portfolio_id) {
        return {
          success: false,
          operation,
          error: 'Choose a portfolio before saving this work experience.',
        };
      }

      try {
        if (operation === 'create') {
          // Insert new experience
          const { id: _id, ...insertData } = workExperienceData;

          // Convert date strings to Date objects for database
          const dbData = {
            ...insertData,
            start_date: stringToDate(insertData.start_date),
            end_date: stringToDate(insertData.end_date),
          };

          const newExperience = await CareerRepository.createWorkExperience(db, user.id, {
            portfolio_id: dbData.portfolio_id,
            role: dbData.role,
            company: dbData.company,
            description: dbData.description,
            start_date: dbData.start_date,
            end_date: dbData.end_date,
            action: dbData.action,
            tags: dbData.tags,
            metadata: dbData.metadata as Record<string, unknown> | undefined,
            sort_order: dbData.sort_order,
            is_visible: dbData.is_visible,
          });

          return {
            success: true,
            operation,
            message: 'Work experience created successfully',
            data: newExperience,
          };
        }

        // Update existing experience
        const { id, ...updateData } = workExperienceData;
        if (!id) {
          return {
            success: false,
            operation,
            error: 'Choose a work experience before saving your changes.',
          };
        }

        // Convert date strings to Date objects for database
        const dbData = {
          ...updateData,
          start_date: stringToDate(updateData.start_date),
          end_date: stringToDate(updateData.end_date),
        };

        await CareerRepository.updateWorkExperience(db, user.id, id, {
          role: dbData.role,
          company: dbData.company,
          description: dbData.description,
          start_date: dbData.start_date,
          end_date: dbData.end_date,
          action: dbData.action,
          tags: dbData.tags,
          metadata: dbData.metadata as Record<string, unknown> | undefined,
          sort_order: dbData.sort_order,
          is_visible: dbData.is_visible,
        });

        return { success: true, operation, message: 'Work experience updated successfully' };
      } catch (error) {
        console.error(`Failed to ${operation} work experience:`, error);
        return {
          success: false,
          operation,
          error:
            operation === 'create'
              ? 'We couldn’t create this work experience. Try again.'
              : 'We couldn’t save this work experience. Try again.',
        };
      }
    }

    case 'delete': {
      const id = formData.get('id') as string;
      const portfolio_id = formData.get('portfolio_id') as string;

      if (!id || !portfolio_id) {
        return { success: false, operation, error: 'Choose a work experience before deleting it.' };
      }

      try {
        await CareerRepository.deleteWorkExperience(db, user.id, id, portfolio_id);
        return { success: true, operation, message: 'Work experience deleted successfully' };
      } catch (error) {
        console.error('Failed to delete work experience:', error);
        return {
          success: false,
          operation,
          error: 'We couldn’t delete this work experience. Try again.',
        };
      }
    }

    default:
      throw new Response('Invalid operation', { status: 400 });
  }
}
