import { cn } from '../lib/utils';

interface LoadingSpinnerProps {
  variant?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'loading-size-sm',
  md: 'loading-size-md',
  lg: 'loading-size-lg',
  xl: 'loading-size-xl',
} satisfies Record<NonNullable<LoadingSpinnerProps['variant']>, string>;

export function LoadingSpinner({ variant = 'md' }: LoadingSpinnerProps) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden align-middle',
        sizeClasses[variant],
      )}
      aria-label="Loading"
      role="status"
    >
      <span className="absolute inset-[12%] animate-loading-orbit-cw" aria-hidden="true">
        <span className="absolute left-1/2 top-0 size-[16%] -translate-x-1/2 rounded-full bg-accent shadow-[0_0_12px_rgba(142,141,255,0.45)]" />
        <span className="absolute bottom-[10%] left-[12%] size-[11%] rounded-full bg-accent/75" />
        <span className="absolute right-[12%] top-[34%] size-[11%] rounded-full bg-accent/45" />
      </span>
      <span className="absolute inset-[20%] animate-loading-orbit-ccw" aria-hidden="true">
        <span className="absolute left-1/2 top-0 size-[11%] -translate-x-1/2 rounded-full bg-accent/85" />
        <span className="absolute bottom-[6%] left-[18%] size-[8%] rounded-full bg-accent/55" />
      </span>
      <span className="absolute inset-[39%] rounded-full bg-accent/15 shadow-[0_0_18px_rgba(142,141,255,0.2)]" />
      <span className="sr-only">Loading...</span>
    </span>
  );
}
