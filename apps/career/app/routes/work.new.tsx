import { CareerRepository } from '@hominem/db/career';
import { db } from '@hominem/db/core';
import { SectionIntro } from '@ponti-studios/ui/layout';
import { redirect } from 'react-router';

import { PositionEditor } from '~/components/career/work/PositionEditor';
import { ENGAGEMENT_KINDS } from '~/lib/career-options';
import { logger } from '~/lib/logger';
import { userContext } from '~/lib/middleware';
import { formChoice, formText } from '~/lib/route-utils';

import type { Route } from './+types/work.new';

export const meta: Route.MetaFunction = () => [
  { title: 'New Engagement | career' },
  { name: 'description', content: 'Add a work history engagement.' },
];

export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response('Unauthorized', { status: 401 });

  const formData = await request.formData();
  const company = formText(formData, 'company')?.trim();
  const title = formText(formData, 'title')?.trim();
  if (!company || !title) throw new Response('Company and title are required', { status: 400 });

  try {
    const toInt = (raw: FormDataEntryValue | null) => {
      if (!raw || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) ? Math.round(n * 100) : null;
    };

    const engagement = await CareerRepository.createEngagement(db, user.id, {
      company,
      title,
      location: formText(formData, 'location') || null,
      url: formText(formData, 'url') || null,
      startDate: formText(formData, 'startDate') || null,
      endDate: formText(formData, 'endDate') || null,
      isCurrent: formData.get('isCurrent') === 'on',
      salaryLow: toInt(formData.get('salaryLow')),
      salaryHigh: toInt(formData.get('salaryHigh')),
      currency: formText(formData, 'currency') || 'USD',
      description: formText(formData, 'description') || null,
      contactName: formText(formData, 'contactName') || null,
      contactPhone: formText(formData, 'contactPhone') || null,
      source: formText(formData, 'source') || null,
      kind: formChoice(formData, 'kind', ENGAGEMENT_KINDS, 'EMPLOYMENT'),
    });

    return redirect(`/work/${engagement.id}`);
  } catch (error) {
    logger.error('Error creating engagement', error, { owner_userid: user.id });
    throw new Response('Failed to create engagement. Please try again.', { status: 500 });
  }
}

export default function NewPositionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <SectionIntro title="New Engagement" description="Add a work history engagement." />
      </div>
      <div className="rounded-lg border border-border p-6">
        <PositionEditor submitLabel="Create engagement" />
      </div>
    </div>
  );
}
