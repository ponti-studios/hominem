import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export type LoadingVariant = 'page' | 'inline' | 'skeleton';

export interface LoadingStateProps {
  /**
   * The variant of loading state to display
   * - 'page': Full-page loading overlay (centered spinner)
   * - 'inline': Inline loading indicator (spinne with text)
   * - 'skeleton': Skeleton placeholder (gray bars)
   */
  variant?: LoadingVariant;

  /**
   * Loading message to display
   * @default "Loading..."
   */
  message?: string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * For skeleton variant: number of skeleton lines
   * @default 3
   */
  skeletonLines?: number;

  /**
   * For skeleton variant: height of each line (CSS value)
   * @default "h-4"
   */
  skeletonLineHeight?: string;

  /**
   * Delay before showing loading state (in ms)
   * Prevents flashing for quick operations
   * @default 0
   */
  delayMs?: number;

  /**
   * Custom content to display (replaces default)
   */
  children?: ReactNode;
}

/**
 * Unified loading state component for consistent UX across web and mobile
 *
 * @example
 * // Full page loading
 * <LoadingState variant="page" message="Initializing..." />
 *
 * @example
 * // Inline loading with custom text
 * <LoadingState variant="inline" message="Saving your note..." />
 *
 * @example
 * // Skeleton placeholder
 * <LoadingState variant="skeleton" skeletonLines={5} />
 *
 * @example
 * // With delay (don't show for quick operations)
 * <LoadingState variant="inline" delayMs={300} />
 */
export function LoadingState({
  variant = 'inline',
  message = 'Loading...',
  className = '',
  skeletonLines = 3,
  skeletonLineHeight = 'h-4',
  delayMs = 0,
  children,
}: LoadingStateProps) {
  // If custom children provided, render them
  if (children) {
    return <>{children}</>;
  }

  const content = (() => {
    switch (variant) {
      case 'page':
        return (
          <div
            className={`fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm ${className}`}
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="loading-size-lg animate-spin text-primary" />
              {message && <p className="text-sm text-text-secondary">{message}</p>}
            </div>
          </div>
        );

      case 'inline':
        return (
          <div className={`flex items-center gap-2 py-4 ${className}`}>
            <Loader2 className="loading-size-sm animate-spin text-primary" />
            {message && <span className="text-sm text-text-secondary">{message}</span>}
          </div>
        );

      case 'skeleton':
        return (
          <div className={`space-y-2 ${className}`}>
            {Array.from({ length: skeletonLines }).map((_, i) => (
              <div
                key={i}
                className={`${skeletonLineHeight} animate-pulse rounded bg-background-secondary`}
              />
            ))}
          </div>
        );

      default: {
        // Exhaustive check - variant must be one of the above
        void variant;
        return null;
      }
    }
  })();

  // If delay specified, wrap in conditional rendering
  if (delayMs > 0) {
    return <DelayedLoading delayMs={delayMs}>{content}</DelayedLoading>;
  }

  return content;
}

/**
 * Internal component to handle delayed loading state
 * Prevents showing loading indicator for quick operations
 */
function DelayedLoading({ delayMs, children }: { delayMs: number; children: ReactNode }) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!isVisible) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Skeleton variant of LoadingState (convenience component)
 *
 * @example
 * <SkeletonLoader lines={5} />
 */
export function SkeletonLoader({
  lines = 3,
  height = 'h-4',
  className = '',
}: {
  lines?: number;
  height?: string;
  className?: string;
}) {
  return (
    <LoadingState
      variant="skeleton"
      skeletonLines={lines}
      skeletonLineHeight={height}
      className={className}
    />
  );
}

/**
 * Page loading state (convenience component)
 *
 * @example
 * {isLoading && <PageLoader message="Loading your notes..." />}
 */
export function PageLoader({ message }: { message?: string }) {
  return <LoadingState variant="page" message={message} />;
}

/**
 * Inline loading state (convenience component)
 *
 * @example
 * {isSaving && <InlineLoader message="Saving..." />}
 */
export function InlineLoader({ message }: { message?: string }) {
  return <LoadingState variant="inline" message={message} />;
}

// Import React for delayed loading component
import React from 'react';
