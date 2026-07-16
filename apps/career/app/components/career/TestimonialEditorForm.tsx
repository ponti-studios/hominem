import type { TestimonialRecord as Testimonial } from '@hominem/db';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@ponti-studios/ui/forms';
import { Label } from '@ponti-studios/ui/primitives';
import { useMemo } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import { useFetcher } from 'react-router';

import type { EditorSubmissionResult } from '~/hooks/useCareerEditorSubmission';

import { useCareerEditorSubmission } from '../../hooks/useCareerEditorSubmission';
import { EditorFormActions } from '../EditorFormActions';
import { FormErrorAlert } from '../FormErrorAlert';

interface TestimonialFormValues {
  id?: string;
  name: string;
  title?: string;
  content: string;
  company?: string;
  rating?: number;
  avatarUrl?: string;
  linkedinUrl?: string;
  portfolioId: string;
}

interface TestimonialEditorFormProps {
  testimonial?: Testimonial | null;
  portfolioId: string;
  action: string;
  onSuccess?: (result: EditorSubmissionResult<Testimonial>) => void;
  onDeleteSuccess?: () => void;
}

function buildTestimonialDefaults({
  testimonial,
  portfolioId,
}: {
  testimonial?: Testimonial | null;
  portfolioId: string;
}): TestimonialFormValues {
  return {
    id: testimonial?.id,
    name: testimonial?.name || '',
    title: testimonial?.title || '',
    content: testimonial?.content || '',
    company: testimonial?.company || '',
    rating: testimonial?.rating || undefined,
    avatarUrl: testimonial?.avatarUrl || '',
    linkedinUrl: testimonial?.linkedinUrl || '',
    portfolioId,
  };
}

export function TestimonialEditorForm({
  testimonial,
  portfolioId,
  action,
  onSuccess,
  onDeleteSuccess,
}: TestimonialEditorFormProps) {
  const fetcher = useFetcher();
  const isNew = !testimonial?.id;
  const defaultValues = useMemo(
    () => buildTestimonialDefaults({ testimonial, portfolioId }),
    [testimonial, portfolioId],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<TestimonialFormValues>({
    defaultValues,
    mode: 'onChange',
  });

  const { submissionError, clearSubmissionError } = useCareerEditorSubmission<Testimonial>({
    fetcher,
    errorMessage: 'We couldn’t save this testimonial. Try again.',
    onSuccess: (result) => {
      if (result.operation === 'delete') {
        onDeleteSuccess?.();
        return;
      }

      onSuccess?.(result);
    },
  });

  const onSubmit: SubmitHandler<TestimonialFormValues> = (values) => {
    if (!isDirty && !isNew) {
      return;
    }

    const formData = new FormData();
    formData.append('operation', isNew ? 'create' : 'update');
    formData.append('testimonialData', JSON.stringify(values));

    clearSubmissionError();
    fetcher.submit(formData, { method: 'POST', action });
  };

  const handleReset = () => reset(defaultValues);

  const handleDelete = () => {
    if (!testimonial?.id) {
      return;
    }

    const formData = new FormData();
    formData.append('operation', 'delete');
    formData.append('id', testimonial.id);
    formData.append('portfolioId', portfolioId);

    clearSubmissionError();
    fetcher.submit(formData, { method: 'POST', action });
  };

  const isSaving = fetcher.state === 'submitting';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-md border border-border bg-card p-4 space-y-4"
    >
      <FormErrorAlert title="Testimonial wasn’t saved" message={submissionError} />

      <div className="flex items-center justify-between gap-3">
        <h2 className="heading-3 text-foreground">{isNew ? 'New Testimonial' : 'Testimonial'}</h2>
        <EditorFormActions
          isSaving={isSaving}
          isNew={isNew}
          isDirty={isDirty}
          isValid={isValid}
          submitLabel={isNew ? 'Add Testimonial' : 'Save Changes'}
          onDelete={!isNew ? handleDelete : undefined}
          onReset={!isNew ? handleReset : undefined}
          deleteConfirmTitle="Delete this testimonial?"
          deleteConfirmDescription="This removes the testimonial from your portfolio. This can't be undone."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`name-${testimonial?.id || 'new'}`} className="label">
            Name *
          </Label>
          <Input
            id={`name-${testimonial?.id || 'new'}`}
            type="text"
            {...register('name', { required: "Add the person's name." })}
            aria-describedby={errors.name ? `name-${testimonial?.id || 'new'}-error` : undefined}
            aria-invalid={errors.name ? true : undefined}
            placeholder="Client’s full name"
          />
          {errors.name ? (
            <p
              id={`name-${testimonial?.id || 'new'}-error`}
              role="alert"
              className="body-4 text-destructive"
            >
              {errors.name.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`title-${testimonial?.id || 'new'}`} className="label">
            Job Title
          </Label>
          <Input
            id={`title-${testimonial?.id || 'new'}`}
            type="text"
            {...register('title')}
            placeholder="e.g., Senior Developer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`company-${testimonial?.id || 'new'}`} className="label">
            Company
          </Label>
          <Input
            id={`company-${testimonial?.id || 'new'}`}
            type="text"
            {...register('company')}
            placeholder="Company name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`rating-${testimonial?.id || 'new'}`} className="label">
            Rating (1-5)
          </Label>
          <Controller
            control={control}
            name="rating"
            render={({ field }) => (
              <Select
                value={field.value != null ? String(field.value) : ''}
                onValueChange={(value) => field.onChange(value ? Number(value) : undefined)}
              >
                <SelectTrigger id={`rating-${testimonial?.id || 'new'}`} className="w-full">
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 - Excellent</SelectItem>
                  <SelectItem value="4">4 - Good</SelectItem>
                  <SelectItem value="3">3 - Average</SelectItem>
                  <SelectItem value="2">2 - Fair</SelectItem>
                  <SelectItem value="1">1 - Poor</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`content-${testimonial?.id || 'new'}`} className="label">
          Testimonial *
        </Label>
        <Textarea
          id={`content-${testimonial?.id || 'new'}`}
          {...register('content', { required: 'Add the testimonial copy.' })}
          aria-describedby={
            errors.content ? `content-${testimonial?.id || 'new'}-error` : undefined
          }
          aria-invalid={errors.content ? true : undefined}
          className="min-h-28"
          rows={4}
          placeholder="What did the client say about your work?"
        />
        {errors.content ? (
          <p
            id={`content-${testimonial?.id || 'new'}-error`}
            role="alert"
            className="body-4 text-destructive"
          >
            {errors.content.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`avatarUrl-${testimonial?.id || 'new'}`} className="label">
            Avatar URL (optional)
          </Label>
          <Input
            id={`avatarUrl-${testimonial?.id || 'new'}`}
            type="url"
            {...register('avatarUrl')}
            placeholder="https://example.com/avatar.jpg"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`linkedinUrl-${testimonial?.id || 'new'}`} className="label">
            LinkedIn URL (optional)
          </Label>
          <Input
            id={`linkedinUrl-${testimonial?.id || 'new'}`}
            type="url"
            {...register('linkedinUrl')}
            placeholder="https://linkedin.com/in/username"
          />
        </div>
      </div>
    </form>
  );
}
