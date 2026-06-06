import type { CareerTestimonialRecord as Testimonial } from '@hominem/db';
import { CareerRepository, db } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { MessageSquare, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import type { ActionFunctionArgs, MetaFunction } from 'react-router';
import { useFetcher, useOutletContext } from 'react-router';

import { useToast } from '../hooks/useToast';
import type { FullPortfolio } from '../lib/portfolio.server';
import {
  createErrorResponse,
  createSuccessResponse,
  parseFormData,
  tryAsync,
} from '../lib/route-utils';

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
  const { addToast } = useToast();
  const isNew = !testimonial?.id;

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, isValid },
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

  // Handle fetcher responses
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const result = fetcher.data as {
        success: boolean;
        error?: string;
        message?: string;
        data?: Testimonial;
      };
      if (result.success) {
        addToast(result.message || 'Testimonial saved successfully!', 'success');
        if (result.data && isNew) {
          // Reset form with the returned data (including new ID)
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
        }
      } else {
        addToast(`Failed to save testimonial: ${result.error || 'Unknown error'}`, 'error');
      }
    }
  }, [fetcher.state, fetcher.data, reset, addToast, isNew]);

  const onSubmit: SubmitHandler<TestimonialFormValues> = (formData) => {
    if (!isDirty && !isNew) {
      addToast('No changes to save.', 'info');
      return;
    }

    if (!formData.name || !formData.content) {
      addToast('Please fill in all required fields.', 'error');
      return;
    }

    const formDataToSubmit = new FormData();
    formDataToSubmit.append('operation', isNew ? 'create' : 'update');
    formDataToSubmit.append('testimonialData', JSON.stringify(formData));

    fetcher.submit(formDataToSubmit, {
      method: 'POST',
      action: '/editor/testimonials',
    });
  };

  const handleDelete = () => {
    if (!testimonial?.id) return;

    if (confirm('Are you sure you want to delete this testimonial?')) {
      const formData = new FormData();
      formData.append('operation', 'delete');
      formData.append('id', testimonial.id);
      formData.append('portfolio_id', portfolio_id);

      fetcher.submit(formData, {
        method: 'POST',
        action: '/editor/testimonials',
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
        <h3 className="text-lg font-medium text-foreground">
          {isNew ? 'New Testimonial' : 'Testimonial'}
        </h3>
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={isSaving || (!isDirty && !isNew) || !isValid}
            variant="primary"
            size="sm"
          >
            {isSaving ? 'Saving...' : isNew ? 'Add Testimonial' : 'Save Changes'}
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
          <label htmlFor={`name-${testimonial?.id || 'new'}`} className="label">
            Name *
          </label>
          <input
            id={`name-${testimonial?.id || 'new'}`}
            type="text"
            {...register('name', { required: true })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="Client's full name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`title-${testimonial?.id || 'new'}`} className="label">
            Job Title
          </label>
          <input
            id={`title-${testimonial?.id || 'new'}`}
            type="text"
            {...register('title')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="e.g., Senior Developer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`company-${testimonial?.id || 'new'}`} className="label">
            Company
          </label>
          <input
            id={`company-${testimonial?.id || 'new'}`}
            type="text"
            {...register('company')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="Company name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`rating-${testimonial?.id || 'new'}`} className="label">
            Rating (1-5)
          </label>
          <select
            id={`rating-${testimonial?.id || 'new'}`}
            {...register('rating', { valueAsNumber: true })}
            className="select"
          >
            <option value="">Select rating</option>
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Good</option>
            <option value="3">3 - Average</option>
            <option value="2">2 - Fair</option>
            <option value="1">1 - Poor</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`content-${testimonial?.id || 'new'}`} className="label">
          Testimonial *
        </label>
        <textarea
          id={`content-${testimonial?.id || 'new'}`}
          {...register('content', { required: true })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 min-h-28"
          rows={4}
          placeholder="What did the client say about your work?"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`avatar_url-${testimonial?.id || 'new'}`} className="label">
            Avatar URL (optional)
          </label>
          <input
            id={`avatar_url-${testimonial?.id || 'new'}`}
            type="url"
            {...register('avatar_url')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            placeholder="https://example.com/avatar.jpg"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`linkedin_url-${testimonial?.id || 'new'}`} className="label">
            LinkedIn URL (optional)
          </label>
          <input
            id={`linkedin_url-${testimonial?.id || 'new'}`}
            type="url"
            {...register('linkedin_url')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
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
    <section className="container flex flex-col gap-8 mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Client Testimonials</h2>
        </div>

        {!showNewForm && (
          <Button
            type="button"
            onClick={handleAddNew}
            variant="outline"
            className="inline-flex items-center gap-2 border-dashed"
          >
            <PlusIcon className="size-4" />
            <span className="hidden sm:block">Add New Testimonial</span>
          </Button>
        )}
      </div>

      <p className="text-muted text-muted-foreground mb-lg">
        Add testimonials and reviews from your clients and colleagues.
      </p>

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
          <div className="text-center py-2xl text-muted-foreground">
            No testimonials added yet. Click "Add New Testimonial" to get started.
          </div>
        )}
      </div>
    </section>
  );
}

export const meta: MetaFunction = () => [{ title: 'Testimonials - Portfolio Editor | Craftd' }];

export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.get(userContext);
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
        return testimonialDataResult;
      }

      const testimonialData = testimonialDataResult as TestimonialFormValues;

      if (!testimonialData.portfolio_id) {
        return createErrorResponse('Missing portfolio_id');
      }

      return tryAsync(async () => {
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

          return createSuccessResponse(newTestimonial, 'Testimonial created successfully');
        }

        // Update existing testimonial
        const { id, ...updateData } = testimonialData;
        if (!id) return createErrorResponse('Missing testimonial ID for update');

        await CareerRepository.updateTestimonial(db, user.id, id, testimonialData.portfolio_id, {
          name: updateData.name,
          title: updateData.title,
          company: updateData.company,
          content: updateData.content,
          avatar_url: updateData.avatar_url,
          linkedin_url: updateData.linkedin_url,
          rating: updateData.rating,
        });

        return createSuccessResponse(null, 'Testimonial updated successfully');
      }, `Failed to ${operation} testimonial`);
    }

    case 'delete': {
      const id = formData.get('id') as string;
      const portfolio_id = formData.get('portfolio_id') as string;

      if (!id || !portfolio_id) {
        return createErrorResponse('Missing required fields for deletion');
      }

      return tryAsync(async () => {
        await CareerRepository.deleteTestimonial(db, user.id, id, portfolio_id);

        return createSuccessResponse(null, 'Testimonial deleted successfully');
      }, 'Failed to delete testimonial');
    }

    default:
      return createErrorResponse('Invalid operation');
  }
}

export default function EditorTestimonials() {
  // Consume portfolio provided by parent editor layout loader via outlet context
  const portfolio = useOutletContext<FullPortfolio>();

  return (
    <TestimonialsEditorSection testimonials={portfolio.testimonials} portfolio_id={portfolio.id} />
  );
}
