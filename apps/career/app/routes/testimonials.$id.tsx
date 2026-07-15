import { ArrowLeftIcon } from 'lucide-react';
import { useNavigate } from 'react-router';

import { TestimonialEditorForm } from '~/components/career/TestimonialEditorForm';
import { getTestimonialById } from '~/lib/career/queries/testimonials';
import { handleTestimonialMutationAction } from '~/lib/career/testimonial-actions';
import { userContext } from '~/lib/middleware';

import { Route } from './+types/testimonials.$id';

export const meta: Route.MetaFunction = () => [{ title: 'Edit Testimonial | career' }];

export async function loader({ context, params }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const { id } = params;
  if (!id) {
    throw new Response('Testimonial ID is required', { status: 400 });
  }

  const testimonial = await getTestimonialById(user.id, id);

  if (!testimonial) {
    throw new Response('Testimonial not found', { status: 404 });
  }

  return { testimonial, portfolioId: testimonial.portfolioId };
}

export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    return { success: false, error: 'Sign in again before saving your testimonials.' };
  }

  return handleTestimonialMutationAction(request, user.id);
}

export default function EditTestimonial({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => navigate('/testimonials')}
        data-testid="back-button"
        className="body-3 inline-flex items-center gap-2 self-start text-muted-foreground transition-colors"
      >
        <ArrowLeftIcon className="size-4" />
        Back to testimonials
      </button>

      <div className="space-y-1">
        <h1 className="heading-2 text-foreground">{loaderData.testimonial.name}</h1>
        <p className="body-3 text-muted-foreground">Update this client testimonial.</p>
      </div>

      <TestimonialEditorForm
        action={`/testimonials/${loaderData.testimonial.id}`}
        testimonial={loaderData.testimonial}
        portfolioId={loaderData.portfolioId}
        onDeleteSuccess={() => navigate('/testimonials')}
      />
    </section>
  );
}
