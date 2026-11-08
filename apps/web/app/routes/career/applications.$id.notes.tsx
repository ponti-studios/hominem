import { Form } from 'react-router';

import { DeleteButton, PanelState, TextAreaInput } from '~/components/design';
import { SectionCard } from '~/components/design/surfaces';
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
    <div className="flex flex-col gap-4">
      <SectionCard>
        <div className="p-5">
          <Form method="post" navigate={false} className="flex flex-col gap-3">
            <TextAreaInput
              label="Add a note"
              labelHidden
              name="content"
              rows={3}
              placeholder="Add a note..."
              required
            />
            <div className="flex justify-end">
              <AddButton type="submit" label="Add note" />
            </div>
          </Form>
        </div>
      </SectionCard>

      {notes.length === 0 ? (
        <PanelState title="No notes yet" />
      ) : (
        <SectionCard>
          <div className="flex flex-col gap-3 p-5">
            {notes.map((note) => (
              <div key={note.id} className="hairline rounded-xl bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm whitespace-pre-wrap text-[#f2f4f8]">{note.content}</p>
                  <DeleteButton
                    itemName="note"
                    label="Remove"
                    variant="ghost"
                    hiddenFields={{ id: note.id }}
                  />
                </div>
                <p className="mt-2 font-mono text-[11px] text-[#5e6678]">
                  {formatApplicationDate(note.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
