import type { ReactNode } from "react";

interface SectionIntroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function SectionIntro({ eyebrow, title, description, actions }: SectionIntroProps) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <div className="text-text-tertiary mb-3 text-[11px] font-medium tracking-[0.18em] uppercase">
            {eyebrow}
          </div>
        ) : null}
        <div className="space-y-3">
          <h1 className="text-title-2 text-foreground font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-body-3 text-text-secondary">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
