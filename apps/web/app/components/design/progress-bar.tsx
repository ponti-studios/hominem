import { cn } from '~/lib/utils';

type ProgressBarProps = {
  value: number;
  max: number;
  label: string;
  className?: string;
};

/** Shared, animated progress indicator with an accessible numeric equivalent. */
export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn('h-2 overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
