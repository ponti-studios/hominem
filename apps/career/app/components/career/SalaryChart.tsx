import { formatCurrency } from '~/lib/utils'

interface SalaryChartProps {
  data: Array<{
    year: number
    salary: number
    totalComp: number
    company: string
    title: string
  }>
}

export function SalaryChart({ data }: SalaryChartProps) {
  if (data.length === 0) return null

  // Consolidate data by year - take the highest salary per year
  const consolidatedData = data.reduce(
    (acc, item) => {
      const existing = acc.find((d) => d.year === item.year)
      if (!existing) {
        acc.push(item)
      } else if (item.salary > existing.salary) {
        // Replace with higher salary entry
        const index = acc.indexOf(existing)
        acc[index] = item
      }
      return acc
    },
    [] as typeof data
  )

  // Sort by year
  const sortedData = consolidatedData.sort((a, b) => a.year - b.year)

  if (sortedData.length === 0) return null

  const minSalary = Math.min(...sortedData.map((d) => d.salary))
  const maxSalary = Math.max(...sortedData.map((d) => d.salary))
  const salaryRange = maxSalary - minSalary

  // Chart dimensions
  const width = 800
  const height = 300
  const padding = 60
  const chartWidth = width - 2 * padding
  const chartHeight = height - 2 * padding

  // Calculate positions
  const getX = (index: number) => padding + (index / (sortedData.length - 1)) * chartWidth
  const getY = (salary: number) => {
    if (salaryRange === 0) return height - padding - chartHeight / 2
    return height - padding - ((salary - minSalary) / salaryRange) * chartHeight
  }

  // Create path for the line
  const pathData = sortedData
    .map((item, index) => {
      const x = getX(index)
      const y = getY(item.salary)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  // Create gradient area path
  const areaPath = `${sortedData
    .map((item, index) => {
      const x = getX(index)
      const y = getY(item.salary)
      if (index === 0) {
        return `M ${x} ${height - padding} L ${x} ${y}`
      }
      return `L ${x} ${y}`
    })
    .join(' ')} L ${getX(sortedData.length - 1)} ${height - padding} Z`

  return (
    <div className="w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <title>Salary Chart</title>
        {/* Gradient definition */}
        <defs>
          <linearGradient id="salaryGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = height - padding - fraction * chartHeight
          const salary = minSalary + fraction * salaryRange
          return (
            <g key={fraction}>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="rgb(226, 232, 240)"
                strokeWidth="1"
              />
              <text
                x={padding - 10}
                y={y + 4}
                textAnchor="end"
                className="text-xs fill-slate-500 font-sans"
              >
                {formatCurrency(salary / 100)}
              </text>
            </g>
          )
        })}

        {/* Area under the line */}
        <path d={areaPath} fill="url(#salaryGradient)" />

        {/* Main line */}
        <path
          d={pathData}
          stroke="rgb(99, 102, 241)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {sortedData.map((item, index) => {
          const x = getX(index)
          const y = getY(item.salary)
          return (
            <g key={`${item.year}-${index}`}>
              <circle cx={x} cy={y} r="6" fill="white" stroke="rgb(99, 102, 241)" strokeWidth="3" />
              {/* Year labels */}
              <text
                x={x}
                y={height - padding + 20}
                textAnchor="middle"
                className="text-sm fill-slate-600 font-sans"
              >
                {item.year}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
