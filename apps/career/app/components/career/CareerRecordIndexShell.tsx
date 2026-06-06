import type { ReactNode } from 'react';

export interface CareerRecordIndexShellProps {
  title: string;
  subtitle: string;
  primaryAction?: ReactNode;
  metrics?: ReactNode;
  sectionTitle: string;
  emptyState?: ReactNode;
  children?: ReactNode;
}

export function CareerRecordIndexShell({
  title,
  subtitle,
  primaryAction,
  metrics,
  sectionTitle,
  emptyState,
  children,
}: CareerRecordIndexShellProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-light font-sans text-foreground">{title}</h1>
          <p className="text-lg font-sans text-muted-foreground">{subtitle}</p>
        </div>
        {primaryAction}
      </div>

      {metrics}

      <section className="rounded-md border border-border/50 bg-card">
        <div className="border-b border-border/50 p-6">
          <h2 className="text-xl font-semibold text-foreground">{sectionTitle}</h2>
        </div>
        {emptyState ? <div className="p-6 sm:p-8">{emptyState}</div> : children}
      </section>
    </div>
  );
}
