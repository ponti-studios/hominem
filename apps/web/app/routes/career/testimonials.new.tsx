import { Form, redirect } from 'react-router';

import { DetailSection, PageHeader } from '~/components/design';
import { Container } from '~/components/design/container';
import { FormActions, TextAreaInput, TextInput } from '~/components/design/forms';
import { formText } from '~/modules/career/lib/route-utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';

import type { Route } from './+types/testimonials.new';

export const meta: Route.MetaFunction = () => [{ title: 'Add testimonial | Hominem' }];

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formText(formData, 'name')?.trim();
  const content = formText(formData, 'content')?.trim();
  if (!name || !content) return { error: 'Name and testimonial content are required' };

  const response = await createCareerServerClient(request).testimonials.create.$post({
    json: {
      name,
      content,
      title: formText(formData, 'title') || null,
      company: formText(formData, 'company') || null,
      linkedinUrl: formText(formData, 'linkedinUrl') || null,
    },
  });
  if (!response.ok) return { error: 'Failed to add testimonial. Please try again.' };

  return redirect('/career/testimonials');
}

export default function NewTestimonialRoute({ actionData }: Route.ComponentProps) {
  return (
    <Container size="xs">
      <PageHeader eyebrow="Career · Testimonials" title="Add testimonial" />
      <DetailSection title="Testimonial">
        <Form method="post" className="flex flex-col gap-4">
          <TextInput label="Name" name="name" required placeholder="Jane Doe" />
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Title" name="title" placeholder="Engineering Manager" />
            <TextInput label="Company" name="company" placeholder="Acme Inc." />
          </div>
          <TextAreaInput label="Testimonial" name="content" rows={4} required />
          <TextInput label="LinkedIn URL" name="linkedinUrl" placeholder="https://" />
          {actionData?.error && (
            <p role="alert" className="text-sm text-destructive-text">
              {actionData.error}
            </p>
          )}
          <FormActions submitLabel="Add testimonial" />
        </Form>
      </DetailSection>
    </Container>
  );
}
