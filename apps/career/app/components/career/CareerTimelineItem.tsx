import { formatCurrency } from '@hominem/utils/numbers';

import { cn } from '~/lib/utils';
export interface CareerTimelineItem {
  date: string;
  type: string;
  title: string;
  description: string;
  company?: string;
  role?: string;
  salary?: number;
  salaryChange?: number;
  percentage?: string;
}

interface CareerTimelineItemProps {
  item: CareerTimelineItem;
  index: number;
}

export function CareerTimelineItem({ item, index }: CareerTimelineItemProps) {
  const typeStyles = {
    job_start: 'bg-success/10 text-success border-success/30',
    job_end: 'bg-muted text-muted-foreground border-border',
    promotion: 'bg-primary/10 text-primary border-primary/30',
    raise: 'bg-accent/20 text-primary border-accent/30',
    default: 'bg-muted text-muted-foreground border-border',
  };

  const style = typeStyles[item.type as keyof typeof typeStyles] || typeStyles.default;

  return (
    <div className="relative pb-8">
      <div className="relative flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div
            className={cn(
              'w-3 h-3 rounded-full border-2',
              style.replace('bg-', 'border-').replace('text-', '').replace('border-', 'bg-'),
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h4 className="heading-3 text-foreground">{item.title}</h4>
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full caption2 border',
                style,
              )}
            >
              {item.type.replace('_', ' ')}
            </span>
          </div>
          <p className="body-3 text-muted-foreground mt-1 whitespace-pre-line">
            {item.description}
          </p>
          <div className="flex items-center space-x-4 mt-2 body-3 text-muted-foreground">
            <span>{new Date(item.date).toLocaleDateString()}</span>
            {item.company && <span>• {item.company}</span>}
            {item.salaryChange && (
              <span className="text-success">• +{formatCurrency(item.salaryChange / 100)}</span>
            )}
          </div>
        </div>
      </div>
      {index > 0 && <div className="absolute left-1.5 top-3 bottom-0 w-0.5 bg-muted" />}
    </div>
  );
}
