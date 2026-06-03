import type { CareerWorkExperienceRecord as WorkExperience } from '@hominem/db';
import { CareerRepository, getDb } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { Briefcase, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useFieldArray, useForm } from 'react-hook-form';
import type { ActionFunctionArgs } from 'react-router';
import { useFetcher, useOutletContext } from 'react-router';

import type { WorkExperienceMetadata } from '~/types/career-data';

import { useToast } from '../hooks/useToast';
import type { FullPortfolio } from '../lib/portfolio.server';
import {
  createErrorResponse,
  createSuccessResponse,
  parseFormData,
  tryAsync,
  withAuthAction,
} from '../lib/route-utils';
import {
  formatDateForInput,
  nullArrayToUndefined,
  nullToUndefined,
  stringToDate,
} from '../lib/utils';

interface WorkExperienceFormValues {
  id?: string;
  role: string;
  company: string;
  startDate?: string;
  endDate?: string;
  description: string;
  achievements?: { value: string }[];
  action?: string;
  tags?: string[];
  metadata?: WorkExperienceMetadata;
  sortOrder?: number;
  isVisible?: boolean;
  portfolioId: string;
}

interface WorkExperienceEditorSectionProps {
  workExperiences?: WorkExperience[] | null;
  portfolioId: string;
}

function WorkExperienceForm({
  experience,
  portfolioId,
  onDelete,
}: {
  experience?: WorkExperience;
  portfolioId: string;
  onDelete?: () => void;
}) {
  const fetcher = useFetcher();
  const { addToast } = useToast();
  const isNew = !experience?.id;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { isDirty, isValid },
  } = useForm<WorkExperienceFormValues>({
    defaultValues: {
      id: experience?.id,
      role: experience?.role || '',
      company: experience?.company || '',
      startDate: formatDateForInput(experience?.startDate),
      endDate: formatDateForInput(experience?.endDate),
      description: experience?.description || '',
      achievements:
        (experience?.metadata?.achievements as string[])?.map((value) => ({ value })) || [],
      action: nullToUndefined(experience?.action),
      tags: nullArrayToUndefined(experience?.tags) || [],
      metadata: experience?.metadata || {},
      sortOrder: experience?.sortOrder || 0,
      isVisible: experience?.isVisible !== false,
      portfolioId,
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'achievements',
  });

  // Handle fetcher responses
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const result = fetcher.data as {
        success: boolean;
        error?: string;
        message?: string;
        data?: WorkExperience;
      };
      if (result.success) {
        addToast(result.message || 'Work experience saved successfully!', 'success');
        if (result.data && isNew) {
          // Reset form with the returned data (including new ID)
          reset({
            ...result.data,
            startDate: formatDateForInput(result.data.startDate),
            endDate: formatDateForInput(result.data.endDate),
            achievements:
              (result.data.metadata?.achievements as string[])?.map((value) => ({ value })) || [],
            action: nullToUndefined(result.data.action),
            tags: nullArrayToUndefined(result.data.tags) || [],
            metadata: result.data.metadata || {},
          });
        }
      } else {
        addToast(`Failed to save work experience: ${result.error || 'Unknown error'}`, 'error');
      }
    }
  }, [fetcher.state, fetcher.data, reset, addToast, isNew]);

  const onSubmit: SubmitHandler<WorkExperienceFormValues> = (formData) => {
    if (!isDirty && !isNew) {
      addToast('No changes to save.', 'info');
      return;
    }

    if (!formData.role || !formData.company || !formData.startDate || !formData.description) {
      addToast('Please fill in all required fields.', 'error');
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

    fetcher.submit(formDataToSubmit, {
      method: 'POST',
      action: '/editor/work',
    });
  };

  const handleDelete = () => {
    if (!experience?.id) return;

    if (confirm('Are you sure you want to delete this work experience?')) {
      const formData = new FormData();
      formData.append('operation', 'delete');
      formData.append('id', experience.id);
      formData.append('portfolioId', portfolioId);

      fetcher.submit(formData, {
        method: 'POST',
        action: '/editor/work',
      });

      onDelete?.();
    }
  };

  const isSaving = fetcher.state === 'submitting';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-md border border-border bg-card p-4 bg-muted/50 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-2xl tracking-normal font-medium text-foreground font-sans">
          {isNew ? 'New Experience' : experience?.company || 'Work Experience'}
        </h3>
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={isSaving || (!isDirty && !isNew) || !isValid}
            variant="primary"
            size="sm"
          >
            {isSaving ? 'Saving...' : isNew ? 'Add Experience' : 'Save Changes'}
          </Button>
          {!isNew && (
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              variant="destructive"
              size="sm"
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`role-${experience?.id || 'new'}`} className="label">
            Job Title *
          </label>
          <input
            id={`role-${experience?.id || 'new'}`}
            type="text"
            {...register('role', { required: true })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="e.g., Senior Software Engineer"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`company-${experience?.id || 'new'}`} className="label">
            Company *
          </label>
          <input
            id={`company-${experience?.id || 'new'}`}
            type="text"
            {...register('company', { required: true })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="e.g., Google"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`startDate-${experience?.id || 'new'}`} className="label">
            Start Date *
          </label>
          <input
            id={`startDate-${experience?.id || 'new'}`}
            type="date"
            {...register('startDate', { required: true })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`endDate-${experience?.id || 'new'}`} className="label">
            End Date
          </label>
          <input
            id={`endDate-${experience?.id || 'new'}`}
            type="date"
            {...register('endDate')}
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
          {...register('description', { required: true })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 min-h-28"
          rows={4}
          placeholder="Describe your role, responsibilities, and key achievements..."
        />
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

function WorkExperienceEditorSection({
  workExperiences: initialWorkExperiences,
  portfolioId,
}: WorkExperienceEditorSectionProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [experiences, setExperiences] = useState(initialWorkExperiences || []);

  // Update experiences when initialWorkExperiences changes
  useEffect(() => {
    setExperiences(initialWorkExperiences || []);
  }, [initialWorkExperiences]);

  const handleAddNew = () => {
    setShowNewForm(true);
  };

  const handleNewExperienceCreated = () => {
    setShowNewForm(false);
    // The parent component should re-fetch data or we could optimistically update
  };

  const handleDelete = (experienceId: string) => {
    setExperiences((prev) => prev.filter((exp) => exp.id !== experienceId));
  };

  return (
    <section className="container flex flex-col gap-8 mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Work Experience</h2>
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
          <WorkExperienceForm portfolioId={portfolioId} onDelete={() => setShowNewForm(false)} />
        )}

        {/* Existing experiences */}
        {experiences.map((experience) => (
          <WorkExperienceForm
            key={experience.id}
            experience={experience}
            portfolioId={portfolioId}
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

export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user }) => {
    const formData = await args.request.formData();
    const operation = formData.get('operation') as string;

    switch (operation) {
      case 'create':
      case 'update': {
        const workExperienceDataResult = parseFormData<WorkExperienceFormValues>(
          formData,
          'workExperienceData',
        );

        if ('success' in workExperienceDataResult && !workExperienceDataResult.success) {
          return workExperienceDataResult;
        }

        const workExperienceData = workExperienceDataResult as WorkExperienceFormValues;

        if (!workExperienceData.portfolioId) {
          return createErrorResponse('Missing portfolioId');
        }

        return tryAsync(async () => {
          if (operation === 'create') {
            // Insert new experience
            const { id: _id, ...insertData } = workExperienceData;

            // Convert date strings to Date objects for database
            const dbData = {
              ...insertData,
              startDate: stringToDate(insertData.startDate),
              endDate: stringToDate(insertData.endDate),
            };

            const newExperience = await CareerRepository.createWorkExperience(getDb(), user.id, {
              portfolioId: dbData.portfolioId,
              role: dbData.role,
              company: dbData.company,
              description: dbData.description,
              startDate: dbData.startDate,
              endDate: dbData.endDate,
              action: dbData.action,
              tags: dbData.tags,
              metadata: dbData.metadata as Record<string, unknown> | undefined,
              sortOrder: dbData.sortOrder,
              isVisible: dbData.isVisible,
            });

            return createSuccessResponse(newExperience, 'Work experience created successfully');
          }

          // Update existing experience
          const { id, ...updateData } = workExperienceData;
          if (!id) return createErrorResponse('Missing experience ID for update');

          // Convert date strings to Date objects for database
          const dbData = {
            ...updateData,
            startDate: stringToDate(updateData.startDate),
            endDate: stringToDate(updateData.endDate),
          };

          await CareerRepository.updateWorkExperience(getDb(), user.id, id, {
            role: dbData.role,
            company: dbData.company,
            description: dbData.description,
            startDate: dbData.startDate,
            endDate: dbData.endDate,
            action: dbData.action,
            tags: dbData.tags,
            metadata: dbData.metadata as Record<string, unknown> | undefined,
            sortOrder: dbData.sortOrder,
            isVisible: dbData.isVisible,
          });

          return createSuccessResponse(null, 'Work experience updated successfully');
        }, `Failed to ${operation} work experience`);
      }

      case 'delete': {
        const id = formData.get('id') as string;
        const portfolioId = formData.get('portfolioId') as string;

        if (!id || !portfolioId) {
          return createErrorResponse('Missing required fields for deletion');
        }

        return tryAsync(async () => {
          await CareerRepository.deleteWorkExperience(getDb(), user.id, id, portfolioId);

          return createSuccessResponse(null, 'Work experience deleted successfully');
        }, 'Failed to delete work experience');
      }

      default:
        return createErrorResponse('Invalid operation');
    }
  });
}

export default function EditorWork() {
  // Consume portfolio provided by parent editor layout loader via outlet context
  const portfolio = useOutletContext<FullPortfolio>();

  return (
    <WorkExperienceEditorSection
      workExperiences={portfolio.workExperiences}
      portfolioId={portfolio.id}
    />
  );
}
