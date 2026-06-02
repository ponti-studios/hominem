interface LevelProgressionChartProps {
  data: Array<{
    level: string
    duration: number
    startDate: string
    endDate?: string
  }>
}

export function LevelProgressionChart({ data }: LevelProgressionChartProps) {
  if (data.length === 0) return null

  return (
    <div className="space-y-6">
      {data.map((level, index) => (
        <div key={`level-${level.level}-${index}`} className="relative">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-medium text-slate-900 font-serif capitalize">
              {level.level.replace('-', ' ')}
            </h4>
            <span className="text-sm text-slate-500 font-sans">{level.duration} months</span>
          </div>
          <div className="bg-slate-100 rounded-lg h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg"
              style={{ width: `${Math.min((level.duration / 36) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-slate-500 font-sans">
            <span>{new Date(level.startDate).toLocaleDateString()}</span>
            {level.endDate && <span>{new Date(level.endDate).toLocaleDateString()}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
