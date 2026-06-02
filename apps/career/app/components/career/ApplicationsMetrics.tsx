import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useState } from 'react'
import type { JobApplicationMetrics } from '~/lib/db/schema'
import { centsToDollars, formatPercentage } from '~/lib/utils'

interface ApplicationsMetricsProps {
  metrics: JobApplicationMetrics
}

export function ApplicationsMetrics({ metrics }: ApplicationsMetricsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showSalaryDetails, setShowSalaryDetails] = useState(false)

  const performanceMetrics = [
    {
      title: 'Response Rate',
      value: formatPercentage(metrics.responseRate),
      icon: '📧',
      color: 'text-emerald-600',
    },
    {
      title: 'Interview Rate',
      value: formatPercentage(metrics.interviewRate),
      icon: '🎯',
      color: 'text-blue-600',
    },
    {
      title: 'Offer Rate',
      value: formatPercentage(metrics.offerRate),
      icon: '🎉',
      color: 'text-purple-600',
    },
    {
      title: 'Total Applications',
      value: metrics.totalApplications.toString(),
      icon: '📊',
      color: 'text-gray-600',
    },
  ]

  const timingMetrics = [
    {
      title: 'Avg. Response Time',
      value: `${Math.round(metrics.averageTimeToResponse)} days`,
      icon: '⏱️',
      color: 'text-indigo-600',
    },
    {
      title: 'Avg. Offer Time',
      value: `${Math.round(metrics.averageTimeToOffer)} days`,
      icon: '🕐',
      color: 'text-pink-600',
    },
    {
      title: 'Avg. Decision Time',
      value: `${Math.round(metrics.averageTimeToDecision)} days`,
      icon: '⚡',
      color: 'text-orange-600',
    },
    {
      title: 'Acceptance Rate',
      value: formatPercentage(metrics.acceptanceRate),
      icon: '✅',
      color: 'text-green-600',
    },
  ]

  const hasSalaryData = metrics.salaryMetrics.averageOffered > 0

  return (
    <div className="bg-white shadow-lg rounded-lg border border-gray-200">
      {/* Header - Always Visible */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            {isExpanded ? (
              <ChevronUpIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>

        {/* Key Metrics - Always Visible */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {performanceMetrics.map((metric) => (
            <div key={metric.title} className="text-center">
              <div className="text-2xl mb-1">{metric.icon}</div>
              <div className={`text-lg font-bold ${metric.color}`}>{metric.value}</div>
              <div className="text-xs text-gray-500">{metric.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Timing Metrics */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 font-serif">Timing Analysis</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {timingMetrics.map((metric) => (
                <div key={metric.title} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{metric.icon}</span>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500">{metric.title}</div>
                      <div className={`text-sm font-medium ${metric.color}`}>{metric.value}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Salary Insights */}
          {hasSalaryData && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900 font-serif">Salary Insights</h3>
                <button
                  type="button"
                  onClick={() => setShowSalaryDetails(!showSalaryDetails)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showSalaryDetails ? 'Hide Details' : 'Show Details'}
                </button>
              </div>

              {showSalaryDetails ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-600 mb-1">Average Offered</p>
                    <p className="text-xl font-bold text-green-700">
                      ${centsToDollars(metrics.salaryMetrics.averageOffered).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-600 mb-1">Average Accepted</p>
                    <p className="text-xl font-bold text-blue-700">
                      ${centsToDollars(metrics.salaryMetrics.averageAccepted).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-600 mb-1">Negotiation Success</p>
                    <p className="text-xl font-bold text-purple-700">
                      {formatPercentage(metrics.salaryMetrics.negotiationSuccessRate)}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      Avg. Negotiation Increase
                    </p>
                    <p className="text-xl font-bold text-amber-700">
                      {formatPercentage(metrics.salaryMetrics.averageNegotiationIncrease)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Average Salary Offered</p>
                      <p className="text-lg font-bold text-gray-900">
                        ${centsToDollars(metrics.salaryMetrics.averageOffered).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Negotiation Success</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatPercentage(metrics.salaryMetrics.negotiationSuccessRate)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
