import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ponti-studios/ui/overlays';
import { XIcon } from 'lucide-react';
import { useState } from 'react';
import { Form } from 'react-router';

import { AddButton, DetailSection } from '~/components/design';
import { Chip } from '~/components/design/chip';
import { FormActions, FormGrid, TextInput } from '~/components/design/forms';
import { CollectionIndex } from '~/modules/career/components/collection-index';
import { formText } from '~/modules/career/lib/route-utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';

import { Route } from './+types/skills';

export const meta: Route.MetaFunction = () => [
  { title: 'Skills | Hominem' },
  { name: 'description', content: 'Skills and areas of expertise.' },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { skills } = await createCareerServerClient(request)
    .skills.$get({ query: {} })
    .then((response) => response.json());
  return { skills };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const career = createCareerServerClient(request);

  if (intent === 'delete') {
    const id = formData.get('id');
    if (typeof id === 'string') {
      await career.skills.delete.$post({ json: { id } });
    }
    return { ok: true };
  }

  if (intent === 'create') {
    const name = formText(formData, 'name')?.trim();
    if (name) {
      const level = formData.get('level');
      const years = formData.get('yearsOfExperience');
      await career.skills.create.$post({
        json: {
          name,
          category: formText(formData, 'category') || null,
          level: level ? Number(level) : null,
          yearsOfExperience: years ? Number(years) : null,
        },
      });
    }
    return { ok: true };
  }

  return { ok: false };
}

export default function SkillsRoute({ loaderData }: Route.ComponentProps) {
  const { skills } = loaderData;
  const [open, setOpen] = useState(false);

  return (
    <CollectionIndex
      eyebrow="Career · Skills"
      title="Skills"
      description="Skills and areas of expertise."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <AddButton label="Add skill" />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add skill</DialogTitle>
            </DialogHeader>
            <Form
              method="post"
              className="flex flex-col gap-4"
              onSubmit={() => setOpen(false)}
              navigate={false}
            >
              <input type="hidden" name="intent" value="create" />
              <TextInput label="Name" name="name" required placeholder="TypeScript" />
              <TextInput label="Category" name="category" placeholder="Technical" />
              <FormGrid>
                <TextInput label="Level (1-100)" name="level" type="number" min={1} max={100} />
                <TextInput
                  label="Years of experience"
                  name="yearsOfExperience"
                  type="number"
                  min={0}
                />
              </FormGrid>
              <FormActions submitLabel="Add skill" />
            </Form>
          </DialogContent>
        </Dialog>
      }
    >
      <DetailSection title="Your skills">
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills yet — add your first above.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Chip key={skill.id}>
                <span className="font-medium">{skill.name}</span>
                {skill.category && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {skill.category}
                  </span>
                )}
                <Form method="post" navigate={false} className="inline-flex">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={skill.id} />
                  <button
                    type="submit"
                    aria-label={`Remove ${skill.name}`}
                    className="-mr-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </Form>
              </Chip>
            ))}
          </div>
        )}
      </DetailSection>
    </CollectionIndex>
  );
}
