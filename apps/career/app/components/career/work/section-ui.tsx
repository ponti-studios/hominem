import { Button } from '@ponti-studios/ui/primitives';
import type { ReactNode } from 'react';

import { cn } from '~/lib/utils';

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="heading-4 text-foreground">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

export function DetailRow({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('space-y-1', compact ? '' : 'rounded-md border p-3')}>
      <p className="ui-eyebrow">{label}</p>
      <p className="body-2 break-words text-foreground">{value}</p>
    </div>
  );
}

export function SectionEmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-md border border-dashed p-4">
      <p className="body-3 max-w-2xl text-muted-foreground">{copy}</p>
    </div>
  );
}

export function SectionFormActions({
  isSubmitting,
  onCancel,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" isLoading={isSubmitting} loadingLabel="Saving">
        Save changes
      </Button>
    </div>
  );
}
