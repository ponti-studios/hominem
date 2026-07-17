import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  children?: ReactNode;
}

/** Career-specific page heading composition. */
export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="heading-2 text-foreground">{title}</h2>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
