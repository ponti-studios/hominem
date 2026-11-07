import { humanizeIdentifier } from '@hominem/utils/text';
import { Button } from '@ponti-studios/ui/primitives';
import { ArrowLeftIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { data, Form, Link, redirect } from 'react-router';

import { PositionEditor } from '~/modules/career/components/career/work/PositionEditor';
import { StatusBadge } from '~/modules/career/components/status-badge';
import { ENGAGEMENT_KINDS } from '~/modules/career/lib/career-options';
import { formChoice, formText } from '~/modules/career/lib/route-utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';

import { Route } from './+types/work.$id';

export async function loader({ request, params }: Route.LoaderArgs) {
  const response = await createCareerServerClient(request).engagements[':id'].$get({
    param: { id: params.id },
  });
  if (response.status === 404) throw new Response('Engagement not found', { status: 404 });
  if (!response.ok) throw new Response('Failed to load engagement', { status: 500 });
  return data({ position: await response.json() });
}

export async function action({ params, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const career = createCareerServerClient(request);

  if (intent === 'delete') {
    const response = await career.engagements.delete.$post({ json: { id: params.id } });
    if (!response.ok) throw new Response('Failed to delete engagement', { status: 500 });
    return redirect('/career/work');
  }

  const toCents = (raw: FormDataEntryValue | null) => {
    if (!raw || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  };

  const response = await career.engagements.update.$post({
    json: {
      id: params.id,
      data: {
        company: formText(formData, 'company') ?? undefined,
        title: formText(formData, 'title') ?? undefined,
        location: formText(formData, 'location') || null,
        address: formText(formData, 'address') || null,
        url: formText(formData, 'url') || null,
        startDate: formText(formData, 'startDate') || null,
        endDate: formText(formData, 'endDate') || null,
        isCurrent: formData.get('isCurrent') === 'on',
        salaryLow: toCents(formData.get('salaryLow')),
        salaryHigh: toCents(formData.get('salaryHigh')),
        currency: formText(formData, 'currency') || 'USD',
        description: formText(formData, 'description') || null,
        contactName: formText(formData, 'contactName') || null,
        contactPhone: formText(formData, 'contactPhone') || null,
        source: formText(formData, 'source') || null,
        kind: formChoice(formData, 'kind', ENGAGEMENT_KINDS, 'EMPLOYMENT'),
        reasonForLeaving: formText(formData, 'reasonForLeaving') || null,
      },
    },
  });
  if (response.status === 404) throw new Response('Engagement not found', { status: 404 });
  if (!response.ok) throw new Response('Failed to update engagement', { status: 500 });
  return data({ ok: true });
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const position = loaderData?.position;
  return [
    {
      title: position
        ? `${position.title ?? 'Position'} at ${position.company ?? 'Company'} | career`
        : 'Position | career',
    },
  ];
};

const cardClass = 'rounded-xl border border-border bg-card p-6';

export default function WorkDetailPage({ loaderData }: Route.ComponentProps) {
  const { position } = loaderData;
  const [isEditing, setIsEditing] = useState(false);

  const salary =
    (position.salaryLow ?? position.salaryHigh)
      ? `${position.salaryLow ? `$${(position.salaryLow / 100).toLocaleString('en-US')}` : '?'} – ${position.salaryHigh ? `$${(position.salaryHigh / 100).toLocaleString('en-US')}` : '?'} ${position.currency ?? 'USD'}`
      : null;

  if (isEditing) {
    return (
      <div>
        <Link
          to="/career/work"
          className="footnote mb-4 inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Work history
        </Link>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="heading-2">Edit engagement</h1>
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
        <div className={cardClass}>
          <PositionEditor position={position} onCancel={() => setIsEditing(false)} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/career/work"
        className="footnote mb-4 inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Work history
      </Link>

      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="heading-1">{position.title}</h1>
            <p className="heading-4 mt-1 text-muted-foreground">{position.company}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Button>
            <Form
              method="post"
              navigate={false}
              onSubmit={(e) => {
                if (!confirm(`Delete "${position.title}" at ${position.company}?`))
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="intent" value="delete" />
              <Button type="submit" variant="outline" size="sm">
                <Trash2Icon className="mr-2 size-4" />
                Delete
              </Button>
            </Form>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {position.isCurrent && <StatusBadge tone="success" label="Current" />}
          {position.kind && (
            <StatusBadge tone="neutral" label={humanizeIdentifier(position.kind)} />
          )}
        </div>
      </div>

      <div className="grid gap-4">
        <section className={cardClass}>
          <h2 className="ui-eyebrow mb-4 text-muted-foreground">Details</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DetailField label="Location" value={position.location} />
            <DetailField label="Start date" value={position.startDate} mono />
            <DetailField
              label="End date"
              value={position.isCurrent ? 'Present' : position.endDate}
              mono
            />
            <DetailField label="Salary" value={salary} mono />
          </div>
        </section>

        {position.description && (
          <section className={cardClass}>
            <h2 className="ui-eyebrow mb-3 text-muted-foreground">Description</h2>
            <p className="body-2 whitespace-pre-wrap text-foreground">{position.description}</p>
          </section>
        )}

        {position.reasonForLeaving && (
          <section className={cardClass}>
            <h2 className="ui-eyebrow mb-3 text-muted-foreground">Reason for leaving</h2>
            <p className="body-2 whitespace-pre-wrap text-foreground">
              {position.reasonForLeaving}
            </p>
          </section>
        )}

        {(position.address || position.contactName || position.contactPhone) && (
          <section className={cardClass}>
            <h2 className="ui-eyebrow mb-4 text-muted-foreground">Contact</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DetailField label="Contact name" value={position.contactName} />
              <DetailField label="Contact phone" value={position.contactPhone} mono />
              <DetailField label="Address" value={position.address} />
            </div>
          </section>
        )}

        {(position.source || position.url) && (
          <section className={cardClass}>
            <h2 className="ui-eyebrow mb-3 text-muted-foreground">Source</h2>
            <div className="space-y-1">
              {position.source && (
                <p className="body-3 text-muted-foreground">via {position.source}</p>
              )}
              {position.url && (
                <a
                  href={position.url}
                  target="_blank"
                  rel="noreferrer"
                  className="body-3 text-primary hover:underline"
                >
                  {position.url}
                </a>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="footnote text-muted-foreground">{label}</p>
      <p className={mono ? 'body-3 font-mono text-foreground' : 'body-3 text-foreground'}>
        {value}
      </p>
    </div>
  );
}
