import { TextField, Textarea } from '@ponti-studios/ui/forms';
import { Button } from '@ponti-studios/ui/primitives';
import { Form, redirect } from 'react-router';

import { formText } from '~/modules/career/lib/route-utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';

import { Route } from './+types/testimonials.$id';

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: loaderData ? `${loaderData.testimonial.name} | Hominem` : 'Testimonial | Hominem' },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  const response = await createCareerServerClient(request).testimonials[':id'].$get({
    param: { id: params.id },
  });
  if (response.status === 404) throw new Response('Testimonial not found', { status: 404 });
  if (!response.ok) throw new Response('Failed to load testimonial', { status: 500 });
  return { testimonial: await response.json() };
}

export async function action({ params, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const career = createCareerServerClient(request);

  if (intent === 'delete') {
    const response = await career.testimonials.delete.$post({ json: { id: params.id } });
    if (!response.ok) throw new Response('Failed to delete testimonial', { status: 500 });
    return redirect('/career/testimonials');
  }

  const name = formText(formData, 'name')?.trim();
  const content = formText(formData, 'content')?.trim();
  if (!name || !content) return { error: 'Name and testimonial content are required' };

  const response = await career.testimonials.update.$post({
    json: {
      id: params.id,
      data: {
        name,
        content,
        title: formText(formData, 'title') || null,
        company: formText(formData, 'company') || null,
        linkedinUrl: formText(formData, 'linkedinUrl') || null,
      },
    },
  });
  if (!response.ok) return { error: 'Failed to update testimonial. Please try again.' };

  return { ok: true };
}

export default function TestimonialDetailRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { testimonial } = loaderData;

  return (
    <div className="max-w-2xl">
      <Form method="post" className="flex flex-col gap-4">
        <TextField label="Name" name="name" required defaultValue={testimonial.name} />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Title" name="title" defaultValue={testimonial.title ?? ''} />
          <TextField label="Company" name="company" defaultValue={testimonial.company ?? ''} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="content" className="text-foreground text-sm font-medium">
            Testimonial
          </label>
          <Textarea
            id="content"
            name="content"
            rows={4}
            required
            defaultValue={testimonial.content}
          />
        </div>
        <TextField
          label="LinkedIn URL"
          name="linkedinUrl"
          defaultValue={testimonial.linkedinUrl ?? ''}
        />
        {actionData?.error && <p className="body-3 text-destructive-text">{actionData.error}</p>}
        <div className="flex justify-between">
          <Button type="submit" name="intent" value="delete" variant="ghost">
            Delete
          </Button>
          <Button type="submit">Save changes</Button>
        </div>
      </Form>
    </div>
  );
}
