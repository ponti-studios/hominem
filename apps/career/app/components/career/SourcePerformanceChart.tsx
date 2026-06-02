import { PercentageProgressBar, VolumeProgressBar } from '~/components/ui/ProgressBar'

interface SourceMetric {
  source: string
  count: number
  responseRate: number
  offerRate: number
}

interface SourcePerformanceChartProps {
  data: SourceMetric[]
}

export function SourcePerformanceChart({ data }: SourcePerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">No source performance data available</div>
    )
  }

  const maxCount = Math.max(...data.map((source) => source.count))

  return (
    <div className="space-y-4">
      {data.map((source) => (
        <div key={source.source} className="border border-gray-200 rounded-lg p-4">
          {/* Source Header */}
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-medium text-gray-900 capitalize">{source.source}</h4>
            <span className="text-sm text-gray-500">{source.count} applications</span>
          </div>

          {/* Performance Bars */}
          <div className="space-y-3">
            <PercentageProgressBar
              label="Response Rate"
              percentage={source.responseRate}
              color="bg-blue-500"
            />

            <PercentageProgressBar
              label="Offer Rate"
              percentage={source.offerRate}
              color="bg-green-500"
            />

            <VolumeProgressBar
              label="Volume (relative)"
              count={source.count}
              maxCount={maxCount}
              color="bg-gray-500"
            />
          </div>

          {/* Performance Score */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Overall Score</span>
              <span
                className={`text-sm font-medium ${getScoreColor(source.responseRate, source.offerRate)}`}
              >
                {calculatePerformanceScore(source.responseRate, source.offerRate)}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="mt-6 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Performance Guide</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded mr-2" />
            <span className="text-gray-600">Response Rate</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded mr-2" />
            <span className="text-gray-600">Offer Rate</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-30 rounded mr-2" />
            <span className="text-gray-600">Application Volume</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function calculatePerformanceScore(responseRate: number, offerRate: number): string {
  const score = responseRate * 0.4 + offerRate * 0.6

  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Needs Improvement'
}

function getScoreColor(responseRate: number, offerRate: number): string {
  const score = responseRate * 0.4 + offerRate * 0.6

  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-600'
}
