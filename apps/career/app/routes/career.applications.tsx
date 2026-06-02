import { and, eq } from 'drizzle-orm'
import { PlusIcon } from 'lucide-react'
import {
  Link,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'

import { ApplicationTable } from '~/components/career/ApplicationTable'
import { ApplicationsHeatmap } from '~/components/career/ApplicationsHeatmap'

import { useToast } from '~/hooks/useToast'
import { db } from '~/lib/db'
import { getAllApplicationsWithCompany } from '~/lib/db/queries/job-applications'
import { companies, jobApplications } from '~/lib/db/schema'
import {
  createErrorResponse,
  createSuccessResponse,
  withAuthAction,
  withAuthLoader,
} from '~/lib/route-utils'
import { JobApplicationStage, type JobApplicationStatus } from '~/types/career'

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user, request }) => {
    try {
      const url = new URL(request.url)
      const searchParams = url.searchParams

      // Extract pagination and filter parameters
      const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1'))
      const limit = Math.max(1, Math.min(100, Number.parseInt(searchParams.get('limit') || '10'))) // Default 10, max 100
      const offset = (page - 1) * limit

      const searchQuery = searchParams.get('search') || undefined
      const selectedStatuses = searchParams.getAll('status').filter(Boolean)
      const source = searchParams.get('source') || undefined

      // Build filter object
      const filter = {
        ...(selectedStatuses.length > 0 && { statuses: selectedStatuses }),
        ...(source && source !== 'ALL' && { source }),
        ...(searchQuery && { search: searchQuery }),
      }

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
      }

      // Get all applications for the heatmap
      const allApplications = await getAllApplicationsWithCompany(user.id)

      // Get applications with company data using server-side filtering/pagination
      const paginatedApplications = await getAllApplicationsWithCompany(user.id, filter, pagination)

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
      })
    } catch (error) {
      console.error('Error loading job applications data:', error)
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
      })
    }
  })
}

export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user, request }) => {
    try {
      const formData = await request.formData()
      const operation = formData.get('operation') as string

      if (operation === 'create') {
        const position = formData.get('position') as string
        const companyName = formData.get('company') as string
        const status = formData.get('status') as string
        const startDate = formData.get('startDate') as string
        const location = formData.get('location') as string
        const jobPosting = formData.get('jobPosting') as string
        const salaryQuoted = formData.get('salaryQuoted') as string
        const recruiterName = formData.get('recruiterName') as string
        const recruiterEmail = formData.get('recruiterEmail') as string
        const recruiterLinkedin = formData.get('recruiterLinkedin') as string

        if (!position || !companyName) {
          return createErrorResponse('Position and company are required')
        }

        // Create or find company
        let company = await db
          .select()
          .from(companies)
          .where(eq(companies.name, companyName))
          .limit(1)

        if (company.length === 0) {
          const [newCompany] = await db.insert(companies).values({ name: companyName }).returning()
          company = [newCompany]
        }

        // Create job application
        const [newApplication] = await db
          .insert(jobApplications)
          .values({
            userId: user.id,
            position,
            companyId: company[0].id,
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
          })
          .returning()

        return createSuccessResponse(newApplication, 'Job application created successfully')
      }

      if (operation === 'update') {
        const applicationId = formData.get('applicationId') as string
        const status = formData.get('status') as string

        const [updatedApplication] = await db
          .update(jobApplications)
          .set({
            status: status as JobApplicationStatus,
            updatedAt: new Date(),
          })
          .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.userId, user.id)))
          .returning()

        if (!updatedApplication) {
          return createErrorResponse('Job application not found or access denied')
        }

        return createSuccessResponse(updatedApplication, 'Job application updated successfully')
      }

      if (operation === 'delete') {
        const applicationId = formData.get('applicationId') as string

        const [deletedApplication] = await db
          .delete(jobApplications)
          .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.userId, user.id)))
          .returning()

        if (!deletedApplication) {
          return createErrorResponse('Job application not found or access denied')
        }

        return createSuccessResponse({ success: true }, 'Job application deleted successfully')
      }

      return createErrorResponse('Invalid operation')
    } catch (error) {
      console.error('Error in job applications action:', error)
      return createErrorResponse('Failed to process job application request')
    }
  })
}

export default function CareerApplications() {
  const loaderData = useLoaderData<typeof loader>()
  const actionData = useActionData()
  const { addToast } = useToast()

  // Handle action responses
  if (actionData) {
    const result = actionData as { success: boolean; error?: string; message?: string }
    if (result.success) {
      addToast(result.message || 'Operation completed successfully!', 'success')
    } else {
      addToast(`Error: ${result.error}`, 'error')
    }
  }

  if (!loaderData.success) {
    return (
      <div className="bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2 font-serif">Error Loading Data</h2>
          <p className="text-red-700 font-sans">Failed to load job applications data</p>
        </div>
      </div>
    )
  }

  if (loaderData?.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-800 mb-2 font-serif">Error Loading Data</h2>
        <p className="text-red-700 font-sans">{loaderData.error}</p>
        <p className="text-sm text-red-600 mt-2 font-sans">
          Make sure you have job application data in your database.
        </p>
      </div>
    )
  }

  if (!loaderData.data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2 font-serif">
              Error Loading Data
            </h2>
            <p className="text-red-700 font-sans">Failed to load job applications data</p>
          </div>
        </div>
      </div>
    )
  }

  const { allApplications, applications, pagination, filters } = loaderData.data

  return (
    <div className="space-y-8 px-2 sm:px-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 pb-4  ">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold leading-tight text-gray-900">Job Applications</h1>
          </div>
          <Link
            to="/career/applications/create"
            className="btn-primary flex items-center gap-2 p-2 md:px-4"
          >
            <PlusIcon className="size-4" />
            <span className="hidden md:block">Add Application</span>
          </Link>
        </div>
      </div>
      <div className="space-y-8">
        {/* Application Activity Heatmap */}
        <ApplicationsHeatmap applications={allApplications} />

        {/* All Applications */}
        <ApplicationTable
          applications={applications}
          pagination={pagination}
          filters={filters}
          emptyTitle="No applications found"
          emptyDescription="Start tracking your job applications to see them here"
        />
      </div>
    </div>
  )
}
