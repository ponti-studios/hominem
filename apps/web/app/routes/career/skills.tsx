import { EmptyState } from '@ponti-studios/ui/feedback';
import { TextField } from '@ponti-studios/ui/forms';
import { SectionIntro } from '@ponti-studios/ui/layout';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ponti-studios/ui/overlays';
import { LightbulbIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Form, useNavigation } from 'react-router';

import { AddButton } from '~/modules/career/components/AddButton';
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
    const name = formData.get('name');
    if (typeof name === 'string' && name.trim()) {
      const level = formData.get('level');
      const years = formData.get('yearsOfExperience');
      await career.skills.create.$post({
        json: {
          name: name.trim(),
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
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <SectionIntro title="Skills" description="Skills and areas of expertise." />
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
              <TextField label="Name" name="name" required placeholder="TypeScript" />
              <TextField label="Category" name="category" placeholder="Technical" />
              <div className="grid grid-cols-2 gap-4">
                <TextField label="Level (1-100)" name="level" min={1} max={100} />
                <TextField label="Years of experience" name="yearsOfExperience" min={0} />
              </div>
              <DialogFooter>
                <AddButton type="submit" label="Add skill" disabled={isSubmitting} />
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {skills.length === 0 ? (
        <EmptyState
          icon={<LightbulbIcon className="size-6" />}
          title="No skills yet"
          description="Add a skill to start building your profile."
          className="mt-6"
        />
      ) : (
        <div className="mt-6 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5"
            >
              <span className="body-3">{skill.name}</span>
              {skill.category && (
                <span className="footnote text-muted-foreground">{skill.category}</span>
              )}
              <Form method="post" navigate={false}>
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={skill.id} />
                <button
                  type="submit"
                  aria-label={`Remove ${skill.name}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              </Form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
