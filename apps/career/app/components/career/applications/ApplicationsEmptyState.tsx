import { EmptyState } from '@hominem/ui';
import { buttonVariants } from '@hominem/ui/button';
import { PlusIcon } from 'lucide-react';
import { Link } from 'react-router';

import type { ApplicationsEmptyStateProps } from './types';

export function ApplicationsEmptyState({
  kind,
  emptyTitle,
  emptyDescription,
}: ApplicationsEmptyStateProps) {
  if (kind === 'filtered') {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} variant="search" size="md" />
    );
  }

  return (
    <EmptyState
      title={emptyTitle}
      description={emptyDescription}
      variant="dashed"
      action={
        <Link
          to="/career/applications/create"
          className={buttonVariants({ className: 'inline-flex gap-2' })}
        >
          <PlusIcon className="size-4" />
          Add Application
        </Link>
      }
    />
  );
}
