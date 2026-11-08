import { Form, redirect } from 'react-router';

import { BackLink, DeleteButton, DetailHero, DetailSection } from '~/components/design';
import { FormActions, TextAreaInput, TextInput } from '~/components/design/forms';
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
    <div className="mx-auto w-full max-w-2xl">
      <BackLink to="/career/testimonials" label="Testimonials" />
      <DetailHero
        title={testimonial.name}
        subtitle={
          [testimonial.title, testimonial.company].filter(Boolean).join(' at ') || undefined
        }
        actions={<DeleteButton itemName={testimonial.name} />}
      />
      <DetailSection title="Testimonial">
        <Form method="post" className="flex flex-col gap-4">
          <TextInput label="Name" name="name" required defaultValue={testimonial.name} />
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Title" name="title" defaultValue={testimonial.title ?? ''} />
            <TextInput label="Company" name="company" defaultValue={testimonial.company ?? ''} />
          </div>
          <TextAreaInput
            label="Testimonial"
            name="content"
            rows={4}
            required
            defaultValue={testimonial.content}
          />
          <TextInput
            label="LinkedIn URL"
            name="linkedinUrl"
            defaultValue={testimonial.linkedinUrl ?? ''}
          />
          {actionData?.error && (
            <p role="alert" className="text-sm text-[#ff9d9d]">
              {actionData.error}
            </p>
          )}
          <FormActions submitLabel="Save changes" />
        </Form>
      </DetailSection>
    </div>
  );
}
