import type { WorkExperienceRecord } from '@hominem/db';
import { Button, Field, Input } from '@hominem/ui';
import { PencilIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';

import { FormErrorAlert } from '~/components/FormErrorAlert';
import { useWorkExperienceSection } from '~/hooks/useWorkExperienceSection';
import {
  formatCurrency,
  formatCurrencyInput,
  hasCompensation,
  normalizeCurrencyInput,
  type CompensationFormValues,
} from '~/lib/career/work-experience-form';

import { DetailRow, SectionCard, SectionEmptyState, SectionFormActions } from './section-ui';

export function CompensationSection({ workExperience }: { workExperience: WorkExperienceRecord }) {
  const [isEditing, setIsEditing] = useState(false);
  const defaultValues = useMemo(
    () => ({
      baseSalary: formatCurrencyInput(workExperience.baseSalary),
      signingBonus: formatCurrencyInput(workExperience.signingBonus),
      annualBonus: formatCurrencyInput(workExperience.annualBonus),
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
      baseSalary: normalizeCurrencyInput(values.baseSalary),
      signingBonus: normalizeCurrencyInput(values.signingBonus),
      annualBonus: normalizeCurrencyInput(values.annualBonus),
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
              <Input inputMode="decimal" placeholder="180000" {...register('baseSalary')} />
            </Field>
            <Field label="Signing bonus">
              <Input inputMode="decimal" placeholder="25000" {...register('signingBonus')} />
            </Field>
            <Field label="Annual bonus">
              <Input inputMode="decimal" placeholder="30000" {...register('annualBonus')} />
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
            value={formatCurrency(workExperience.baseSalary) ?? 'Not set'}
          />
          <DetailRow
            label="Signing bonus"
            value={formatCurrency(workExperience.signingBonus) ?? 'Not set'}
          />
          <DetailRow
            label="Annual bonus"
            value={formatCurrency(workExperience.annualBonus) ?? 'Not set'}
          />
        </div>
      ) : (
        <SectionEmptyState copy="Add compensation details if you want this role to be part of your private history." />
      )}
    </SectionCard>
  );
}
