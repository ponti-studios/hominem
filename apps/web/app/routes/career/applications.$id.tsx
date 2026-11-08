import { humanizeIdentifier } from '@hominem/utils/text';
import { Briefcase, Calendar, FileText, PaperclipIcon, StickyNoteIcon } from 'lucide-react';
import { data, Outlet, redirect } from 'react-router';

import { BackLink, DeleteButton, DetailHero } from '~/components/design';
import { AppNavLink } from '~/components/shell/app-nav-link';
import { QuickActions } from '~/modules/career/components/career/applications/QuickActions';
import { StatusBadge } from '~/modules/career/components/status-badge';
import { formText } from '~/modules/career/lib/route-utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';
import { isJobApplicationStatus } from '~/modules/career/lib/types/career';
import { getApplicationStatusTone } from '~/modules/career/lib/utils/applicationUtils';

import { Route } from './+types/applications.$id';

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const app = loaderData?.application;
  return [{ title: app ? `${app.title} at ${app.company} | Hominem` : 'Application | Hominem' }];
};

export async function action({ params, request }: Route.ActionArgs) {
  const { id } = params;
  if (!id) throw new Response('Application ID is required', { status: 400 });

  const formData = await request.formData();
  const intent = formData.get('intent');
  const career = createCareerServerClient(request);

  if (intent === 'delete') {
    const response = await career.applications.delete.$post({ json: { id } });
    if (!response.ok) throw new Response('Failed to delete application', { status: 500 });
    return redirect('/career/applications');
  }

  if (intent === 'update-status') {
    const status = formData.get('status');
    if (typeof status !== 'string' || !isJobApplicationStatus(status)) {
      throw new Response('Invalid application status', { status: 400 });
    }
    const response = await career.applications.update.$post({ json: { id, data: { status } } });
    if (!response.ok) throw new Response('Failed to update application', { status: 500 });
    return data({ ok: true });
  }

  if (intent === 'update-application') {
    const status = formText(formData, 'status');
    if (status && !isJobApplicationStatus(status)) {
      throw new Response('Invalid application status', { status: 400 });
    }
    const salaryRaw = formText(formData, 'salaryExpectation') ?? '';
    const salaryExpectation =
      salaryRaw && Number.isFinite(Number(salaryRaw)) ? Math.round(Number(salaryRaw)) : null;

    const response = await career.applications.update.$post({
      json: {
        id,
        data: {
          title: formText(formData, 'title') ?? '',
          company: formText(formData, 'company') ?? '',
          location: formText(formData, 'location') || null,
          source: formText(formData, 'source') || null,
          appliedAt: formText(formData, 'appliedAt') || null,
          ...(status && isJobApplicationStatus(status) ? { status } : {}),
          jobPostingUrl: formText(formData, 'jobPostingUrl') || null,
          salaryExpectation,
          notes: formText(formData, 'notes') || null,
        },
      },
    });
    if (!response.ok) throw new Response('Failed to update application', { status: 500 });
    return data({ ok: true });
  }

  return data({ ok: false });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { id } = params;
  if (!id) throw new Response('Application ID is required', { status: 400 });

  const response = await createCareerServerClient(request).applications[':id'].$get({
    param: { id },
  });
  if (response.status === 404) throw new Response('Application not found', { status: 404 });
  if (!response.ok) throw new Response('Failed to fetch application details', { status: 500 });
  return response.json();
}

const tabItems = [
  { to: '.', label: 'Overview', icon: Briefcase, end: true },
  { to: 'timeline', label: 'Timeline', icon: Calendar, end: false },
  { to: 'notes', label: 'Notes', icon: StickyNoteIcon, end: false },
  { to: 'files', label: 'Files', icon: PaperclipIcon, end: false },
  { to: 'resume', label: 'Resume', icon: FileText, end: false },
] as const;

export default function ApplicationDetailLayout({ loaderData }: Route.ComponentProps) {
  const { application } = loaderData;
  if (!application) throw new Response('Application not found', { status: 404 });

  const statusLabel = application.status ? humanizeIdentifier(application.status) : null;
  const showCurrentStage =
    application.currentStage &&
    application.currentStage.toLowerCase() !== statusLabel?.toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <BackLink to="/career/applications" label="Applications" />

      <DetailHero
        title={application.title}
        subtitle={
          application.location
            ? `${application.company} · ${application.location}`
            : application.company
        }
        badges={
          <>
            {application.status && statusLabel && (
              <StatusBadge
                tone={getApplicationStatusTone(application.status)}
                label={statusLabel}
              />
            )}
            {showCurrentStage && <StatusBadge tone="info" label={application.currentStage} />}
          </>
        }
        actions={
          <>
            <QuickActions currentStatus={application.status} />
            <DeleteButton itemName={`${application.title} at ${application.company}`} />
          </>
        }
      />

      <nav
        aria-label="Application"
        className="glass flex shrink-0 items-center gap-1 overflow-x-auto rounded-2xl border border-white/[0.06] p-1.5"
      >
        {tabItems.map((tab) => (
          <AppNavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            variant="pill"
            label={tab.label}
            icon={<tab.icon />}
            accent="#5eead4"
          />
        ))}
      </nav>

      <div className="pt-2">
        <Outlet context={application} />
      </div>
    </div>
  );
}
