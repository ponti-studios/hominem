import type { TopCompany } from '~/lib/db/queries/job-applications'

interface TopCompaniesTableProps {
  companies: TopCompany[]
}

export function TopCompaniesTable({ companies }: TopCompaniesTableProps) {
  if (!companies || companies.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-4">🏢</div>
        <p>No company data available</p>
        <p className="text-sm mt-1">Start applying to see company insights</p>
      </div>
    )
  }

  const getRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 50) return 'text-blue-600'
    if (rate >= 20) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPerformanceBadge = (offerRate: number, interviewRate: number) => {
    const avgRate = (offerRate + interviewRate) / 2
    if (avgRate >= 70) return { label: 'Excellent', color: 'bg-green-100 text-green-800' }
    if (avgRate >= 50) return { label: 'Good', color: 'bg-blue-100 text-blue-800' }
    if (avgRate >= 30) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800' }
    return { label: 'Poor', color: 'bg-red-100 text-red-800' }
  }

  return (
    <div className="space-y-4">
      {companies.map((company) => {
        const badge = getPerformanceBadge(company.offerRate, company.interviewRate)

        return (
          <div key={company.company} className="border border-gray-200 rounded-lg p-4">
            {/* Company Header */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-medium text-gray-900">{company.company}</h4>
                <p className="text-sm text-gray-500">{company.count} applications</p>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.color}`}>
                {badge.label}
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{company.interviews}</div>
                <div className="text-xs text-gray-500">Interviews</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{company.offers}</div>
                <div className="text-xs text-gray-500">Offers</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold ${getRateColor(company.interviewRate)}`}>
                  {company.interviewRate.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500">Interview Rate</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold ${getRateColor(company.offerRate)}`}>
                  {company.offerRate.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500">Offer Rate</div>
              </div>
            </div>

            {/* Progress Bars */}
            <div className="mt-4 space-y-2">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Interview Success</span>
                  <span>{company.interviewRate.toFixed(1)}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(company.interviewRate, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Offer Success</span>
                  <span>{company.offerRate.toFixed(1)}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(company.offerRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* Summary */}
      {companies.length > 0 && (
        <div className="mt-6 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Company Insights</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Best Performing: </span>
              <span className="font-medium">
                {
                  companies.reduce((best, company) =>
                    company.offerRate > best.offerRate ? company : best
                  ).company
                }
              </span>
            </div>
            <div>
              <span className="text-gray-600">Most Applications: </span>
              <span className="font-medium">
                {
                  companies.reduce((most, company) => (company.count > most.count ? company : most))
                    .company
                }
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
