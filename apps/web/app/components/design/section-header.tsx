import { Link } from 'react-router';

type SectionHeaderProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  actions?: React.ReactNode;
  id?: string;
};

/**
 * Card/section header: title, optional description, optional trailing
 * action link and/or custom actions. Replaces every hand-rolled
 * "title + View all/Add" row.
 */
export function SectionHeader({
  title,
  description,
  actionLabel,
  actionTo,
  actions,
  id,
}: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      {!actions && actionLabel && actionTo ? (
        <Link
          to={actionTo}
          viewTransition
          className="shrink-0 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {actionLabel} →
        </Link>
      ) : null}
    </div>
  );
}
