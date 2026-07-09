import { cn } from '~/lib/utils';

export function ProgressBar({
  className,
  progress = 0,
}: {
  className?: string;
  progress?: number;
}) {
  return (
    <div className={cn('h-[2px] w-full overflow-hidden border-t border-border', className)}>
      <div
        className={cn('h-full border-t border-warning')}
        style={{
          width: `${Math.min(100, Math.max(0, progress))}%`,
          opacity: progress === 100 ? 0 : 0.8,
        }}
      />
    </div>
  );
}
