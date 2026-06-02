interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
}

export function StatCard({ title, value, subtitle, trend, icon }: StatCardProps) {
  const trendColors = {
    up: 'text-emerald-600',
    down: 'text-red-500',
    neutral: 'text-slate-500',
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/50 hover:shadow-lg transition-all duration-300 hover:border-slate-300/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-slate-600 tracking-wide uppercase font-sans">
            {title}
          </h3>
          <p className="text-4xl font-light text-slate-900 mt-2 font-serif">{value}</p>
          {subtitle && (
            <p
              className={`text-sm mt-2 font-sans ${trend ? trendColors[trend] : 'text-slate-500'}`}
            >
              {subtitle}
            </p>
          )}
        </div>
        {icon && <div className="text-slate-400 opacity-60">{icon}</div>}
      </div>
    </div>
  )
}
