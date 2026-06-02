import { CalendarIcon, DollarSignIcon, MapPinIcon } from 'lucide-react'
import { Link, useFetcher } from 'react-router'
import { Button, getButtonClasses } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/Card'
import { Select } from '~/components/ui/select'
import { useToast } from '~/hooks/useToast'
import { centsToDollars, formatCurrency } from '~/lib/utils'
import type { JobApplication } from '~/types/career'
import { JobApplicationStatus } from '~/types/career'

type ApplicationWithCompany = JobApplication & {
  company?: string | { name: string; [key: string]: unknown } | null
  applicationDate?: Date | null
  responseDate?: Date | null
  salaryOffered?: number | null
  source?: string | null
}

interface ApplicationCardsProps {
  applications: ApplicationWithCompany[]
  showActions?: boolean
  emptyTitle?: string
  emptyDescription?: string
  className?: string
}

export function ApplicationCards({
  applications,
  showActions = false,
  emptyTitle = 'No applications found',
  emptyDescription = 'Start tracking your job applications to see them here',
  className = '',
}: ApplicationCardsProps) {
  if (!applications || applications.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <div className="text-4xl mb-4">📝</div>
        <p className="font-medium">{emptyTitle}</p>
        <p className="text-sm mt-1">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className={`grid gap-6 md:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {applications.map((app) => (
        <ApplicationCard key={app.id} application={app} showActions={showActions} />
      ))}
    </div>
  )
}

function ApplicationCard({
  application,
  showActions = false,
}: {
  application: ApplicationWithCompany
  showActions?: boolean
}) {
  const fetcher = useFetcher()
  const { addToast } = useToast()

  const handleStatusChange = (newStatus: string) => {
    if (!showActions) return

    const formData = new FormData()
    formData.append('operation', 'update')
    formData.append('applicationId', application.id)
    formData.append('status', newStatus)

    fetcher.submit(formData, { method: 'POST' })
  }

  const handleDelete = () => {
    if (!showActions) return

    if (confirm('Are you sure you want to delete this application?')) {
      const formData = new FormData()
      formData.append('operation', 'delete')
      formData.append('applicationId', application.id)

      fetcher.submit(formData, { method: 'POST' })
    }
  }

  // Handle fetcher responses
  if (fetcher.state === 'idle' && fetcher.data && showActions) {
    const result = fetcher.data as { success: boolean; error?: string; message?: string }
    if (result.success) {
      addToast(result.message || 'Application updated successfully!', 'success')
    } else {
      addToast(`Error: ${result.error}`, 'error')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case JobApplicationStatus.APPLIED:
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case JobApplicationStatus.PHONE_SCREEN:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case JobApplicationStatus.INTERVIEW:
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case JobApplicationStatus.OFFER:
        return 'bg-green-100 text-green-800 border-green-200'
      case JobApplicationStatus.ACCEPTED:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case JobApplicationStatus.REJECTED:
        return 'bg-red-100 text-red-800 border-red-200'
      case JobApplicationStatus.WITHDRAWN:
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '—'
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getCompanyName = (company: string | { name: string } | null | undefined) => {
    if (!company) return 'Unknown Company'
    if (typeof company === 'string') return company
    return company.name || 'Unknown Company'
  }

  const companyName = getCompanyName(application.company)

  return (
    <Card className="hover:shadow-xl transition-all duration-200 border-0 bg-white/80 backdrop-blur-sm group hover:scale-[1.02]">
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {application.position}
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {companyName.charAt(0)?.toUpperCase() || 'C'}
                </span>
              </div>
              <span className="text-gray-700 font-medium">{companyName}</span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(application.status)}`}
            >
              {application.status.replace(/_/g, ' ')}
            </span>
            {showActions && (
              <Select
                value={application.status}
                onValueChange={handleStatusChange}
                size="sm"
                className="w-24 h-8 text-xs"
              >
                {Object.values(JobApplicationStatus).map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {/* Details */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 flex items-center gap-2">
                <CalendarIcon className="size-4" />
                Applied
              </span>
              <span className="text-gray-900 font-medium">
                {formatDate(application.applicationDate || application.startDate)}
              </span>
            </div>

            {application.location && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 flex items-center gap-2">
                  <MapPinIcon className="size-4" />
                  Location
                </span>
                <span className="text-gray-900 font-medium text-right max-w-32 truncate">
                  {application.location}
                </span>
              </div>
            )}

            {(application.salaryQuoted || application.salaryOffered) && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 flex items-center gap-2">
                  <DollarSignIcon className="size-4" />
                  Salary
                </span>
                <span className="text-gray-900 font-medium text-right max-w-32 truncate">
                  {typeof application.salaryQuoted === 'string'
                    ? application.salaryQuoted
                    : application.salaryOffered
                      ? formatCurrency(centsToDollars(application.salaryOffered))
                      : application.salaryQuoted
                        ? formatCurrency(centsToDollars(application.salaryQuoted))
                        : '—'}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <Link
                to={`/job-applications/${application.id}`}
                className={getButtonClasses({
                  variant: 'outline',
                  size: 'sm',
                  className: 'flex-1 h-8 text-xs',
                })}
              >
                View Details
              </Link>
              {application.jobPosting && (
                <a
                  href={application.jobPosting}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={getButtonClasses({
                    variant: 'outline',
                    size: 'sm',
                    className: 'h-8 text-xs px-3',
                  })}
                >
                  Job Post
                </a>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="h-8 text-xs"
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
