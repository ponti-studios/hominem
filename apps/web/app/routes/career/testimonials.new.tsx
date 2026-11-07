import { TextField, Textarea } from '@ponti-studios/ui/forms';
import { SectionIntro } from '@ponti-studios/ui/layout';
import { Form, redirect } from 'react-router';

import { AddButton } from '~/modules/career/components/AddButton';
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
    <div className="max-w-2xl">
      <SectionIntro
        title="Add testimonial"
        description="Add a testimonial from a colleague, manager, or client."
      />

      <Form method="post" className="mt-6 flex flex-col gap-4">
        <TextField label="Name" name="name" required placeholder="Jane Doe" />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Title" name="title" placeholder="Engineering Manager" />
          <TextField label="Company" name="company" placeholder="Acme Inc." />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="content" className="text-foreground text-sm font-medium">
            Testimonial
          </label>
          <Textarea id="content" name="content" rows={4} required />
        </div>
        <TextField label="LinkedIn URL" name="linkedinUrl" placeholder="https://" />
        {actionData?.error && <p className="body-3 text-destructive-text">{actionData.error}</p>}
        <div className="flex justify-end">
          <AddButton type="submit" label="Add testimonial" />
        </div>
      </Form>
    </div>
  );
}
