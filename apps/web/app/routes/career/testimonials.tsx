import { SectionIntro } from '@ponti-studios/ui/layout';
import { PlusIcon, QuoteIcon, Trash2Icon } from 'lucide-react';
import { Form, Link } from 'react-router';

import { AddButton } from '~/modules/career/components/AddButton';
import { CareerCollection } from '~/modules/career/components/career/career-list';
import { createCareerServerClient } from '~/modules/career/lib/server-client';

import { Route } from './+types/testimonials';

export const meta: Route.MetaFunction = () => [
  { title: 'Testimonials | Hominem' },
  { name: 'description', content: 'Testimonials from colleagues, managers, and clients.' },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { testimonials } = await createCareerServerClient(request)
    .testimonials.$get({ query: {} })
    .then((response) => response.json());
  return { testimonials };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  if (formData.get('intent') === 'delete') {
    const id = formData.get('id');
    if (typeof id === 'string') {
      await createCareerServerClient(request).testimonials.delete.$post({ json: { id } });
    }
  }
  return { ok: true };
}

export default function TestimonialsRoute({ loaderData }: Route.ComponentProps) {
  const { testimonials } = loaderData;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <SectionIntro
          title="Testimonials"
          description="Testimonials from colleagues, managers, and clients."
        />
        <AddButton asChild label="Add testimonial">
          <Link to="/career/testimonials/new">
            <PlusIcon aria-hidden />
          </Link>
        </AddButton>
      </div>

      <div className="mt-6">
        <CareerCollection
          items={testimonials}
          keyFor={(t) => t.id}
          hrefFor={(t) => `/career/testimonials/${t.id}`}
          title={(t) => t.name}
          subtitle={(t) => [t.title, t.company].filter(Boolean).join(' at ')}
          meta={(t) => t.content}
          trailing={(t) => (
            <Form
              method="post"
              navigate={false}
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                if (!confirm(`Delete testimonial from "${t.name}"?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={t.id} />
              <button
                type="submit"
                className="footnote text-muted-foreground hover:text-destructive-text"
              >
                <Trash2Icon className="size-4" />
              </button>
            </Form>
          )}
          empty={{
            icon: <QuoteIcon className="size-6" />,
            title: 'No testimonials yet',
            description: 'Add a testimonial to showcase your work.',
          }}
        />
      </div>
    </div>
  );
}
