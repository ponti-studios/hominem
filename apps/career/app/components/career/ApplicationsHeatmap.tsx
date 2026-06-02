import { useState } from 'react'
import { useContainerWidth } from '~/hooks/useContainerWidth'
import { useWindowSize } from '~/hooks/useWindowSize'
import type { ApplicationWithCompany } from '~/types/applications'

interface ApplicationsHeatmapProps {
  applications: ApplicationWithCompany[]
}

interface DayData {
  date: string
  count: number
  applications: ApplicationWithCompany[]
}

interface EmptyDay {
  date: string
  count: 0
  isEmpty: true
}

export function ApplicationsHeatmap({ applications }: ApplicationsHeatmapProps) {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null)
  const { width: windowWidth } = useWindowSize()
  const [containerRef, containerWidth] = useContainerWidth<HTMLDivElement>()

  // Responsive calculation
  const containerPadding = 48 // p-6 = 24px left + 24px right
  const weekdayLabelsWidth = 40 // Estimated width for "Sun", "Mon", etc. labels + margin
  const gridGap = 8 // space-x-2 between labels and grid
  const weekColWidth = 16 // 12px box + 4px gap

  const availableWidth = Math.max(
    0,
    (containerWidth || 320) - containerPadding - weekdayLabelsWidth - gridGap
  )
  const maxWeeks = Math.floor(availableWidth / weekColWidth)
  const weeksToShow = Math.max(1, Math.min(52, maxWeeks)) // show at least 1 week

  // Generate the last 365 days
  const generateDays = (): DayData[] => {
    const days: DayData[] = []
    const today = new Date()

    for (let i = 364; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateString = date.toISOString().split('T')[0]

      // Find applications for this date
      const dayApplications = applications.filter((app) => {
        const appDate = app.applicationDate || app.startDate
        if (!appDate) return false

        const appDateString = new Date(appDate).toISOString().split('T')[0]
        return appDateString === dateString
      })

      days.push({
        date: dateString,
        count: dayApplications.length,
        applications: dayApplications,
      })
    }

    return days
  }

  const days = generateDays()

  const allWeeks: (DayData | EmptyDay)[][] = []
  if (days.length > 0) {
    const firstDate = new Date(`${days[0].date}T00:00:00`)
    const firstDayOfWeek = firstDate.getUTCDay()

    const paddedDays: (DayData | EmptyDay)[] = []
    for (let i = 0; i < firstDayOfWeek; i++) {
      const emptyDate = new Date(firstDate)
      emptyDate.setDate(emptyDate.getDate() - (firstDayOfWeek - i))
      paddedDays.push({
        date: `empty-${emptyDate.toISOString().split('T')[0]}`,
        count: 0,
        isEmpty: true,
      })
    }
    paddedDays.push(...days)

    for (let i = 0; i < paddedDays.length; i += 7) {
      allWeeks.push(paddedDays.slice(i, i + 7))
    }
  }
  const weeks = allWeeks.slice(-weeksToShow)
  const maxCount = Math.max(0, ...days.map((d) => d.count))

  const getColorClass = (count: number): string => {
    if (count === 0) return 'bg-gray-100'
    if (count === 1) return 'bg-green-200'
    if (count === 2) return 'bg-green-300'
    if (count === 3) return 'bg-green-400'
    return 'bg-green-500'
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getWeekdayLabel = (dayIndex: number): string => {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return weekdays[dayIndex]
  }

  const getCompanyName = (company: ApplicationWithCompany['company']): string => {
    if (typeof company === 'string') return company
    if (company && typeof company === 'object' && company !== null && 'name' in company) {
      return (company as { name: string }).name
    }
    return 'Unknown'
  }

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-gray-200 p-6 relative overflow-x-hidden max-w-4xl mx-auto"
    >
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 font-serif">Application Activity</h3>
        <p className="text-sm text-gray-500 font-sans">
          Your job application activity over the past year
        </p>
      </div>

      <div className="flex items-start space-x-2 max-w-full">
        {/* Weekday labels (removed pt-6 for alignment) */}
        <div className="flex flex-col space-y-1 flex-shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
            <div key={weekday} className="h-3 text-xs text-gray-400 font-mono">
              {weekday}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex space-x-1 max-w-full overflow-x-hidden">
          {weeks.map((week, weekIndex) => (
            <div key={week[0]?.date || weekIndex} className="flex flex-col space-y-1 flex-shrink-0">
              {week.map((day) =>
                'isEmpty' in day && day.isEmpty ? (
                  <div key={day.date} className="w-3 h-3" />
                ) : (
                  <div
                    key={day.date}
                    className={`w-3 h-3 rounded-sm cursor-pointer transition-colors hover:ring-2 hover:ring-blue-300 ${getColorClass(day.count)}`}
                    onMouseEnter={() => setSelectedDay(day as DayData)}
                    onMouseLeave={() => setSelectedDay(null)}
                    title={`${formatDate(day.date)}: ${day.count} application${day.count !== 1 ? 's' : ''}`}
                  />
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end space-x-2 mt-4">
        <span className="text-xs text-gray-500">Less</span>
        <div className="flex space-x-1">
          <div className="w-3 h-3 bg-gray-100 rounded-sm" />
          <div className="w-3 h-3 bg-green-200 rounded-sm" />
          <div className="w-3 h-3 bg-green-300 rounded-sm" />
          <div className="w-3 h-3 bg-green-400 rounded-sm" />
          <div className="w-3 h-3 bg-green-500 rounded-sm" />
        </div>
        <span className="text-xs text-gray-500">More</span>
      </div>

      {/* Tooltip */}
      {selectedDay && selectedDay.count > 0 && (
        <div className="absolute bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg z-10">
          <div className="font-medium">{formatDate(selectedDay.date)}</div>
          <div>
            {selectedDay.count} application{selectedDay.count !== 1 ? 's' : ''}
          </div>
          {selectedDay.applications.length > 0 && (
            <div className="mt-1 pt-1 border-t border-gray-700">
              {selectedDay.applications.slice(0, 3).map((app) => (
                <div key={app.id} className="truncate">
                  {app.position} at {getCompanyName(app.company)}
                </div>
              ))}
              {selectedDay.applications.length > 3 && (
                <div className="text-gray-400">+{selectedDay.applications.length - 3} more</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="text-base md:text-lg font-bold text-gray-900">
              {applications.length}
            </div>
            <div className="text-sm md:text-base text-gray-500">Total</div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="text-base md:text-lg font-bold text-gray-900">
              {days.filter((d) => d.count > 0).length}
            </div>
            <div className="text-sm md:text-base text-gray-500">Active</div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="text-base md:text-lg font-bold text-gray-900">{maxCount}</div>
            <div className="text-sm md:text-base text-gray-500">Most</div>
          </div>
        </div>
      </div>
    </div>
  )
}
