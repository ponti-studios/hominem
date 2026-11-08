import { humanizeIdentifier } from '@hominem/utils/text';
import { PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { data, redirect } from 'react-router';

import {
  BackLink,
  DeleteButton,
  DetailField,
  DetailHero,
  DetailSection,
} from '~/components/design';
import { Button } from '~/components/ui/button';
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
        <BackLink to="/career/work" label="Work history" />
        <DetailHero
          title="Edit engagement"
          actions={
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          }
        />
        <DetailSection title="Engagement">
          <PositionEditor position={position} onCancel={() => setIsEditing(false)} />
        </DetailSection>
      </div>
    );
  }

  return (
    <div>
      <BackLink to="/career/work" label="Work history" />
      <DetailHero
        title={position.title}
        subtitle={position.company}
        badges={
          <>
            {position.isCurrent && <StatusBadge tone="success" label="Current" />}
            {position.kind && (
              <StatusBadge tone="neutral" label={humanizeIdentifier(position.kind)} />
            )}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Button>
            <DeleteButton itemName={`${position.title} at ${position.company}`} />
          </>
        }
      />

      <div className="grid gap-4">
        <DetailSection title="Details">
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
        </DetailSection>

        {position.description && (
          <DetailSection title="Description">
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[#f2f4f8]">
              {position.description}
            </p>
          </DetailSection>
        )}

        {position.reasonForLeaving && (
          <DetailSection title="Reason for leaving">
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[#f2f4f8]">
              {position.reasonForLeaving}
            </p>
          </DetailSection>
        )}

        {(position.address || position.contactName || position.contactPhone) && (
          <DetailSection title="Contact">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DetailField label="Contact name" value={position.contactName} />
              <DetailField label="Contact phone" value={position.contactPhone} mono />
              <DetailField label="Address" value={position.address} />
            </div>
          </DetailSection>
        )}

        {(position.source || position.url) && (
          <DetailSection title="Source">
            <div className="flex flex-col gap-2">
              {position.source && <p className="text-sm text-[#9ba3b4]">via {position.source}</p>}
              {position.url && (
                <a
                  href={position.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[#d7ff3e] hover:underline"
                >
                  {position.url}
                </a>
              )}
            </div>
          </DetailSection>
        )}
      </div>
    </div>
  );
}
