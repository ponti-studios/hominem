import { humanizeIdentifier } from '@hominem/utils/text';
import {
  ArrowLeftIcon,
  Briefcase,
  Calendar,
  FileText,
  MapPin,
  PaperclipIcon,
  StickyNoteIcon,
} from 'lucide-react';
import { data, Link, NavLink, Outlet, redirect } from 'react-router';

import { cn } from '~/lib/utils';
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
      <Link
        to="/career/applications"
        className="footnote inline-flex w-fit items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Applications
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="heading-2 truncate text-foreground">{application.title}</h1>
          <p className="body-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted-foreground">
            <span className="font-medium text-foreground">{application.company}</span>
            {application.location && (
              <>
                <span aria-hidden className="text-muted-foreground/50">
                  ·
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {application.location}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {application.status && statusLabel && (
            <StatusBadge tone={getApplicationStatusTone(application.status)} label={statusLabel} />
          )}
          {showCurrentStage && <StatusBadge tone="info" label={application.currentStage} />}
          <QuickActions currentStatus={application.status} />
        </div>
      </div>

      <nav className="bg-surface border flex h-auto w-full items-center gap-1 rounded-full p-1">
        {tabItems.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'text-text-primary flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-all',
                isActive && 'bg-background text-card-foreground ring-border ring-1 ring-inset',
              )
            }
          >
            <tab.icon className="size-4 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="pt-6">
        <Outlet context={application} />
      </div>
    </div>
  );
}
