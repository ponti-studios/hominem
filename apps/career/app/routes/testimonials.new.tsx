import { ArrowLeftIcon } from 'lucide-react';
import { useNavigate } from 'react-router';

import { TestimonialEditorForm } from '~/components/career/TestimonialEditorForm';
import { handleTestimonialMutationAction } from '~/lib/career/testimonial-actions';
import { portfolioContext, userContext } from '~/lib/middleware';

import { Route } from './+types/testimonials.new';

export const meta: Route.MetaFunction = () => [{ title: 'New Testimonial | career' }];

export async function loader({ context }: Route.LoaderArgs) {
  const portfolio = context.get(portfolioContext)!;
  return { portfolioId: portfolio.id };
}

export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    return { success: false, error: 'Sign in again before saving your testimonials.' };
  }

  return handleTestimonialMutationAction(request, user.id);
}

export default function NewTestimonial({ loaderData }: Route.ComponentProps) {
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
        <h1 className="heading-2 text-foreground">New Testimonial</h1>
        <p className="body-3 text-muted-foreground">
          Add a client quote to showcase on your portfolio.
        </p>
      </div>

      <TestimonialEditorForm
        action="/testimonials/new"
        portfolioId={loaderData.portfolioId}
        onSuccess={(result) => {
          if (!result.data) {
            return;
          }

          navigate(`/testimonials/${result.data.id}`);
        }}
      />
    </section>
  );
}
