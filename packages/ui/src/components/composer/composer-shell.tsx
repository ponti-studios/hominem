/**
 * ComposerShell
 *
 * Fixed-position card at the bottom of the viewport.
 * Pure layout — no refs, no animations, no state.
 */

import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

export function ComposerShell({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-2 pb-[max(env(safe-area-inset-bottom),8px)] sm:px-3">
      <div className="mx-auto w-full max-w-3xl px-0">
        <div
          className={cn(
            'pointer-events-auto overflow-hidden rounded-2xl border border-border-subtle bg-surface/95 shadow-medium backdrop-blur-xl supports-backdrop-filter:bg-surface/85 focus-within:border-border-focus',
          )}
        >
          <div aria-hidden="true" className="h-px bg-foreground/6" />
          <div className="flex w-full flex-col gap-1.5 px-2.5 py-2 sm:px-3 sm:py-2.5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
