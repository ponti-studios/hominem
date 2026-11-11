import { cn } from '~/lib/utils';

type ListSkeletonProps = {
  rows?: number;
  className?: string;
  label?: string;
};

/** Pulse rows for list-shaped loading states. Replaces ad-hoc skeletons. */
export function ListSkeleton({ rows = 4, className, label = 'Loading' }: ListSkeletonProps) {
  return (
    <div className={className} aria-label={label} role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="animate-pulse px-4 py-4 sm:px-5"
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <div className="h-4 w-2/3 rounded-full bg-muted" />
          <div className="mt-2 h-3 w-1/3 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

type BlockSkeletonProps = {
  className?: string;
  label?: string;
};

/** Single pulse block for card/chart-shaped loading states. */
export function BlockSkeleton({ className, label = 'Loading' }: BlockSkeletonProps) {
  return (
    <div
      className={cn('h-24 animate-pulse rounded-sm bg-muted', className)}
      aria-label={label}
      role="status"
    />
  );
}
