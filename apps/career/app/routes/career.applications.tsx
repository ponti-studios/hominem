import { CareerRepository, getDb } from '@hominem/db';
import { Badge } from '@hominem/ui/badge';
import { buttonVariants } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { PlusIcon } from 'lucide-react';
import {
  Link,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router';

import { ApplicationsHeatmap } from '~/components/career/ApplicationsHeatmap';
import { ApplicationTable } from '~/components/career/ApplicationTable';
import { useToast } from '~/hooks/useToast';
import { getAllApplicationsWithCompany } from '~/lib/career/queries/job-applications';
import {
  createErrorResponse,
  createSuccessResponse,
  withAuthAction,
  withAuthLoader,
} from '~/lib/route-utils';
import { JobApplicationStage, type JobApplicationStatus } from '~/types/career';

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user, request }) => {
    try {
      const url = new URL(request.url);
      const searchParams = url.searchParams;

      // Extract pagination and filter parameters
      const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1'));
      const limit = Math.max(1, Math.min(100, Number.parseInt(searchParams.get('limit') || '10'))); // Default 10, max 100
      const offset = (page - 1) * limit;

      const searchQuery = searchParams.get('search') || undefined;
      const selectedStatuses = searchParams.getAll('status').filter(Boolean);
      const source = searchParams.get('source') || undefined;

      // Build filter object
      const filter = {
        ...(selectedStatuses.length > 0 && { statuses: selectedStatuses }),
        ...(source && source !== 'ALL' && { source }),
        ...(searchQuery && { search: searchQuery }),
      };

      // Build pagination object
      const pagination = {
        limit,
        offset,
        orderBy: (searchParams.get('orderBy') || 'applicationDate') as
          | 'applicationDate'
          | 'responseDate'
          | 'offerDate'
          | 'companyName'
          | 'position',
        orderDirection: (searchParams.get('orderDirection') as 'asc' | 'desc') || 'desc',
      };

      // Get all applications for the heatmap
      const allApplications = await getAllApplicationsWithCompany(user.id);

      // Get applications with company data using server-side filtering/pagination
      const paginatedApplications = await getAllApplicationsWithCompany(
        user.id,
        filter,
        pagination,
      );

      return createSuccessResponse({
        user,
        allApplications,
        applications: paginatedApplications,
        pagination: {
          page,
          limit,
          total: allApplications.length,
          totalPages: Math.ceil(allApplications.length / limit),
        },
        filters: {
          search: searchQuery,
          statuses: selectedStatuses,
          source: source && source !== 'ALL' ? source : undefined,
        },
      });
    } catch (error) {
      console.error('Error loading job applications data:', error);
      return createSuccessResponse({
        user,
        allApplications: [],
        applications: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
        filters: {},
        error: 'Failed to load job applications data',
      });
    }
  });
}

export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user, request }) => {
    try {
      const formData = await request.formData();
      const operation = formData.get('operation') as string;

      if (operation === 'create') {
        const position = formData.get('position') as string;
        const companyName = formData.get('company') as string;
        const status = formData.get('status') as string;
        const startDate = formData.get('startDate') as string;
        const location = formData.get('location') as string;
        const jobPosting = formData.get('jobPosting') as string;
        const salaryQuoted = formData.get('salaryQuoted') as string;
        const recruiterName = formData.get('recruiterName') as string;
        const recruiterEmail = formData.get('recruiterEmail') as string;
        const recruiterLinkedin = formData.get('recruiterLinkedin') as string;

        if (!position || !companyName) {
          return createErrorResponse('Position and company are required');
        }

        const company = await CareerRepository.findOrCreateCompany(getDb(), user.id, {
          name: companyName,
        });

        const newApplication = await CareerRepository.createJobApplication(getDb(), user.id, {
          companyId: company.id,
          position,
          status: status as JobApplicationStatus,
          startDate: new Date(startDate),
          location: location || null,
          jobPosting: jobPosting || null,
          salaryQuoted: salaryQuoted || null,
          recruiterName: recruiterName || null,
          recruiterEmail: recruiterEmail || null,
          recruiterLinkedin: recruiterLinkedin || null,
          reference: false,
          stages: [
            {
              stage: JobApplicationStage.APPLICATION,
              date: new Date().toISOString(),
            },
          ],
        });

        return createSuccessResponse(newApplication, 'Job application created successfully');
      }

      if (operation === 'update') {
        const applicationId = formData.get('applicationId') as string;
        const status = formData.get('status') as string;

        await CareerRepository.updateJobApplicationStatus(
          getDb(),
          user.id,
          applicationId,
          status as JobApplicationStatus,
        );

        return createSuccessResponse(null, 'Job application updated successfully');
      }

      if (operation === 'delete') {
        const applicationId = formData.get('applicationId') as string;

        await CareerRepository.deleteJobApplication(getDb(), user.id, applicationId);

        return createSuccessResponse({ success: true }, 'Job application deleted successfully');
      }

      return createErrorResponse('Invalid operation');
    } catch (error) {
      console.error('Error in job applications action:', error);
      return createErrorResponse('Failed to process job application request');
    }
  });
}

export default function CareerApplications() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData();
  const { addToast } = useToast();

  // Handle action responses
  if (actionData) {
    const result = actionData as { success: boolean; error?: string; message?: string };
    if (result.success) {
      addToast(result.message || 'Operation completed successfully!', 'success');
    } else {
      addToast(`Error: ${result.error}`, 'error');
    }
  }

  if (!loaderData.success) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 ">
        <CardContent className="space-y-2 p-6">
          <h2 className="text-lg font-semibold text-foreground">Error Loading Data</h2>
          <p className="text-sm text-muted-foreground">Failed to load job applications data</p>
        </CardContent>
      </Card>
    );
  }

  if (loaderData?.error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 ">
        <CardContent className="space-y-2 p-6">
          <h2 className="text-lg font-semibold text-foreground">Error Loading Data</h2>
          <p className="text-sm text-muted-foreground">{loaderData.error}</p>
          <p className="text-sm text-muted-foreground">
            Make sure you have job application data in your database.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!loaderData.data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 ">
        <CardContent className="space-y-2 p-6">
          <h2 className="text-lg font-semibold text-foreground">Error Loading Data</h2>
          <p className="text-sm text-muted-foreground">Failed to load job applications data</p>
        </CardContent>
      </Card>
    );
  }

  const { allApplications, applications, pagination, filters } = loaderData.data;

  return (
    <div className="space-y-8 px-2 sm:px-0">
      <Card className="border-border bg-card ">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Applications</Badge>
              <Badge variant="secondary">{pagination.total} total</Badge>
            </div>
            <div>
              <h1 className="text-3xl font-semibold leading-tight text-foreground">
                Job Applications
              </h1>
              <p className="text-sm text-muted-foreground">
                Track your pipeline, review recent activity, and keep application progress
                organized.
              </p>
            </div>
          </div>
          <Link
            to="/career/applications/create"
            className={buttonVariants({
              variant: 'primary',
              className: 'inline-flex items-center gap-2',
            })}
          >
            <PlusIcon className="size-4" />
            <span>Add Application</span>
          </Link>
        </CardContent>
      </Card>

      <div className="space-y-8">
        <ApplicationsHeatmap applications={allApplications} />

        <ApplicationTable
          applications={applications}
          pagination={pagination}
          filters={filters}
          emptyTitle="No applications found"
          emptyDescription="Start tracking your job applications to see them here"
        />
      </div>
    </div>
  );
}
