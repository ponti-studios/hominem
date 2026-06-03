import { CareerRepository, getDb } from '@hominem/db';
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
import type { JobApplicationStatus } from '~/types/career';

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

  if (!loaderData.success || !loaderData.data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-2 p-6">
          <h2 className="text-lg font-semibold text-foreground">Error Loading Data</h2>
          <p className="text-sm text-muted-foreground">
            {loaderData?.error ?? 'Failed to load job applications data'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { allApplications, applications, pagination, filters } = loaderData.data;

  return (
    <div className="space-y-8 px-2 sm:px-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Job Applications</h1>
          <p className="text-sm text-muted-foreground">
            {pagination.total} applications · track your pipeline and progress
          </p>
        </div>
        <Link
          to="/career/applications/create"
          className={buttonVariants({ variant: 'primary', size: 'sm' })}
        >
          <PlusIcon className="size-4" />
          Add Application
        </Link>
      </div>

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
