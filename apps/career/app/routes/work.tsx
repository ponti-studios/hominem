import type { WorkExperienceRecord as WorkExperience } from '@hominem/db';
import { db, WorkExperienceRepository } from '@hominem/db';
import { Button, EmptyState } from '@hominem/ui';
import { stringToDate } from '@hominem/utils/dates';
import { PencilLineIcon, PlusIcon, UploadIcon } from 'lucide-react';
import { useState } from 'react';
import { useFetcher, useNavigate, useRevalidator } from 'react-router';

import type { WorkExperienceMetadata } from '~/lib/career/queries/career-progression';

import { FormErrorAlert } from '../components/FormErrorAlert';
import { UploadResumeForm } from '../components/UploadResumeForm';
import { useCareerEditorSubmission } from '../hooks/useCareerEditorSubmission';
import { portfolioContext, userContext } from '../lib/middleware';
import { parseFormData } from '../lib/route-utils';
import { Route } from './+types/work';

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
    <li className="transition-colors duration-150">
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
              {formatMonthYear(experience.startDate)} - {formatMonthYear(experience.endDate)}
            </p>
          </div>
        </div>

        <p className="body-2 hidden truncate text-text-secondary md:block">
          {experience.role?.trim() || 'Untitled role'}
        </p>

        <p className="body-4 hidden whitespace-nowrap text-text-tertiary md:block">
          {formatMonthYear(experience.startDate)} - {formatMonthYear(experience.endDate)}
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
  const revalidator = useRevalidator();
  const { work_experiences, portfolioId } = loaderData;
  const experiences = work_experiences || [];
  const [showResumeUpload, setShowResumeUpload] = useState(false);

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
        startDate: '',
        endDate: '',
        achievements: [],
        metadata: {},
        sortOrder: experiences.length,
        isVisible: true,
        portfolioId,
      } satisfies WorkExperienceFormValues),
    );

    clearSubmissionError();
    draftFetcher.submit(formData, {
      method: 'POST',
      action: '/work',
    });
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="heading-2 text-foreground">Work Experience</h2>
        <Button
          type="button"
          onClick={handleAddNew}
          variant="outline"
          size="icon"
          disabled={draftFetcher.state === 'submitting'}
          aria-label="Add new experience"
        >
          <PlusIcon className="size-4" />
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
        ) : showResumeUpload ? (
          <div className="mx-auto flex w-full max-w-md flex-col gap-4">
            <UploadResumeForm
              mode="replace"
              showHeading
              onUploadStart={() => undefined}
              onUploadComplete={() => {
                setShowResumeUpload(false);
                revalidator.revalidate();
              }}
              onUploadError={() => undefined}
            />
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setShowResumeUpload(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <EmptyState
            title="Build your foundation"
            description="Upload a resume to extract roles automatically, or add your first role by hand."
            variant="dashed"
            action={
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Button type="button" onClick={() => setShowResumeUpload(true)}>
                  <UploadIcon className="size-4" />
                  Upload resume
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddNew}
                  disabled={draftFetcher.state === 'submitting'}
                  isLoading={draftFetcher.state === 'submitting'}
                  loadingLabel="Creating…"
                >
                  <PlusIcon className="size-4" />
                  Add a role
                </Button>
              </div>
            }
          />
        )}
      </div>
    </section>
  );
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const portfolio = context.get(portfolioContext)!;
  const work_experiences = await WorkExperienceRepository.listUserWorkExperiences(
    db,
    user.id,
    'desc',
  );
  return { work_experiences, portfolioId: portfolio.id };
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

      if (!workExperienceData.portfolioId) {
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
            startDate: stringToDate(insertData.startDate),
            endDate: stringToDate(insertData.endDate),
          };

          const newExperience = await WorkExperienceRepository.createWorkExperience(db, user.id, {
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
          startDate: stringToDate(updateData.startDate),
          endDate: stringToDate(updateData.endDate),
        };

        await WorkExperienceRepository.updateWorkExperience(db, user.id, id, {
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
      const portfolioId = formData.get('portfolioId') as string;

      if (!id || !portfolioId) {
        return { success: false, operation, error: 'Choose a work experience before deleting it.' };
      }

      try {
        await WorkExperienceRepository.deleteWorkExperience(db, user.id, id, portfolioId);
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
