import type { CareerWorkExperienceRecord as WorkExperience } from '@hominem/db';
import { CareerRepository, db } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { PencilLineIcon, PlusIcon } from 'lucide-react';
import { useFetcher, useNavigate } from 'react-router';

import type { WorkExperienceMetadata } from '~/types/career-data';

import { FormErrorAlert } from '../components/FormErrorAlert';
import { useCareerEditorSubmission } from '../hooks/useCareerEditorSubmission';
import { portfolioContext, userContext } from '../lib/middleware';
import { parseFormData } from '../lib/route-utils';
import { stringToDate } from '../lib/utils';
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

function formatMonthYear(date: Date | string | null | undefined) {
  if (!date) return 'Present';

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function WorkExperienceSummaryCard({
  experience,
  onEdit,
}: {
  experience: WorkExperience;
  onEdit: (id: string) => void;
}) {
  return (
    <li className="transition-colors duration-150 hover:bg-muted/30 focus-within:bg-muted/30">
      <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto_auto]">
        <div className="min-w-0">
          <p className="body-2 truncate text-text-primary">
            {experience.company?.trim() || 'Untitled client'}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
            <p className="body-4 truncate text-text-secondary">
              {experience.role?.trim() || 'Untitled role'}
            </p>
            <span className="body-4 text-text-tertiary">·</span>
            <p className="body-4 text-text-tertiary">
              {formatMonthYear(experience.start_date)} - {formatMonthYear(experience.end_date)}
            </p>
          </div>
        </div>

        <p className="body-2 hidden truncate text-text-secondary md:block">
          {experience.role?.trim() || 'Untitled role'}
        </p>

        <p className="body-4 hidden whitespace-nowrap text-text-tertiary md:block">
          {formatMonthYear(experience.start_date)} - {formatMonthYear(experience.end_date)}
        </p>

        <Button
          type="button"
          onClick={() => onEdit(experience.id)}
          variant="ghost"
          size="icon"
          className="h-11 w-11 justify-self-end text-text-secondary"
          aria-label={`Edit ${experience.role?.trim() || 'work experience'} at ${experience.company?.trim() || 'client'}`}
        >
          <PencilLineIcon className="size-4" />
        </Button>
      </div>
    </li>
  );
}

export default function Work({ loaderData }: Route.ComponentProps) {
  const draftFetcher = useFetcher();
  const navigate = useNavigate();
  const { work_experiences, portfolio_id } = loaderData;
  const experiences = work_experiences || [];

  const { submissionError, clearSubmissionError } = useCareerEditorSubmission<WorkExperience>({
    fetcher: draftFetcher,
    errorMessage: 'We couldn’t create a new work experience. Try again.',
    onSuccess: (result) => {
      if (!result.data) {
        return;
      }

      navigate(`/work/${result.data.id}`);
    },
  });

  const handleAddNew = () => {
    const formData = new FormData();
    formData.append('operation', 'create');
    formData.append(
      'workExperienceData',
      JSON.stringify({
        role: '',
        company: '',
        description: '',
        start_date: '',
        end_date: '',
        achievements: [],
        metadata: {},
        sort_order: experiences.length,
        is_visible: true,
        portfolio_id,
      } satisfies WorkExperienceFormValues),
    );

    clearSubmissionError();
    draftFetcher.submit(formData, {
      method: 'POST',
      action: '/work',
    });
  };

  return (
    <section className="container flex flex-col gap-4 mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h2 className="heading-2 text-foreground">Work Experience</h2>
        </div>
        <Button
          type="button"
          onClick={handleAddNew}
          variant="outline"
          disabled={draftFetcher.state === 'submitting'}
          className="inline-flex items-center gap-2 border-dashed"
          isLoading={draftFetcher.state === 'submitting'}
          loadingLabel="Creating..."
        >
          <PlusIcon className="size-4" />
          <span className="hidden sm:block">Add New Experience</span>
        </Button>
      </div>

      <FormErrorAlert title="Work experience wasn’t created" message={submissionError} />

      <div className="flex flex-col gap-6">
        {experiences.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <ul className="divide-y divide-border">
              {experiences.map((experience) => (
                <WorkExperienceSummaryCard
                  key={experience.id}
                  experience={experience}
                  onEdit={(id) => navigate(`/work/${id}`)}
                />
              ))}
            </ul>
          </div>
        ) : (
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
  const work_experiences = await CareerRepository.listUserWorkExperiences(db, user.id, 'desc');
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
        return {
          success: false,
          operation,
          error: 'Your work experience changes couldn’t be read.',
        };
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
