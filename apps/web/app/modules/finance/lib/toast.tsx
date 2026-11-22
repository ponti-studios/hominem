import { cn } from '@ponti-studios/ui/utilities';
import { useSyncExternalStore } from 'react';

type ToastOptions = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
};

type ToastItem = Required<Pick<ToastOptions, 'title'>> &
  ToastOptions & {
    id: string;
  };

let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

const EMPTY_TOASTS: ToastItem[] = [];

function getServerSnapshot() {
  return EMPTY_TOASTS;
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 p-2"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'pointer-events-auto rounded-sm border border-border bg-card px-4 py-3',
            item.variant === 'destructive'
              ? 'border-destructive/40 bg-destructive text-destructive-foreground'
              : 'border-border bg-card text-card-foreground',
          )}
          role="status"
        >
          <p className="text-sm font-medium">{item.title}</p>
          {item.description ? <p className="mt-1 text-sm opacity-90">{item.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
