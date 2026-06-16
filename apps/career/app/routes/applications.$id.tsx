import type { UpdateCareerJobApplicationInput } from '@hominem/db';
import type { CareerInterviewEntry as InterviewEntry } from '@hominem/db';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hominem/ui/tabs';
import {
  Briefcase,
  Calendar,
  ChevronLeft,
  FileText,
  MapPin,
  MessageSquare,
  Paperclip,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useFetcher } from 'react-router';

import {
  ApplicationFilesTab,
  ApplicationNotesTab,
  ApplicationOverviewTab,
  ApplicationResumeTab,
  ApplicationTimelineTab,
  QuickActionsDropdown,
} from '~/components/career';
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
    const data = await JobApplicationsService.getApplicationDetail(id, user.id);
    return data;
  } catch (error) {
    console.error('Error fetching application details:', error);
    if (error instanceof Error && error.message === 'Application not found') {
      throw new Response('Application not found', { status: 404 });
    }
    throw new Response('Failed to fetch application details', { status: 500 });
  }
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  const { id } = params;
  const formData = await request.formData();
  const operation = formData.get('operation') as string;

  if (!id) {
    throw new Response('Application ID is required', { status: 400 });
  }

  try {
    // Verify ownership
    const hasOwnership = await JobApplicationsService.verifyOwnership(id, user.id);
    if (!hasOwnership) {
      throw new Response('Application not found or access denied', { status: 403 });
    }

    if (operation === 'update_application') {
      const updates: UpdateCareerJobApplicationInput = {};

      // Get all possible fields from form
      const fields = [
        'position',
        'status',
        'location',
        'job_posting',
        'salary_quoted',
        'salary_accepted',
        'company_notes',
        'negotiation_notes',
        'recruiter_name',
        'recruiter_email',
        'recruiter_linkedin',
        'resume',
      ] as const;

      for (const field of fields) {
        const value = formData.get(field);
        if (value !== null) {
          updates[field] = value as string | undefined;
        }
      }

      await JobApplicationsService.updateApplication(id, updates);
      return { message: 'Application updated successfully' };
    }

    if (operation === 'save_resume') {
      const resume = formData.get('resume') as string;
      if (!resume) {
        throw new Response('Resume content is required', { status: 400 });
      }
      await JobApplicationsService.updateApplication(id, { resume });
      return { message: 'Resume saved successfully' };
    }

    if (operation === 'add_note') {
      const type = formData.get('noteType') as string;
      const title = formData.get('noteTitle') as string;
      const content = formData.get('noteContent') as string;

      if (!content) {
        throw new Response('Note content is required', { status: 400 });
      }

      await JobApplicationsService.addNote(id, type, title, content);
      return { message: 'Note added successfully' };
    }

    if (operation === 'delete_note') {
      const noteId = formData.get('noteId') as string;
      await JobApplicationsService.deleteNote(noteId);
      return { message: 'Note deleted successfully' };
    }

    if (operation === 'add_interview') {
      const interviewType = formData.get('interviewType') as InterviewEntry['type'];
      const interviewDate = formData.get('interviewDate') as string;
      const interviewer = formData.get('interviewer') as string;
      const notes = formData.get('interviewNotes') as string;

      if (!interviewDate) {
        throw new Response('Interview date is required', { status: 400 });
      }

      const newInterview: InterviewEntry = {
        type: interviewType,
        date: interviewDate,
        interviewer: interviewer || undefined,
        notes: notes || undefined,
      };

      await JobApplicationsService.addInterview(id, newInterview);
      return { message: 'Interview added successfully' };
    }

    throw new Response('Invalid operation', { status: 400 });
  } catch (error) {
    console.error('Error in application detail action:', error);
    throw new Response('Failed to process request', { status: 500 });
  }
}

export default function ApplicationDetail({ loaderData, params }: Route.ComponentProps) {
  const { application, notes } = loaderData;
  const _fetcher = useFetcher();
  type TabId = 'overview' | 'timeline' | 'notes' | 'files' | 'resume';
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [_showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [_showAddNote, setShowAddNote] = useState(false);
  const [_showAddInterview, setShowAddInterview] = useState(false);
  const { company } = application;

  const tabItems = [
    { id: 'overview', label: 'Overview', icon: Briefcase },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'notes', label: 'Notes', icon: MessageSquare },
    { id: 'files', label: 'Files', icon: Paperclip },
    { id: 'resume', label: 'Resume', icon: FileText },
  ];

  const quickActions = [
    {
      id: 'update-status',
      label: 'Update Status',
      icon: () => <span className="w-2 h-2 bg-accent rounded-full" />,
      onClick: () => setShowStatusUpdate(true),
    },
    {
      id: 'add-note',
      label: 'Add Note',
      icon: MessageSquare,
      onClick: () => setShowAddNote(true),
    },
    {
      id: 'add-interview',
      label: 'Add Interview',
      icon: UserPlus,
      onClick: () => setShowAddInterview(true),
    },
    {
      id: 'view-timeline',
      label: 'View Timeline',
      icon: Calendar,
      onClick: () => setActiveTab('timeline'),
    },
  ];

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <Link to="/applications" className="flex items-center body-3 text-muted-foreground">
          <ChevronLeft className="h-5 w-5" />
          Back to Applications
        </Link>
      </header>

      {/* Application Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="heading-3 md:heading-2 text-foreground">{application.position}</h1>
          <p className="body-3 text-muted-foreground">{company?.name}</p>
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

      {/* Persistent job context bar */}
      {(application.job_posting || application.location) && (
        <div className="flex flex-wrap items-center gap-4 body-3 text-muted-foreground border border-border rounded-lg px-4 py-2 bg-muted/30">
          {application.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {application.location}
            </span>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)}>
        <div>
          <TabsList>
            {tabItems.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                <tab.icon className="size-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="pt-6">
          <TabsContent value="overview">
            <ApplicationOverviewTab application={application} company={company} />
          </TabsContent>
          <TabsContent value="timeline">
            <ApplicationTimelineTab application={application} applicationId={params.id || ''} />
          </TabsContent>
          <TabsContent value="notes">
            <ApplicationNotesTab notes={notes} applicationId={params.id || ''} />
          </TabsContent>
          <TabsContent value="files">
            <ApplicationFilesTab application={application} />
          </TabsContent>
          <TabsContent value="resume">
            <ApplicationResumeTab application={application} applicationId={params.id || ''} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
