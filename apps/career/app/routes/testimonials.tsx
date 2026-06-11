import type { CareerTestimonialRecord as Testimonial } from '@hominem/db';
import { CareerRepository, db } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { MessageSquare, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useFetcher } from 'react-router';

import { useToast } from '../hooks/useToast';
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

      fetcher.submit(formData, {
        method: 'POST',
        action: '/testimonials',
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
            variant="default"
            size="sm"
            isLoading={isSaving}
            loadingLabel="Saving..."
          >
            {isNew ? (
              'Add Testimonial'
            ) : (
              'Save Changes'
            )}
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
    throw new Response('User not found', { status: 401 });
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
        throw new Response('Invalid testimonial data', { status: 400 });
      }

      const testimonialData = testimonialDataResult as TestimonialFormValues;

      if (!testimonialData.portfolio_id) {
        throw new Response('Missing portfolio_id', { status: 400 });
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

          return { message: 'Testimonial created successfully', data: newTestimonial };
        }

        // Update existing testimonial
        const { id, ...updateData } = testimonialData;
        if (!id) throw new Response('Missing testimonial ID for update', { status: 400 });

        await CareerRepository.updateTestimonial(db, user.id, id, testimonialData.portfolio_id, {
          name: updateData.name,
          title: updateData.title,
          company: updateData.company,
          content: updateData.content,
          avatar_url: updateData.avatar_url,
          linkedin_url: updateData.linkedin_url,
          rating: updateData.rating,
        });

        return { message: 'Testimonial updated successfully' };
      } catch (error) {
        if (error instanceof Response) throw error;
        console.error(`Failed to ${operation} testimonial:`, error);
        throw new Response(`Failed to ${operation} testimonial`, { status: 500 });
      }
    }

    case 'delete': {
      const id = formData.get('id') as string;
      const portfolio_id = formData.get('portfolio_id') as string;

      if (!id || !portfolio_id) {
        throw new Response('Missing required fields for deletion', { status: 400 });
      }

      try {
        await CareerRepository.deleteTestimonial(db, user.id, id, portfolio_id);
        return { message: 'Testimonial deleted successfully' };
      } catch (error) {
        console.error('Failed to delete testimonial:', error);
        throw new Response('Failed to delete testimonial', { status: 500 });
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
