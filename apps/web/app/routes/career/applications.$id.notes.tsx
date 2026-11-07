import { Textarea } from '@ponti-studios/ui/forms';
import { Card, CardContent } from '@ponti-studios/ui/primitives';
import { Form } from 'react-router';

import { AddButton } from '~/modules/career/components/AddButton';
import { formText } from '~/modules/career/lib/route-utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';
import { formatApplicationDate } from '~/modules/career/lib/utils/applicationUtils';

import { Route } from './+types/applications.$id.notes';

export async function loader({ request, params }: Route.LoaderArgs) {
  const response = await createCareerServerClient(request).applications[':id'].notes.$get({
    param: { id: params.id },
  });
  if (response.status === 404) throw new Response('Application not found', { status: 404 });
  if (!response.ok) throw new Response('Failed to load notes', { status: 500 });
  return response.json();
}

export async function action({ params, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const career = createCareerServerClient(request);

  if (intent === 'delete') {
    const id = formData.get('id');
    if (typeof id === 'string') {
      await career.applications[':id'].notes.delete.$post({
        param: { id: params.id },
        json: { id },
      });
    }
    return { ok: true };
  }

  const content = formText(formData, 'content')?.trim();
  if (content) {
    await career.applications[':id'].notes.create.$post({
      param: { id: params.id },
      json: { content },
    });
  }
  return { ok: true };
}

export default function ApplicationNotesRoute({ loaderData }: Route.ComponentProps) {
  const { notes } = loaderData;

  return (
    <div className="flex flex-col gap-6">
      <Form method="post" navigate={false} className="flex flex-col gap-3">
        <Textarea name="content" rows={3} placeholder="Add a note..." required />
        <div className="flex justify-end">
          <AddButton type="submit" label="Add note" />
        </div>
      </Form>

      {notes.length === 0 ? (
        <p className="body-3 text-muted-foreground text-center py-6">No notes yet.</p>
      ) : (
        <Card>
          <CardContent className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="body-3 whitespace-pre-wrap">{note.content}</p>
                  <Form method="post" navigate={false}>
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={note.id} />
                    <button
                      type="submit"
                      className="footnote shrink-0 text-muted-foreground hover:text-destructive-text"
                    >
                      Remove
                    </button>
                  </Form>
                </div>
                <p className="footnote text-muted-foreground mt-2">
                  {formatApplicationDate(note.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
