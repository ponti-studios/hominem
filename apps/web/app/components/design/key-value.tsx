import { cn } from '~/lib/utils';

type KeyValueProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'danger';
  className?: string;
};

const TONES = {
  default: 'text-foreground',
  success: 'text-success-text',
  danger: 'text-destructive-text',
} as const;

/**
 * Label/value row for totals, settings, and summary lists. Compose
 * inside KeyValueList for hairline dividers.
 */
export function KeyValue({ label, value, tone = 'default', className }: KeyValueProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-4', className)}>
      <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
        {label}
      </span>
      <span className={cn('text-right text-lg font-medium tabular-nums', TONES[tone])}>
        {value}
      </span>
    </div>
  );
}

export function KeyValueList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mt-6 flex flex-1 flex-col justify-between divide-y divide-border border-t border-border',
        className,
      )}
    >
      {children}
    </div>
  );
}
