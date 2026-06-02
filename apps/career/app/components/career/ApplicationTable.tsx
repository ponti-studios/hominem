import { SearchInput } from '@hominem/ui/search-input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hominem/ui/table'
import { PlusIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  formatApplicationDate,
  formatApplicationSalary,
  formatStatusText,
  getCompanyName,
  getStatusColor,
  getUniqueSources,
  getUniqueStatuses,
  hasActiveFilters,
} from '~/lib/utils/applicationUtils'
import type { ApplicationWithCompany } from '~/types/applications'

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface FiltersInfo {
  search?: string
  statuses?: string[]
  source?: string
}

interface ApplicationTableProps {
  applications: ApplicationWithCompany[]
  pagination: PaginationInfo
  filters: FiltersInfo
  emptyTitle?: string
  emptyDescription?: string
  className?: string
}

export function ApplicationTable({
  applications,
  pagination,
  filters,
  emptyTitle = 'No applications found',
  emptyDescription = 'Start tracking your job applications to see them here',
  className = '',
}: ApplicationTableProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  // Get unique statuses and sources from current applications for filter options
  const uniqueStatuses = getUniqueStatuses(applications)
  const uniqueSources = getUniqueSources(applications)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const updateSearchParams = (updates: Record<string, string | string[] | null>) => {
    const newSearchParams = new URLSearchParams(searchParams)

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        newSearchParams.delete(key)
      } else if (Array.isArray(value)) {
        newSearchParams.delete(key)
        for (const v of value) {
          newSearchParams.append(key, v)
        }
      } else {
        newSearchParams.set(key, value)
      }
    }

    navigate(`?${newSearchParams.toString()}`)
  }

  const handleSearchChange = (search: string) => {
    updateSearchParams({ search: search || null, page: '1' })
  }

  const handleStatusToggle = (status: string) => {
    const currentStatuses = filters.statuses || []
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status]

    updateSearchParams({ status: newStatuses, page: '1' })
  }

  const handleSourceChange = (source: string) => {
    updateSearchParams({ source: source === 'ALL' ? null : source, page: '1' })
  }

  const handlePageChange = (page: number) => {
    updateSearchParams({ page: page.toString() })
  }

  const clearAllFilters = () => {
    updateSearchParams({ search: null, status: [], source: null, page: '1' })
  }

  const activeFilters = hasActiveFilters(filters)

  if (!applications || applications.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <div className="text-4xl mb-4">📝</div>
        <p className="font-medium">{emptyTitle}</p>
        <p className="text-sm mt-1">{emptyDescription}</p>
        <Link
          to="/career/applications/create"
          className="btn-primary mt-4 inline-flex items-center gap-2"
        >
          <PlusIcon className="size-4" />
          Add Application
        </Link>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filter Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <label htmlFor="search" className="mb-1 block text-sm font-medium text-gray-700">
              Search
            </label>
            <SearchInput
              value={filters.search || ''}
              onSearchChange={handleSearchChange}
              placeholder="Search by position or company..."
            />
          </div>

          {/* Status Filter - Multi-select */}
          <div className="sm:w-48 relative" ref={statusDropdownRef}>
            <label
              htmlFor="status-dropdown"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Status ({(filters.statuses || []).length} selected)
            </label>
            <button
              id="status-dropdown"
              type="button"
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-left flex items-center justify-between"
            >
              <span className="truncate">
                {!filters.statuses || filters.statuses.length === 0
                  ? 'All Statuses'
                  : filters.statuses.length === 1
                    ? formatStatusText(filters.statuses[0])
                    : `${filters.statuses.length} statuses`}
              </span>
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isStatusDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
                <div className="py-1 max-h-60 overflow-auto">
                  <div className="px-3 py-2 border-b border-gray-200">
                    <button
                      type="button"
                      onClick={() => updateSearchParams({ status: [], page: '1' })}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Clear all
                    </button>
                    <span className="text-gray-400 mx-2">|</span>
                    <button
                      type="button"
                      onClick={() => updateSearchParams({ status: uniqueStatuses, page: '1' })}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Select all
                    </button>
                  </div>
                  {uniqueStatuses.map((status) => (
                    <label
                      key={status}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(filters.statuses || []).includes(status)}
                        onChange={() => handleStatusToggle(status)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-900">{formatStatusText(status)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Source Filter */}
          <div className="sm:w-48">
            <label htmlFor="source-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Source
            </label>
            <select
              id="source-filter"
              value={filters.source || 'ALL'}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="ALL">All Sources</option>
              {uniqueSources.map((source) => (
                <option key={source} value={source || ''}>
                  {source}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Summary and Pagination Controls */}
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
            applications
          </span>
          <div className="flex items-center gap-4">
            {activeFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear filters
              </button>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>

                <span className="text-gray-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table Section */}
      {applications.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">
          <div className="text-4xl mb-4">🔍</div>
          <p className="font-medium">
            {activeFilters ? 'No applications match your filters' : emptyTitle}
          </p>
          <p className="text-sm mt-1">
            {activeFilters ? 'Try adjusting your search criteria' : emptyDescription}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden rounded-lg border border-gray-200 bg-white shadow-sm md:block">
            <Table>
              <TableHeader className="bg-gray-50 [&_tr]:border-gray-200">
                <TableRow>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Position
                  </TableHead>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Status
                  </TableHead>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Applied
                  </TableHead>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Response
                  </TableHead>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Salary
                  </TableHead>
                  <TableHead className="px-6 text-xs uppercase tracking-wider text-gray-500">
                    Source
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id} className="transition-colors hover:bg-gray-50">
                    <TableCell className="px-6 whitespace-nowrap">
                      <Link to={`/career/applications/${app.id}`} className="block hover:text-blue-600">
                        <div className="text-sm font-medium text-gray-900">{app.position}</div>
                        <div className="text-sm text-gray-500">{getCompanyName(app.company)}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="px-6 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(app.status)}`}
                      >
                        {formatStatusText(app.status)}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 whitespace-nowrap text-sm text-gray-900">
                      {formatApplicationDate(app.applicationDate || app.startDate || null)}
                    </TableCell>
                    <TableCell className="px-6 whitespace-nowrap text-sm text-gray-900">
                      {formatApplicationDate(app.responseDate)}
                    </TableCell>
                    <TableCell className="px-6 whitespace-nowrap text-sm text-gray-900">
                      {formatApplicationSalary(app.salaryOffered || app.salaryQuoted)}
                    </TableCell>
                    <TableCell className="px-6 whitespace-nowrap">
                      <span className="text-sm capitalize text-gray-500">{app.source || '—'}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile List View */}
          <div className="md:hidden bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="divide-y divide-gray-200">
              {applications.map((app) => (
                <Link
                  key={app.id}
                  to={`/career/applications/${app.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors duration-200 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {app.position}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {getCompanyName(app.company)}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center space-x-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(app.status)}`}
                      >
                        {formatStatusText(app.status)}
                      </span>
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
