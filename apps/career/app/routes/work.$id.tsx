import type {
  CareerWorkExperienceRecord as WorkExperienceRecord,
  UpdateCareerWorkExperienceInput,
} from '@hominem/db';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@hominem/ui/alert-dialog';
import { Button } from '@hominem/ui/button';
import { Field } from '@hominem/ui/field';
import { Input } from '@hominem/ui/input';
import { Textarea } from '@hominem/ui/textarea';
import {
  ArrowLeftIcon,
  BriefcaseBusinessIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, type SubmitHandler } from 'react-hook-form';
import { useFetcher, useNavigate } from 'react-router';

import { jsonObject } from '~/lib/db-json';
import { userContext } from '~/lib/middleware';
import { cn } from '~/lib/utils';
import type { WorkExperienceMetadata } from '~/types/career-data';

import { FormErrorAlert } from '../components/FormErrorAlert';
import { useCareerEditorSubmission } from '../hooks/useCareerEditorSubmission';
import { parseFormData } from '../lib/route-utils';
import { Route } from './+types/work.$id';

const EMPLOYMENT_TYPE_OPTIONS = [
  'full-time',
  'part-time',
  'contract',
  'freelance',
  'internship',
  'temporary',
] as const;

const WORK_ARRANGEMENT_OPTIONS = ['office', 'remote', 'hybrid', 'travel'] as const;

const SENIORITY_LEVEL_OPTIONS = [
  'intern',
  'entry-level',
  'mid-level',
  'senior',
  'lead',
  'principal',
  'staff',
  'director',
  'vp',
  'c-level',
] as const;

const REASON_FOR_LEAVING_OPTIONS = [
  'promotion',
  'better_opportunity',
  'relocation',
  'layoff',
  'termination',
  'contract_end',
  'career_change',
  'salary',
  'culture',
  'management',
  'growth',
  'personal',
] as const;

const selectClassName =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex h-11 w-full rounded-md border bg-transparent px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

export async function loader({ context, params }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const { id } = params;
  if (!id) {
    throw new Response('Work experience ID is required', { status: 400 });
  }

  try {
    const { getWorkExperienceById } = await import('~/lib/career/queries/base');
    const { getProjectsByWorkExperience } = await import('~/lib/career/queries/projects');

    const workExperience = await getWorkExperienceById(user.id, id);
    if (!workExperience) {
      throw new Response('Work experience not found', { status: 404 });
    }

    const projects = await getProjectsByWorkExperience(workExperience.portfolio_id, id);

    return {
      workExperience,
      linkedProjectCount: projects.length,
    };
  } catch (error) {
    console.error('Error loading work experience:', error);
    throw new Response('Failed to load work experience', { status: 500 });
  }
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  const { id } = params;
  if (!id) {
    throw new Response('Work experience ID is required', { status: 400 });
  }

  const formData = await request.formData();
  const operation = formData.get('operation');

  if (operation === 'delete') {
    const portfolio_id = formData.get('portfolio_id');

    if (typeof portfolio_id !== 'string' || !portfolio_id) {
      return { success: false, operation, error: 'Choose a work experience before deleting it.' };
    }

    try {
      const { CareerRepository, db } = await import('@hominem/db');

      await CareerRepository.deleteWorkExperience(db, user.id, id, portfolio_id);

      return { success: true, operation };
    } catch (error) {
      console.error('Error deleting work experience:', error);
      return {
        success: false,
        operation,
        error: 'We couldn’t delete this work experience. Try again.',
      };
    }
  }

  if (operation !== 'update') {
    return { success: false, operation, error: 'We couldn’t understand that request.' };
  }

  const updatesResult = parseFormData<UpdateCareerWorkExperienceInput>(formData, 'updates');
  if ('success' in updatesResult && !updatesResult.success) {
    return {
      success: false,
      operation,
      error: 'Your changes couldn’t be read. Refresh and try again.',
    };
  }

  const updates = normalizeWorkExperienceUpdates(updatesResult as UpdateCareerWorkExperienceInput);

  if (!hasDefinedUpdates(updates)) {
    return { success: true, operation };
  }

  try {
    const { getWorkExperienceById, updateWorkExperience } =
      await import('~/lib/career/queries/base');

    let mergedUpdates = updates;

    if (updates.metadata !== undefined) {
      const current = await getWorkExperienceById(user.id, id);

      if (!current) {
        return {
          success: false,
          operation,
          error: 'We couldn’t find this work experience anymore.',
        };
      }

      const currentMetadata = jsonObject<Record<string, unknown>>(current.metadata) ?? {};
      mergedUpdates = {
        ...updates,
        metadata:
          updates.metadata === null
            ? null
            : { ...currentMetadata, ...normalizeMetadata(updates.metadata) },
      };
    }

    await updateWorkExperience(user.id, id, mergedUpdates);

    return { success: true, operation };
  } catch (error) {
    console.error('Error updating work experience:', error);
    return {
      success: false,
      operation,
      error: 'We couldn’t save your changes. Try again.',
    };
  }
}

interface OverviewFormValues {
  role: string;
  company: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  employment_type: string;
  work_arrangement: string;
  description: string;
  location: string;
}

interface AchievementsFormValues {
  items: Array<{ value: string }>;
}

interface TechnologiesFormValues {
  technologies: string;
}

interface CompensationFormValues {
  base_salary: string;
  signing_bonus: string;
  annual_bonus: string;
  equity_value: string;
  equity_percentage: string;
}

interface TeamFormValues {
  seniority_level: string;
  department: string;
  team_size: string;
  direct_reports: string;
  reports_to: string;
}

interface ExitFormValues {
  reason_for_leaving: string;
  exit_notes: string;
}

export default function WorkExperienceDetail({ loaderData }: Route.ComponentProps) {
  const { workExperience, linkedProjectCount } = loaderData;
  const navigate = useNavigate();
  const metadata = useMemo(
    () => jsonObject<WorkExperienceMetadata>(workExperience.metadata) ?? {},
    [workExperience.metadata],
  );

  const deleteFetcher = useFetcher();
  const { submissionError, clearSubmissionError } = useCareerEditorSubmission({
    fetcher: deleteFetcher,
    errorMessage: 'We couldn’t delete this work experience. Try again.',
    onSuccess: (result) => {
      if (result.operation === 'delete') {
        navigate('/work');
      }
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/work')}
          data-testid="back-button"
          className="body-3 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back to work
        </button>
      </div>

      <FormErrorAlert title="Work experience wasn’t deleted" message={submissionError} />

      <section className="border-b pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="space-y-1">
              <h1 className="heading-2 text-foreground">
                {workExperience.role || 'Untitled role'}
              </h1>
              <p className="body-2 text-muted-foreground">
                {workExperience.company || 'Add the company name in Overview'}
              </p>
            </div>

            <div className="body-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
              <span>{formatDateRange(workExperience.start_date, workExperience.end_date)}</span>
              {workExperience.employment_type ? (
                <>
                  <span className="text-border">·</span>
                  <span>{formatOptionalLabel(workExperience.employment_type)}</span>
                </>
              ) : null}
              {workExperience.work_arrangement ? (
                <>
                  <span className="text-border">·</span>
                  <span>{formatOptionalLabel(workExperience.work_arrangement)}</span>
                </>
              ) : null}
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive">
                <TrashIcon className="size-4" />
                Delete experience
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this work experience?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the role from your portfolio and unlinks any details kept here.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => submitDelete(deleteFetcher, clearSubmissionError, workExperience)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <div className="grid gap-4">
        <OverviewSection workExperience={workExperience} metadata={metadata} />
        <AchievementsSection achievements={metadata.achievements ?? []} />
        <TechnologiesSection technologies={metadata.technologies ?? []} />
        <ProjectsSection
          linkedProjectCount={linkedProjectCount}
          onOpen={() => navigate(`/work/${workExperience.id}/projects`)}
        />
        <CompensationSection workExperience={workExperience} />
        <TeamSection workExperience={workExperience} />
        <ExitSection workExperience={workExperience} />
      </div>
    </div>
  );
}

function OverviewSection({
  workExperience,
  metadata,
}: {
  workExperience: WorkExperienceRecord;
  metadata: WorkExperienceMetadata;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const defaultValues = useMemo(
    () => ({
      role: workExperience.role ?? '',
      company: workExperience.company ?? '',
      start_date: toMonthInputValue(workExperience.start_date),
      end_date: toMonthInputValue(workExperience.end_date),
      is_current: !workExperience.end_date,
      employment_type: workExperience.employment_type ?? '',
      work_arrangement: workExperience.work_arrangement ?? '',
      description: workExperience.description ?? '',
      location: metadata.location ?? '',
    }),
    [metadata.location, workExperience],
  );
  const { isSubmitting, submissionError, submitUpdates, clearSubmissionError } =
    useWorkExperienceSection({
      errorMessage: 'We couldn’t save the overview. Try again.',
      onSuccess: () => setIsEditing(false),
    });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<OverviewFormValues>({ defaultValues });
  const isCurrent = watch('is_current');

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit: SubmitHandler<OverviewFormValues> = (values) =>
    submitUpdates({
      role: values.role.trim(),
      company: values.company.trim(),
      start_date: values.start_date || null,
      end_date: values.is_current ? null : values.end_date || null,
      employment_type: normalizeOptionalText(values.employment_type),
      work_arrangement: normalizeOptionalText(values.work_arrangement),
      description: values.description.trim(),
      metadata: {
        location: normalizeOptionalText(values.location),
      },
    });

  return (
    <SectionCard
      title="Overview"
      action={
        isEditing ? null : (
          <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
            <PencilIcon className="size-4" />
            Edit overview
          </Button>
        )
      }
    >
      {isEditing ? (
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormErrorAlert title="Overview wasn’t saved" message={submissionError} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Role" error={errors.role?.message}>
              <Input {...register('role', { required: 'Add the role title.' })} />
            </Field>
            <Field label="Company" error={errors.company?.message}>
              <Input {...register('company', { required: 'Add the company name.' })} />
            </Field>
            <Field label="Start month" error={errors.start_date?.message}>
              <Input type="month" {...register('start_date')} />
            </Field>
            <Field label="End month" helpText="Leave blank for a current role.">
              <Input type="month" disabled={isCurrent} {...register('end_date')} />
            </Field>
          </div>

          <label className="flex items-start gap-3 rounded-md border p-3">
            <input type="checkbox" className="mt-1 size-4" {...register('is_current')} />
            <span className="space-y-1">
              <span className="body-3 block text-foreground">This is my current role</span>
              <span className="body-4 block text-muted-foreground">
                Current roles are treated as the newest entries in your work history.
              </span>
            </span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Employment type">
              <select className={selectClassName} {...register('employment_type')}>
                <option value="">Select one</option>
                {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatOptionalLabel(option)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Work arrangement">
              <select className={selectClassName} {...register('work_arrangement')}>
                <option value="">Select one</option>
                {WORK_ARRANGEMENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatOptionalLabel(option)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Description"
            helpText="Focus on scope, responsibilities, and the shape of the role."
          >
            <Textarea rows={5} {...register('description')} />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Location">
              <Input placeholder="San Francisco, CA" {...register('location')} />
            </Field>
          </div>

          <SectionFormActions
            isSubmitting={isSubmitting}
            onCancel={() => {
              reset(defaultValues);
              clearSubmissionError();
              setIsEditing(false);
            }}
          />
        </form>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <DetailRow label="Role" value={workExperience.role || 'Not set'} />
            <DetailRow label="Company" value={workExperience.company || 'Not set'} />
            <DetailRow
              label="Timeline"
              value={formatDateRange(workExperience.start_date, workExperience.end_date)}
            />
            <DetailRow
              label="Employment"
              value={formatOptionalLabel(workExperience.employment_type) ?? 'Not set'}
            />
            <DetailRow
              label="Arrangement"
              value={formatOptionalLabel(workExperience.work_arrangement) ?? 'Not set'}
            />
            <DetailRow label="Location" value={metadata.location ?? 'Not set'} />
          </div>

          <div className="space-y-2">
            <p className="body-4 uppercase tracking-widest text-muted-foreground">Description</p>
            {workExperience.description ? (
              <p className="body-2 max-w-3xl whitespace-pre-wrap text-foreground/90">
                {workExperience.description}
              </p>
            ) : (
              <SectionEmptyState copy="Add a short description so the role has context beyond the title." />
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function AchievementsSection({ achievements }: { achievements: string[] }) {
  const [isEditing, setIsEditing] = useState(false);
  const defaultValues = useMemo(
    () => ({
      items: achievements.length > 0 ? achievements.map((value) => ({ value })) : [{ value: '' }],
    }),
    [achievements],
  );
  const { isSubmitting, submissionError, submitUpdates, clearSubmissionError } =
    useWorkExperienceSection({
      errorMessage: 'We couldn’t save the achievements. Try again.',
      onSuccess: () => setIsEditing(false),
    });
  const { control, register, handleSubmit, reset } = useForm<AchievementsFormValues>({
    defaultValues,
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit: SubmitHandler<AchievementsFormValues> = (values) =>
    submitUpdates({
      metadata: {
        achievements: values.items
          .map((item) => item.value.trim())
          .filter((value) => value.length > 0),
      },
    });

  return (
    <SectionCard
      title="Achievements"
      action={
        isEditing ? null : (
          <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
            <PencilIcon className="size-4" />
            Edit achievements
          </Button>
        )
      }
    >
      {isEditing ? (
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormErrorAlert title="Achievements weren’t saved" message={submissionError} />

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-3">
                <span className="body-3 mt-3 text-muted-foreground">•</span>
                <div className="flex-1">
                  <Field label={index === 0 ? 'Achievement' : undefined}>
                    <Textarea rows={3} {...register(`items.${index}.value` as const)} />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    fields.length > 1 ? remove(index) : reset({ items: [{ value: '' }] })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={() => append({ value: '' })}>
            <PlusIcon className="size-4" />
            Add achievement
          </Button>

          <SectionFormActions
            isSubmitting={isSubmitting}
            onCancel={() => {
              reset(defaultValues);
              clearSubmissionError();
              setIsEditing(false);
            }}
          />
        </form>
      ) : achievements.length > 0 ? (
        <div className="space-y-3">
          {achievements.map((achievement) => (
            <div key={achievement} className="flex items-start gap-3">
              <span className="body-3 mt-0.5 text-muted-foreground">•</span>
              <p className="body-2 max-w-3xl whitespace-pre-wrap text-foreground/90">
                {achievement}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <SectionEmptyState copy="Add concrete wins, launches, or measurable outcomes for this role." />
      )}
    </SectionCard>
  );
}

function TechnologiesSection({ technologies }: { technologies: string[] }) {
  const [isEditing, setIsEditing] = useState(false);
  const defaultValues = useMemo(
    () => ({
      technologies: technologies.join(', '),
    }),
    [technologies],
  );
  const { isSubmitting, submissionError, submitUpdates, clearSubmissionError } =
    useWorkExperienceSection({
      errorMessage: 'We couldn’t save the technologies. Try again.',
      onSuccess: () => setIsEditing(false),
    });
  const { register, handleSubmit, reset } = useForm<TechnologiesFormValues>({ defaultValues });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit: SubmitHandler<TechnologiesFormValues> = (values) =>
    submitUpdates({
      metadata: {
        technologies: values.technologies
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      },
    });

  return (
    <SectionCard
      title="Technologies"
      action={
        isEditing ? null : (
          <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
            <PencilIcon className="size-4" />
            Edit technologies
          </Button>
        )
      }
    >
      {isEditing ? (
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormErrorAlert title="Technologies weren’t saved" message={submissionError} />
          <Field
            label="Technologies"
            helpText="Use a comma-separated list, like React, TypeScript, GraphQL."
          >
            <Textarea rows={4} {...register('technologies')} />
          </Field>

          <SectionFormActions
            isSubmitting={isSubmitting}
            onCancel={() => {
              reset(defaultValues);
              clearSubmissionError();
              setIsEditing(false);
            }}
          />
        </form>
      ) : technologies.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {technologies.map((technology) => (
            <span
              key={technology}
              className="body-4 rounded-full border px-3 py-1 text-foreground/90"
            >
              {technology}
            </span>
          ))}
        </div>
      ) : (
        <SectionEmptyState copy="Add the tools or technologies that define this experience." />
      )}
    </SectionCard>
  );
}

function ProjectsSection({
  linkedProjectCount,
  onOpen,
}: {
  linkedProjectCount: number;
  onOpen: () => void;
}) {
  return (
    <SectionCard
      title="Projects"
      action={
        <Button type="button" variant="outline" onClick={onOpen}>
          <BriefcaseBusinessIcon className="size-4" />
          Manage projects
        </Button>
      }
    >
      <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="body-2 text-foreground">
            {linkedProjectCount === 0
              ? 'No projects are linked to this role yet.'
              : `${linkedProjectCount} project${linkedProjectCount === 1 ? '' : 's'} linked to this role.`}
          </p>
          <p className="body-4 text-muted-foreground">
            Use the projects screen to attach launches, case studies, or shipped work to this
            experience.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function CompensationSection({ workExperience }: { workExperience: WorkExperienceRecord }) {
  const [isEditing, setIsEditing] = useState(false);
  const defaultValues = useMemo(
    () => ({
      base_salary: formatCurrencyInput(workExperience.base_salary),
      signing_bonus: formatCurrencyInput(workExperience.signing_bonus),
      annual_bonus: formatCurrencyInput(workExperience.annual_bonus),
      equity_value: formatCurrencyInput(workExperience.equity_value),
      equity_percentage: workExperience.equity_percentage ?? '',
    }),
    [workExperience],
  );
  const { isSubmitting, submissionError, submitUpdates, clearSubmissionError } =
    useWorkExperienceSection({
      errorMessage: 'We couldn’t save the compensation details. Try again.',
      onSuccess: () => setIsEditing(false),
    });
  const { register, handleSubmit, reset } = useForm<CompensationFormValues>({ defaultValues });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit: SubmitHandler<CompensationFormValues> = (values) =>
    submitUpdates({
      base_salary: normalizeCurrencyInput(values.base_salary),
      signing_bonus: normalizeCurrencyInput(values.signing_bonus),
      annual_bonus: normalizeCurrencyInput(values.annual_bonus),
      equity_value: normalizeCurrencyInput(values.equity_value),
      equity_percentage: normalizeOptionalText(values.equity_percentage),
    });

  return (
    <SectionCard
      title="Compensation"
      action={
        isEditing ? null : (
          <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
            <PencilIcon className="size-4" />
            Edit compensation
          </Button>
        )
      }
    >
      {isEditing ? (
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormErrorAlert title="Compensation wasn’t saved" message={submissionError} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Base salary" helpText="Enter the annual amount in dollars.">
              <Input inputMode="decimal" placeholder="180000" {...register('base_salary')} />
            </Field>
            <Field label="Signing bonus">
              <Input inputMode="decimal" placeholder="25000" {...register('signing_bonus')} />
            </Field>
            <Field label="Annual bonus">
              <Input inputMode="decimal" placeholder="30000" {...register('annual_bonus')} />
            </Field>
            <Field label="Equity value">
              <Input inputMode="decimal" placeholder="50000" {...register('equity_value')} />
            </Field>
            <Field label="Equity percentage">
              <Input placeholder="0.25%" {...register('equity_percentage')} />
            </Field>
          </div>

          <SectionFormActions
            isSubmitting={isSubmitting}
            onCancel={() => {
              reset(defaultValues);
              clearSubmissionError();
              setIsEditing(false);
            }}
          />
        </form>
      ) : hasCompensation(workExperience) ? (
        <div className="grid gap-3 md:grid-cols-2">
          <DetailRow
            label="Base salary"
            value={formatCurrency(workExperience.base_salary) ?? 'Not set'}
          />
          <DetailRow
            label="Signing bonus"
            value={formatCurrency(workExperience.signing_bonus) ?? 'Not set'}
          />
          <DetailRow
            label="Annual bonus"
            value={formatCurrency(workExperience.annual_bonus) ?? 'Not set'}
          />
          <DetailRow
            label="Equity value"
            value={formatCurrency(workExperience.equity_value) ?? 'Not set'}
          />
          <DetailRow
            label="Equity percentage"
            value={workExperience.equity_percentage ?? 'Not set'}
          />
        </div>
      ) : (
        <SectionEmptyState copy="Add compensation details if you want this role to be part of your private history." />
      )}
    </SectionCard>
  );
}

function TeamSection({ workExperience }: { workExperience: WorkExperienceRecord }) {
  const [isEditing, setIsEditing] = useState(false);
  const defaultValues = useMemo(
    () => ({
      seniority_level: workExperience.seniority_level ?? '',
      department: workExperience.department ?? '',
      team_size: workExperience.team_size?.toString() ?? '',
      direct_reports: workExperience.direct_reports?.toString() ?? '',
      reports_to: workExperience.reports_to ?? '',
    }),
    [workExperience],
  );
  const { isSubmitting, submissionError, submitUpdates, clearSubmissionError } =
    useWorkExperienceSection({
      errorMessage: 'We couldn’t save the team details. Try again.',
      onSuccess: () => setIsEditing(false),
    });
  const { register, handleSubmit, reset } = useForm<TeamFormValues>({ defaultValues });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit: SubmitHandler<TeamFormValues> = (values) =>
    submitUpdates({
      seniority_level: normalizeOptionalText(values.seniority_level),
      department: normalizeOptionalText(values.department),
      team_size: normalizeOptionalNumber(values.team_size),
      direct_reports: normalizeOptionalNumber(values.direct_reports),
      reports_to: normalizeOptionalText(values.reports_to),
    });

  return (
    <SectionCard
      title="Team"
      action={
        isEditing ? null : (
          <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
            <PencilIcon className="size-4" />
            Edit team
          </Button>
        )
      }
    >
      {isEditing ? (
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormErrorAlert title="Team details weren’t saved" message={submissionError} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Seniority level">
              <select className={selectClassName} {...register('seniority_level')}>
                <option value="">Select one</option>
                {SENIORITY_LEVEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatOptionalLabel(option)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <Input placeholder="Engineering" {...register('department')} />
            </Field>
            <Field label="Team size">
              <Input inputMode="numeric" placeholder="12" {...register('team_size')} />
            </Field>
            <Field label="Direct reports">
              <Input inputMode="numeric" placeholder="4" {...register('direct_reports')} />
            </Field>
          </div>

          <Field label="Reports to">
            <Input placeholder="Director of Engineering" {...register('reports_to')} />
          </Field>

          <SectionFormActions
            isSubmitting={isSubmitting}
            onCancel={() => {
              reset(defaultValues);
              clearSubmissionError();
              setIsEditing(false);
            }}
          />
        </form>
      ) : hasTeamDetails(workExperience) ? (
        <div className="grid gap-3 md:grid-cols-2">
          <DetailRow
            label="Seniority"
            value={formatOptionalLabel(workExperience.seniority_level) ?? 'Not set'}
          />
          <DetailRow label="Department" value={workExperience.department ?? 'Not set'} />
          <DetailRow
            label="Team size"
            value={workExperience.team_size != null ? `${workExperience.team_size}` : 'Not set'}
          />
          <DetailRow
            label="Direct reports"
            value={
              workExperience.direct_reports != null ? `${workExperience.direct_reports}` : 'Not set'
            }
          />
          <DetailRow label="Reports to" value={workExperience.reports_to ?? 'Not set'} />
        </div>
      ) : (
        <SectionEmptyState copy="Add team context if this role included leadership, scope, or reporting details." />
      )}
    </SectionCard>
  );
}

function ExitSection({ workExperience }: { workExperience: WorkExperienceRecord }) {
  const [isEditing, setIsEditing] = useState(false);
  const defaultValues = useMemo(
    () => ({
      reason_for_leaving: workExperience.reason_for_leaving ?? '',
      exit_notes: workExperience.exit_notes ?? '',
    }),
    [workExperience],
  );
  const { isSubmitting, submissionError, submitUpdates, clearSubmissionError } =
    useWorkExperienceSection({
      errorMessage: 'We couldn’t save the exit details. Try again.',
      onSuccess: () => setIsEditing(false),
    });
  const { register, handleSubmit, reset } = useForm<ExitFormValues>({ defaultValues });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit: SubmitHandler<ExitFormValues> = (values) =>
    submitUpdates({
      reason_for_leaving: normalizeOptionalText(values.reason_for_leaving),
      exit_notes: normalizeOptionalText(values.exit_notes),
    });

  return (
    <SectionCard
      title="Exit"
      action={
        isEditing ? null : (
          <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
            <PencilIcon className="size-4" />
            Edit exit
          </Button>
        )
      }
    >
      {isEditing ? (
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormErrorAlert title="Exit details weren’t saved" message={submissionError} />

          <Field label="Reason for leaving">
            <select className={selectClassName} {...register('reason_for_leaving')}>
              <option value="">Select one</option>
              {REASON_FOR_LEAVING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatOptionalLabel(option)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Exit notes">
            <Textarea
              rows={4}
              placeholder="Any nuance you want to remember about the transition."
              {...register('exit_notes')}
            />
          </Field>

          <SectionFormActions
            isSubmitting={isSubmitting}
            onCancel={() => {
              reset(defaultValues);
              clearSubmissionError();
              setIsEditing(false);
            }}
          />
        </form>
      ) : hasExitDetails(workExperience) ? (
        <div className="space-y-4">
          <DetailRow
            label="Reason for leaving"
            value={formatOptionalLabel(workExperience.reason_for_leaving) ?? 'Not set'}
          />
          {workExperience.exit_notes ? (
            <div className="space-y-2">
              <p className="body-4 uppercase tracking-widest text-muted-foreground">Notes</p>
              <p className="body-2 max-w-3xl whitespace-pre-wrap text-foreground/90">
                {workExperience.exit_notes}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <SectionEmptyState copy="Leave this empty unless the reason for ending the role is important to keep." />
      )}
    </SectionCard>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="heading-4 text-foreground">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function DetailRow({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('space-y-1', compact ? '' : 'rounded-md border p-3')}>
      <p className="body-4 uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="body-2 break-words text-foreground">{value}</p>
    </div>
  );
}

function SectionEmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-md border border-dashed p-4">
      <p className="body-3 max-w-2xl text-muted-foreground">{copy}</p>
    </div>
  );
}

function SectionFormActions({
  isSubmitting,
  onCancel,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" isLoading={isSubmitting} loadingLabel="Saving">
        Save changes
      </Button>
    </div>
  );
}

function useWorkExperienceSection({
  errorMessage,
  onSuccess,
}: {
  errorMessage: string;
  onSuccess?: () => void;
}) {
  const fetcher = useFetcher();
  const { submissionError, clearSubmissionError } = useCareerEditorSubmission({
    fetcher,
    errorMessage,
    onSuccess: (result) => {
      if (result.operation === 'update') {
        onSuccess?.();
      }
    },
  });

  return {
    fetcher,
    isSubmitting: fetcher.state !== 'idle',
    submissionError,
    clearSubmissionError,
    submitUpdates: (updates: UpdateCareerWorkExperienceInput) =>
      submitWorkExperienceUpdates(fetcher, clearSubmissionError, updates),
  };
}

function submitDelete(
  fetcher: ReturnType<typeof useFetcher>,
  clearSubmissionError: () => void,
  workExperience: WorkExperienceRecord,
) {
  const formData = new FormData();
  formData.append('operation', 'delete');
  formData.append('portfolio_id', workExperience.portfolio_id);
  clearSubmissionError();
  fetcher.submit(formData, { method: 'POST' });
}

function submitWorkExperienceUpdates(
  fetcher: ReturnType<typeof useFetcher>,
  clearSubmissionError: () => void,
  updates: UpdateCareerWorkExperienceInput,
) {
  const formData = new FormData();
  formData.append('operation', 'update');
  formData.append('updates', JSON.stringify(updates));
  clearSubmissionError();
  fetcher.submit(formData, { method: 'POST' });
}

function normalizeWorkExperienceUpdates(
  updates: UpdateCareerWorkExperienceInput,
): UpdateCareerWorkExperienceInput {
  return {
    ...updates,
    role: updates.role !== undefined ? updates.role.trim() : undefined,
    company: updates.company !== undefined ? updates.company.trim() : undefined,
    description:
      updates.description !== undefined
        ? typeof updates.description === 'string'
          ? updates.description.trim()
          : updates.description
        : undefined,
    start_date:
      updates.start_date !== undefined ? normalizeDateInput(updates.start_date) : undefined,
    end_date: updates.end_date !== undefined ? normalizeDateInput(updates.end_date) : undefined,
    base_salary:
      updates.base_salary !== undefined ? normalizeCurrencyInput(updates.base_salary) : undefined,
    equity_value:
      updates.equity_value !== undefined ? normalizeCurrencyInput(updates.equity_value) : undefined,
    signing_bonus:
      updates.signing_bonus !== undefined
        ? normalizeCurrencyInput(updates.signing_bonus)
        : undefined,
    annual_bonus:
      updates.annual_bonus !== undefined ? normalizeCurrencyInput(updates.annual_bonus) : undefined,
    equity_percentage:
      updates.equity_percentage !== undefined
        ? normalizeOptionalText(updates.equity_percentage)
        : undefined,
    employment_type:
      updates.employment_type !== undefined
        ? normalizeOptionalText(updates.employment_type)
        : undefined,
    work_arrangement:
      updates.work_arrangement !== undefined
        ? normalizeOptionalText(updates.work_arrangement)
        : undefined,
    seniority_level:
      updates.seniority_level !== undefined
        ? normalizeOptionalText(updates.seniority_level)
        : undefined,
    department:
      updates.department !== undefined ? normalizeOptionalText(updates.department) : undefined,
    team_size:
      updates.team_size !== undefined ? normalizeOptionalNumber(updates.team_size) : undefined,
    direct_reports:
      updates.direct_reports !== undefined
        ? normalizeOptionalNumber(updates.direct_reports)
        : undefined,
    reports_to:
      updates.reports_to !== undefined ? normalizeOptionalText(updates.reports_to) : undefined,
    reason_for_leaving:
      updates.reason_for_leaving !== undefined
        ? normalizeOptionalText(updates.reason_for_leaving)
        : undefined,
    exit_notes:
      updates.exit_notes !== undefined ? normalizeOptionalText(updates.exit_notes) : undefined,
    metadata: updates.metadata !== undefined ? normalizeMetadata(updates.metadata) : undefined,
  };
}

function normalizeMetadata(metadata: Record<string, unknown> | null) {
  if (metadata === null) {
    return null;
  }

  const normalized: Record<string, unknown> = { ...metadata };

  for (const key of ['company_size', 'industry', 'location', 'website'] as const) {
    if (typeof normalized[key] === 'string') {
      normalized[key] = normalizeOptionalText(normalized[key]);
    }
  }

  for (const key of ['achievements', 'technologies'] as const) {
    if (Array.isArray(normalized[key])) {
      normalized[key] = normalized[key]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    }
  }

  return normalized;
}

function hasDefinedUpdates(updates: UpdateCareerWorkExperienceInput) {
  return Object.values(updates).some((value) => value !== undefined);
}

function normalizeOptionalText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrencyInput(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const sanitized = value.replace(/[$,]/g, '').trim();
  if (!sanitized) {
    return null;
  }

  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function normalizeDateInput(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toMonthInputValue(value: Date | string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthYear(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
) {
  const start = formatMonthYear(startDate) ?? 'Start date not set';
  const end = formatMonthYear(endDate) ?? 'Present';
  return `${start} — ${end}`;
}

function formatOptionalLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) {
    return null;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCurrencyInput(cents: number | null | undefined) {
  if (cents == null) {
    return '';
  }

  return `${cents / 100}`;
}

function hasCompensation(workExperience: WorkExperienceRecord) {
  return [
    workExperience.base_salary,
    workExperience.signing_bonus,
    workExperience.annual_bonus,
    workExperience.equity_value,
    workExperience.equity_percentage,
  ].some((value) => value !== null && value !== undefined && value !== '');
}

function hasTeamDetails(workExperience: WorkExperienceRecord) {
  return [
    workExperience.seniority_level,
    workExperience.department,
    workExperience.team_size,
    workExperience.direct_reports,
    workExperience.reports_to,
  ].some((value) => value !== null && value !== undefined && value !== '');
}

function hasExitDetails(workExperience: WorkExperienceRecord) {
  return [workExperience.reason_for_leaving, workExperience.exit_notes].some(
    (value) => value !== null && value !== undefined && value !== '',
  );
}
