import { cn } from '~/lib/utils';

import { PanelState } from './surfaces';

type ChartCardProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  height?: 'sm' | 'md' | 'lg';
  state?: 'ready' | 'loading' | 'empty' | 'error';
  emptyTitle?: string;
  emptyDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  retry?: React.ReactNode;
  labelledBy?: string;
  children?: React.ReactNode;
  className?: string;
};

const HEIGHTS = {
  sm: 'h-48 sm:h-56',
  md: 'h-64 sm:h-72',
  lg: 'h-80 sm:h-96',
} as const;

/**
 * Chart + summary surface. Owns title row, fixed chart heights, and the
 * loading/empty/error states every analytics surface hand-rolls today.
 * Children render only in the `ready` state.
 */
export function ChartCard({
  title,
  subtitle,
  action,
  height = 'md',
  state = 'ready',
  emptyTitle = 'No data yet',
  emptyDescription,
  errorTitle = 'Chart unavailable',
  errorDescription,
  retry,
  labelledBy,
  children,
  className,
}: ChartCardProps) {
  const titleId = labelledBy ?? `chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section
      aria-labelledby={state === 'ready' ? titleId : undefined}
      aria-label={state === 'ready' ? undefined : title}
      className={cn('hairline card-lift rounded-2xl bg-[#0e1116]/90 p-5 sm:p-6', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[15px] font-semibold text-[#f2f4f8]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[13px] text-[#9ba3b4]">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn('mt-3', HEIGHTS[height])} role={state === 'ready' ? 'img' : undefined}>
        {state === 'loading' ? (
          <div
            className="h-full animate-pulse rounded-xl bg-white/[0.04]"
            aria-label="Loading chart"
          />
        ) : null}
        {state === 'error' ? (
          <div className="flex h-full items-center justify-center">
            <PanelState title={errorTitle} description={errorDescription} action={retry} />
          </div>
        ) : null}
        {state === 'empty' ? (
          <div className="flex h-full items-center justify-center">
            <PanelState title={emptyTitle} description={emptyDescription} />
          </div>
        ) : null}
        {state === 'ready' ? children : null}
      </div>
    </section>
  );
}
