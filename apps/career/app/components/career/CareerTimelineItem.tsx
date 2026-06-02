import { formatCurrency } from '~/lib/utils'

export interface CareerTimelineItem {
  date: string
  type: string
  title: string
  description: string
  company?: string
  role?: string
  salary?: number
  salaryChange?: number
  percentage?: string
}

interface CareerTimelineItemProps {
  item: CareerTimelineItem
  index: number
}

export function CareerTimelineItem({ item, index }: CareerTimelineItemProps) {
  const typeStyles = {
    job_start: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    job_end: 'bg-slate-100 text-slate-700 border-slate-200',
    promotion: 'bg-purple-100 text-purple-700 border-purple-200',
    raise: 'bg-blue-100 text-blue-700 border-blue-200',
    default: 'bg-slate-100 text-slate-700 border-slate-200',
  }

  const style = typeStyles[item.type as keyof typeof typeStyles] || typeStyles.default

  return (
    <div className="relative pb-8">
      <div className="relative flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div
            className={`w-3 h-3 rounded-full border-2 ${style.replace('bg-', 'border-').replace('text-', '').replace('border-', 'bg-')}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h4 className="text-lg font-medium text-slate-900 font-serif">{item.title}</h4>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}
            >
              {item.type.replace('_', ' ')}
            </span>
          </div>
          <p className="text-slate-600 mt-1 font-sans">{item.description}</p>
          <div className="flex items-center space-x-4 mt-2 text-sm text-slate-500 font-sans">
            <span>{new Date(item.date).toLocaleDateString()}</span>
            {item.company && <span>• {item.company}</span>}
            {item.salaryChange && (
              <span className="text-emerald-600">• +{formatCurrency(item.salaryChange / 100)}</span>
            )}
          </div>
        </div>
      </div>
      {index > 0 && <div className="absolute left-1.5 top-3 bottom-0 w-0.5 bg-slate-200" />}
    </div>
  )
}
