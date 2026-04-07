import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

interface SectionIntroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  actions,
  className,
}: SectionIntroProps) {
  return (
    <div className={cn('flex items-start justify-between gap-6', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
            {eyebrow}
          </div>
        ) : null}
        <div className="space-y-3">
          <h1 className="text-title-2 font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? <p className="text-body-3 text-text-secondary">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
