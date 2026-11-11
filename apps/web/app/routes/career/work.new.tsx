import { redirect } from 'react-router';

import { DetailSection, PageHeader } from '~/components/design';
import { Container } from '~/components/design/container';
import { PositionEditor } from '~/modules/career/components/career/work/PositionEditor';
import { ENGAGEMENT_KINDS } from '~/modules/career/lib/career-options';
import { formChoice, formText } from '~/modules/career/lib/route-utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';

import type { Route } from './+types/work.new';

export const meta: Route.MetaFunction = () => [
  { title: 'New Engagement | Hominem' },
  { name: 'description', content: 'Add a work history engagement.' },
];

function toCents(raw: FormDataEntryValue | null) {
  if (!raw || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const company = formText(formData, 'company')?.trim();
  const title = formText(formData, 'title')?.trim();
  if (!company || !title) throw new Response('Company and title are required', { status: 400 });

  const response = await createCareerServerClient(request).engagements.create.$post({
    json: {
      company,
      title,
      location: formText(formData, 'location') || null,
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
    },
  });
  if (!response.ok) {
    throw new Response('Failed to create engagement. Please try again.', { status: 500 });
  }

  const engagement = await response.json();
  return redirect(`/career/work/${engagement.id}`);
}

export default function NewPositionPage() {
  return (
    <Container size="xs">
      <PageHeader eyebrow="Career · Work" title="New Engagement" />
      <DetailSection title="Engagement">
        <PositionEditor submitLabel="Create engagement" />
      </DetailSection>
    </Container>
  );
}
