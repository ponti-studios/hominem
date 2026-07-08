import {
  Briefcase,
  Calendar,
  ChevronLeft,
  FileText,
  MapPin,
  MessageSquare,
  Paperclip,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import { QuickActionsDropdown } from '~/components/career';
import { userContext } from '~/lib/middleware';
import { JobApplicationsService } from '~/lib/services/job-applications.service';
import { cn } from '~/lib/utils';
import { formatStatusText, getStatusColor } from '~/lib/utils/applicationUtils';

import { Route } from './+types/applications.$id';

export async function loader({ context, params }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const { id } = params;

  if (!id) {
    throw new Response('Application ID is required', { status: 400 });
  }

  try {
    const application = await JobApplicationsService.getApplication(id, user.id);
    return { application };
  } catch (error) {
    console.error('Error fetching application details:', error);
    if (error instanceof Error && error.message === 'Application not found') {
      throw new Response('Application not found', { status: 404 });
    }
    throw new Response('Failed to fetch application details', { status: 500 });
  }
}

const tabItems = [
  { to: '.', label: 'Overview', icon: Briefcase, end: true },
  { to: 'timeline', label: 'Timeline', icon: Calendar, end: false },
  { to: 'notes', label: 'Notes', icon: MessageSquare, end: false },
  { to: 'files', label: 'Files', icon: Paperclip, end: false },
  { to: 'resume', label: 'Resume', icon: FileText, end: false },
] as const;

export default function ApplicationDetailLayout({ loaderData }: Route.ComponentProps) {
  const { application } = loaderData;
  const navigate = useNavigate();
  const location = useLocation();
  const { company } = application;

  const applicationBasePath = location.pathname.split('/').slice(0, 3).join('/');
  const activeTabIndex = tabItems.findIndex((tab) => {
    if (tab.to === '.') {
      return location.pathname === applicationBasePath;
    }

    const targetPath = `${applicationBasePath}/${tab.to}`;
    return location.pathname === targetPath || location.pathname.startsWith(`${targetPath}/`);
  });

  const navigateWithViewTransition = (to: string) => {
    const startViewTransition = document.startViewTransition?.bind(document);

    if (startViewTransition) {
      startViewTransition(() => {
        void navigate(to);
      });
      return;
    }

    void navigate(to);
  };

  const quickActions = [
    {
      id: 'add-note',
      label: 'Add Note',
      icon: MessageSquare,
      onClick: () => navigateWithViewTransition('notes'),
    },
    {
      id: 'view-timeline',
      label: 'View Timeline',
      icon: Calendar,
      onClick: () => navigateWithViewTransition('timeline'),
    },
  ];

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <Link to="/applications" className="flex items-center body-3 text-muted-foreground">
          <ChevronLeft className="size-5" />
          Back to Applications
        </Link>
      </header>

      {/* Application Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-2">
          <h1 className="heading-3 md:heading-2 text-foreground">{application.position}</h1>
          <div className="flex gap-2 body-3 text-muted-foreground">
            <p className="p-2 py-1 border rounded bg-surface">{company?.name}</p>
            {(application.jobPosting || application.location) && (
              <p className="p-2 py-1 border rounded bg-surface">
                {application.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {application.location}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'px-4 py-2 text-sm font-semibold rounded-full',
              getStatusColor(application.status),
            )}
          >
            {formatStatusText(application.status)}
          </span>
          <QuickActionsDropdown actions={quickActions} />
        </div>
      </div>

      {/* Tabs as routes */}
      <nav className="relative flex h-auto w-full items-center gap-1 rounded-full border bg-surface p-1">
        <span
          className="pointer-events-none absolute inset-y-1 left-1 rounded-full border border-border/40 bg-card shadow-sm transition-transform duration-300 ease-out"
          style={{
            width: `calc((100% - 0.5rem) / ${tabItems.length})`,
            transform: `translateX(calc(${Math.max(activeTabIndex, 0)} * 100%))`,
            viewTransitionName: 'application-tab-indicator',
          }}
        />
        {tabItems.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            onClick={(event) => {
              event.preventDefault();
              navigateWithViewTransition(tab.to);
            }}
            className="relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap text-text-primary"
          >
            <tab.icon className="size-4 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="pt-6" style={{ viewTransitionName: 'application-tab-panel' }}>
        <Outlet context={application} />
      </div>
    </div>
  );
}
