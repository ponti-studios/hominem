import type { CareerTestimonialRecord as Testimonial } from '@hominem/db';
import { CareerRepository, db } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { Input } from '@hominem/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hominem/ui/select';
import { Textarea } from '@hominem/ui/textarea';
import { PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import { useFetcher } from 'react-router';

import { FormErrorAlert } from '../components/FormErrorAlert';
import { useCareerEditorSubmission } from '../hooks/useCareerEditorSubmission';
import { portfolioContext, userContext } from '../lib/middleware';
import { parseFormData } from '../lib/route-utils';
import { Route } from './+types/testimonials';

interface TestimonialFormValues {
  id?: string;
  name: string;
  title?: string;
  content: string;
  company?: string;
  rating?: number;
  avatar_url?: string;
  linkedin_url?: string;
  portfolio_id: string;
}

interface TestimonialsEditorSectionProps {
  testimonials?: Testimonial[] | null;
  portfolio_id: string;
}

function TestimonialForm({
  testimonial,
  portfolio_id,
  onDelete,
}: {
  testimonial?: Testimonial;
  portfolio_id: string;
  onDelete?: () => void;
}) {
  const fetcher = useFetcher();
  const isNew = !testimonial?.id;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<TestimonialFormValues>({
    defaultValues: {
      id: testimonial?.id,
      name: testimonial?.name || '',
      title: testimonial?.title || '',
      content: testimonial?.content || '',
      company: testimonial?.company || '',
      rating: testimonial?.rating || undefined,
      avatar_url: testimonial?.avatar_url || '',
      linkedin_url: testimonial?.linkedin_url || '',
      portfolio_id,
    },
    mode: 'onChange',
  });

  const { submissionError, clearSubmissionError } = useCareerEditorSubmission<Testimonial>({
    fetcher,
    errorMessage: 'We couldn’t save this testimonial. Try again.',
    onSuccess: (result) => {
      if (result.operation === 'delete') {
        onDelete?.();
        return;
      }

      if (!result.data || !isNew) {
        return;
      }

      reset({
        id: result.data.id,
        name: result.data.name || '',
        title: result.data.title || '',
        content: result.data.content || '',
        company: result.data.company || '',
        rating: result.data.rating || undefined,
        avatar_url: result.data.avatar_url || '',
        linkedin_url: result.data.linkedin_url || '',
        portfolio_id: result.data.portfolio_id,
      });
    },
  });

  const onSubmit: SubmitHandler<TestimonialFormValues> = (formData) => {
    if (!isDirty && !isNew) {
      return;
    }

    const formDataToSubmit = new FormData();
    formDataToSubmit.append('operation', isNew ? 'create' : 'update');
    formDataToSubmit.append('testimonialData', JSON.stringify(formData));

    clearSubmissionError();
    fetcher.submit(formDataToSubmit, {
      method: 'POST',
      action: '/testimonials',
    });
  };

  const handleDelete = () => {
    if (!testimonial?.id) return;

    if (confirm('Are you sure you want to delete this testimonial?')) {
      const formData = new FormData();
      formData.append('operation', 'delete');
      formData.append('id', testimonial.id);
      formData.append('portfolio_id', portfolio_id);

      clearSubmissionError();
      fetcher.submit(formData, {
        method: 'POST',
        action: '/testimonials',
      });
    }
  };

  const isSaving = fetcher.state === 'submitting';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-md border border-border bg-card p-4 bg-muted/50 space-y-4"
    >
      <FormErrorAlert title="Testimonial wasn’t saved" message={submissionError} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="min-w-0 heading-3 text-foreground">
          {isNew ? 'New Testimonial' : 'Testimonial'}
        </h3>
        <div className="flex gap-2 sm:justify-end">
          <Button
            type="submit"
            disabled={isSaving || (!isDirty && !isNew) || !isValid}
            variant="default"
            size="sm"
            isLoading={isSaving}
            loadingLabel="Saving..."
            className="w-full sm:w-auto"
          >
            {isNew ? 'Add Testimonial' : 'Save Changes'}
          </Button>
          {!isNew && (
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              variant="destructive"
              size="sm"
              className="w-full sm:w-auto"
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`name-${testimonial?.id || 'new'}`} className="label">
            Name *
          </label>
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
          <label htmlFor={`title-${testimonial?.id || 'new'}`} className="label">
            Job Title
          </label>
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
          <label htmlFor={`company-${testimonial?.id || 'new'}`} className="label">
            Company
          </label>
          <Input
            id={`company-${testimonial?.id || 'new'}`}
            type="text"
            {...register('company')}
            placeholder="Company name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`rating-${testimonial?.id || 'new'}`} className="label">
            Rating (1-5)
          </label>
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
        <label htmlFor={`content-${testimonial?.id || 'new'}`} className="label">
          Testimonial *
        </label>
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
          <label htmlFor={`avatar_url-${testimonial?.id || 'new'}`} className="label">
            Avatar URL (optional)
          </label>
          <Input
            id={`avatar_url-${testimonial?.id || 'new'}`}
            type="url"
            {...register('avatar_url')}
            placeholder="https://example.com/avatar.jpg"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`linkedin_url-${testimonial?.id || 'new'}`} className="label">
            LinkedIn URL (optional)
          </label>
          <Input
            id={`linkedin_url-${testimonial?.id || 'new'}`}
            type="url"
            {...register('linkedin_url')}
            placeholder="https://linkedin.com/in/username"
          />
        </div>
      </div>
    </form>
  );
}

function TestimonialsEditorSection({
  testimonials: initialTestimonials,
  portfolio_id,
}: TestimonialsEditorSectionProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [testimonials, setTestimonials] = useState(initialTestimonials || []);

  // Update testimonials when initialTestimonials changes
  useEffect(() => {
    setTestimonials(initialTestimonials || []);
  }, [initialTestimonials]);

  const handleAddNew = () => {
    setShowNewForm(true);
  };

  const handleDelete = (testimonialId: string) => {
    setTestimonials((prev) => prev.filter((testimonial) => testimonial.id !== testimonialId));
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="heading-2 text-foreground">Client Testimonials</h2>
        {!showNewForm && (
          <Button
            type="button"
            onClick={handleAddNew}
            variant="outline"
            size="icon"
            aria-label="Add new testimonial"
          >
            <PlusIcon className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {/* Show new testimonial form if requested */}
        {showNewForm && (
          <TestimonialForm portfolio_id={portfolio_id} onDelete={() => setShowNewForm(false)} />
        )}

        {/* Existing testimonials */}
        {testimonials.map((testimonial) => (
          <TestimonialForm
            key={testimonial.id}
            testimonial={testimonial}
            portfolio_id={portfolio_id}
            onDelete={() => handleDelete(testimonial.id)}
          />
        ))}

        {testimonials.length === 0 && !showNewForm && (
          <div className="text-center py-16 body-3 text-muted-foreground">
            No testimonials added yet. Click "Add New Testimonial" to get started.
          </div>
        )}
      </div>
    </section>
  );
}

export const meta: Route.MetaFunction = () => [{ title: 'Testimonials | Craftd' }];

export async function loader({ context }: Route.LoaderArgs) {
  const portfolio = context.get(portfolioContext)!;
  const testimonials = await db
    .selectFrom('app.testimonials')
    .selectAll()
    .where('portfolio_id', '=', portfolio.id)
    .orderBy('sort_order', 'asc')
    .execute();
  return { testimonials, portfolio_id: portfolio.id };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    return { success: false, error: 'Sign in again before saving your testimonials.' };
  }
  const formData = await request.formData();
  const operation = formData.get('operation') as string;

  switch (operation) {
    case 'create':
    case 'update': {
      const testimonialDataResult = parseFormData<TestimonialFormValues>(
        formData,
        'testimonialData',
      );

      if ('success' in testimonialDataResult && !testimonialDataResult.success) {
        return { success: false, operation, error: 'Your testimonial changes couldn’t be read.' };
      }

      const testimonialData = testimonialDataResult as TestimonialFormValues;

      if (!testimonialData.portfolio_id) {
        return {
          success: false,
          operation,
          error: 'Choose a portfolio before saving this testimonial.',
        };
      }

      try {
        if (operation === 'create') {
          // Insert new testimonial
          const { id: _id, ...insertData } = testimonialData;

          const newTestimonial = await CareerRepository.createTestimonial(db, user.id, {
            portfolio_id: insertData.portfolio_id,
            name: insertData.name,
            title: insertData.title,
            company: insertData.company,
            content: insertData.content,
            avatar_url: insertData.avatar_url,
            linkedin_url: insertData.linkedin_url,
            rating: insertData.rating,
          });

          return {
            success: true,
            operation,
            message: 'Testimonial created successfully',
            data: newTestimonial,
          };
        }

        // Update existing testimonial
        const { id, ...updateData } = testimonialData;
        if (!id) {
          return {
            success: false,
            operation,
            error: 'Choose a testimonial before saving your changes.',
          };
        }

        await CareerRepository.updateTestimonial(db, user.id, id, testimonialData.portfolio_id, {
          name: updateData.name,
          title: updateData.title,
          company: updateData.company,
          content: updateData.content,
          avatar_url: updateData.avatar_url,
          linkedin_url: updateData.linkedin_url,
          rating: updateData.rating,
        });

        return { success: true, operation, message: 'Testimonial updated successfully' };
      } catch (error) {
        console.error(`Failed to ${operation} testimonial:`, error);
        return {
          success: false,
          operation,
          error:
            operation === 'create'
              ? 'We couldn’t create this testimonial. Try again.'
              : 'We couldn’t save this testimonial. Try again.',
        };
      }
    }

    case 'delete': {
      const id = formData.get('id') as string;
      const portfolio_id = formData.get('portfolio_id') as string;

      if (!id || !portfolio_id) {
        return { success: false, operation, error: 'Choose a testimonial before deleting it.' };
      }

      try {
        await CareerRepository.deleteTestimonial(db, user.id, id, portfolio_id);
        return { success: true, operation, message: 'Testimonial deleted successfully' };
      } catch (error) {
        console.error('Failed to delete testimonial:', error);
        return {
          success: false,
          operation,
          error: 'We couldn’t delete this testimonial. Try again.',
        };
      }
    }

    default:
      throw new Response('Invalid operation', { status: 400 });
  }
}

export default function Testimonials({ loaderData }: Route.ComponentProps) {
  return (
    <TestimonialsEditorSection
      testimonials={loaderData.testimonials}
      portfolio_id={loaderData.portfolio_id}
    />
  );
}
